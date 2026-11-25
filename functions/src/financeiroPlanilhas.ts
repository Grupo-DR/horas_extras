/**
 * Lakehouse financeiro — carga das planilhas de Budget, Forecast, Dimensões e Valores gerenciais.
 *
 * O portal envia o Excel para o Storage (fin-cargas/<tipo>/<carga>/<arquivo>) e chama
 * `finCarregarPlanilha`. A leitura usa os mesmos leitores testados no portal (src/modules/financeiro/lib).
 *
 * - Budget e Forecast são versionados (catálogo em Firestore `fin_versoes`, espelhado em
 *   fin_bronze.plano_versoes):
 *     - Budget: ano + nome da versão; reenviar o mesmo nome substitui aquela versão.
 *     - Forecast: ano + tipo (3+9, 6+6...) + revisão numerada automaticamente.
 *   Uma versão por tipo e ano fica marcada como vigente, escolhida no envio (ou depois, em
 *   `finDefinirVigente`). A primeira versão de um ano já entra como vigente.
 * - Dimensões: cada carga substitui as tabelas de centros de custo e de contas inteiras.
 * - Valores gerenciais: substituem as competências presentes no arquivo.
 *
 * Desenho completo: src/modules/financeiro/LAKEHOUSE.md.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { TableField } from "@google-cloud/bigquery";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as os from "os";
import * as pathLib from "path";
import { assertSuperAdmin, bigquery, DATASET_BRONZE, garantirTabela, LOCATION } from "./financeiro";
import { abaDoPlano, DivergenciaMesError, lerPlanilhaPlano, LeituraPlano, TIPOS_FORECAST } from "./shared/financeiro/budgetForecast";
import { lerDimensoes } from "./shared/financeiro/dimensoes";
import { abaDosGerenciais, lerValoresGerenciais } from "./shared/financeiro/valoresGerenciais";

const TIPOS = ["budget", "forecast", "dimensoes", "gerenciais"] as const;
type TipoCarga = typeof TIPOS[number];
type TipoPlano = "budget" | "forecast";
const MAX_AVISOS = 50;

interface Meta { cargaId: string; arquivo: string; em: string; por: string }

const colunasMeta: TableField[] = [
    { name: "carga_id", type: "STRING", mode: "REQUIRED" },
    { name: "arquivo", type: "STRING" },
    { name: "carregado_em", type: "TIMESTAMP" },
    { name: "carregado_por", type: "STRING" },
];
const meta = (m: Meta) => ({ carga_id: m.cargaId, arquivo: m.arquivo, carregado_em: m.em, carregado_por: m.por });

const SCHEMA_PLANO: TableField[] = [
    { name: "versao_id", type: "STRING", mode: "REQUIRED", description: "Chave em plano_versoes" },
    ...colunasMeta,
    { name: "linha", type: "INT64", description: "Linha da planilha de origem" },
    { name: "ano", type: "INT64" },
    { name: "data", type: "DATE", mode: "REQUIRED", description: "1º dia da competência (coluna \"Ano\" do arquivo)" },
    { name: "competencia", type: "STRING", description: "AAAA-MM" },
    { name: "cc_dr", type: "STRING" },
    { name: "grupo", type: "STRING" },
    { name: "conta", type: "STRING" },
    { name: "descricao", type: "STRING" },
    { name: "tipo", type: "STRING" },
    { name: "valor", type: "NUMERIC" },
    { name: "classe", type: "STRING" },
];

const SCHEMA_VERSOES: TableField[] = [
    { name: "versao_id", type: "STRING", mode: "REQUIRED" },
    { name: "tipo", type: "STRING", description: "budget ou forecast" },
    { name: "ano", type: "INT64" },
    { name: "nome", type: "STRING" },
    { name: "tipo_forecast", type: "STRING", description: "3+9, 6+6... (só forecast)" },
    { name: "revisao", type: "INT64" },
    { name: "vigente", type: "BOOL" },
    { name: "carga_id", type: "STRING" },
    { name: "criado_em", type: "TIMESTAMP" },
    { name: "criado_por", type: "STRING" },
    { name: "linhas", type: "INT64" },
    { name: "total", type: "NUMERIC" },
];

const SCHEMA_CC: TableField[] = [
    ...colunasMeta,
    { name: "cc_totvs", type: "STRING", mode: "REQUIRED" },
    { name: "identificacao", type: "STRING" },
    { name: "cc_dr", type: "STRING" },
    { name: "tipo_cc", type: "STRING" },
    { name: "status", type: "STRING" },
    { name: "regional", type: "STRING" },
];

const SCHEMA_CONTA: TableField[] = [
    ...colunasMeta,
    { name: "conta", type: "STRING", mode: "REQUIRED" },
    { name: "descricao", type: "STRING" },
    { name: "grupo", type: "STRING" },
    { name: "tipo_conta", type: "STRING", description: "Faturamento, Impostos, Despesa, Medição" },
    { name: "tipo_conta_2", type: "STRING" },
];

const SCHEMA_GERENCIAIS: TableField[] = [
    ...colunasMeta,
    { name: "linha", type: "INT64" },
    { name: "data", type: "DATE", mode: "REQUIRED" },
    { name: "competencia", type: "STRING" },
    { name: "centro_custo", type: "STRING" },
    { name: "conta", type: "STRING" },
    { name: "historico", type: "STRING" },
    { name: "debito", type: "NUMERIC" },
    { name: "credito", type: "NUMERIC" },
    { name: "padrao", type: "STRING" },
    { name: "codigo", type: "STRING" },
    { name: "empresa_pessoa", type: "STRING" },
    { name: "descricao", type: "STRING" },
    { name: "pedido", type: "STRING" },
    { name: "observacao", type: "STRING" },
    { name: "ativo", type: "STRING" },
];

/** NUMERIC aceita até 9 casas; 6 evita lixo de ponto flutuante sem arredondar valores do plano. */
const num = (v: number) => v.toFixed(6);

/**
 * Grava as linhas na bronze por load job (arquivo NDJSON temporário). `substituir` recebe o nome da
 * tabela temporária e devolve a condição do DELETE (alias t = destino); null = troca a tabela inteira.
 */
const carregarNaBronze = async (o: {
    tabela: string;
    schema: TableField[];
    linhas: object[];
    cargaId: string;
    criar: Parameters<typeof garantirTabela>[2];
    substituir: ((temp: string) => string) | null;
}) => {
    await garantirTabela(o.tabela, o.schema, o.criar);
    const id = o.cargaId.replace(/[^A-Za-z0-9_]/g, "_");
    const arquivo = pathLib.join(os.tmpdir(), `${o.tabela}-${id}.ndjson`);
    await fs.promises.writeFile(arquivo, o.linhas.map(l => JSON.stringify(l)).join("\n"));
    const carga = { sourceFormat: "NEWLINE_DELIMITED_JSON", schema: { fields: o.schema }, writeDisposition: "WRITE_TRUNCATE" };
    try {
        const dataset = bigquery.dataset(DATASET_BRONZE);
        if (!o.substituir) {
            await dataset.table(o.tabela).load(arquivo, carga);
            return;
        }
        const staging = `${o.tabela}__carga_${id}`;
        await dataset.table(staging).load(arquivo, carga);
        const alvo = `\`${DATASET_BRONZE}.${o.tabela}\``;
        const temp = `\`${DATASET_BRONZE}.${staging}\``;
        const [job] = await bigquery.createQueryJob({
            location: LOCATION,
            query: `
                BEGIN TRANSACTION;
                DELETE FROM ${alvo} t WHERE ${o.substituir(temp)};
                INSERT INTO ${alvo} SELECT * FROM ${temp};
                COMMIT TRANSACTION;
                DROP TABLE ${temp};`,
        });
        await job.getQueryResults();
    } finally {
        await fs.promises.unlink(arquivo).catch(() => undefined);
    }
};

const lerAbas = (buffer: Buffer): Record<string, unknown[][]> => {
    const wb = XLSX.read(buffer, { type: "buffer", dense: true });
    return Object.fromEntries(wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: null, blankrows: true })]));
};

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------- catálogo de versões

interface Versao {
    versaoId: string;
    tipo: TipoPlano;
    ano: number;
    nome: string;
    tipoForecast: string | null;
    revisao: number;
    vigente: boolean;
    cargaId: string;
    arquivo: string;
    criadoEm: string;
    criadoPor: string;
    linhas: number;
    total: number;
    porMes: Record<string, number>;
}

const colVersoes = () => admin.firestore().collection("fin_versoes");

/** Define o id, nome e revisão da versão a partir do que foi informado no envio. */
const identificarVersao = async (tipo: TipoPlano, ano: number, dados: Record<string, unknown>) => {
    if (tipo === "budget") {
        const nome = String(dados.nome ?? "").trim();
        if (!nome || nome.length > 40) throw new HttpsError("invalid-argument", "Informe o nome da versão do Budget (até 40 caracteres).");
        const versaoId = `budget-${ano}-${slug(nome)}`;
        if (versaoId === `budget-${ano}-`) throw new HttpsError("invalid-argument", "Nome de versão inválido.");
        return { versaoId, nome, tipoForecast: null, revisao: 1 };
    }
    const tipoForecast = String(dados.tipoForecast ?? "");
    if (!TIPOS_FORECAST.includes(tipoForecast)) throw new HttpsError("invalid-argument", `Tipo de Forecast inválido. Use: ${TIPOS_FORECAST.join(", ")}.`);
    const existentes = await colVersoes().where("ano", "==", ano).get();
    const revisao = 1 + Math.max(0, ...existentes.docs
        .map(d => d.data() as Versao)
        .filter(v => v.tipo === "forecast" && v.tipoForecast === tipoForecast)
        .map(v => v.revisao));
    return { versaoId: `forecast-${ano}-${tipoForecast.replace("+", "mais")}-r${revisao}`, nome: `${tipoForecast} rev. ${revisao}`, tipoForecast, revisao };
};

/** Marca uma versão como vigente e desmarca as outras do mesmo tipo e ano. */
const marcarVigente = async (versaoId: string, tipo: TipoPlano, ano: number) => {
    const doAno = await colVersoes().where("ano", "==", ano).get();
    const batch = admin.firestore().batch();
    for (const d of doAno.docs) {
        const v = d.data() as Versao;
        if (v.tipo !== tipo) continue;
        const vigente = d.id === versaoId;
        if (v.vigente !== vigente) batch.update(d.ref, { vigente });
    }
    await batch.commit();
};

/** Espelha o catálogo no BigQuery (tabela pequena, trocada inteira) para as views prata/ouro. */
const sincronizarVersoesBq = async (cargaId: string) => {
    const todas = (await colVersoes().get()).docs.map(d => d.data() as Versao);
    await carregarNaBronze({
        tabela: "plano_versoes",
        schema: SCHEMA_VERSOES,
        cargaId: `versoes_${cargaId}`,
        criar: { description: "Catálogo das versões de Budget e Forecast (espelho de fin_versoes no Firestore)." },
        substituir: null,
        linhas: todas.map(v => ({
            versao_id: v.versaoId, tipo: v.tipo, ano: v.ano, nome: v.nome, tipo_forecast: v.tipoForecast,
            revisao: v.revisao, vigente: v.vigente, carga_id: v.cargaId, criado_em: v.criadoEm,
            criado_por: v.criadoPor, linhas: v.linhas, total: num(v.total),
        })),
    });
};

// ---------------------------------------------------------------- cargas por tipo

const carregarPlano = async (tipo: TipoPlano, abas: Record<string, unknown[][]>, m: Meta, dados: Record<string, unknown>) => {
    const aba = abaDoPlano(abas);
    if (!aba) throw new HttpsError("invalid-argument", "Nenhuma aba com as colunas Mês, CC DR, Conta, Valor e Ano.");
    let leitura: LeituraPlano;
    try {
        leitura = lerPlanilhaPlano(abas[aba]);
    } catch (e) {
        if (e instanceof DivergenciaMesError) throw new HttpsError("failed-precondition", e.message, { total: e.total, exemplos: e.exemplos });
        throw new HttpsError("invalid-argument", (e as Error).message);
    }
    const { versaoId, nome, tipoForecast, revisao } = await identificarVersao(tipo, leitura.ano, dados);

    await carregarNaBronze({
        tabela: tipo,
        schema: SCHEMA_PLANO,
        cargaId: m.cargaId,
        criar: {
            timePartitioning: { type: "MONTH", field: "data" },
            clustering: { fields: ["versao_id", "cc_dr", "conta"] },
            description: tipo === "budget" ? "Budget por versão (bronze)." : "Forecast por versão (bronze).",
        },
        substituir: temp => `t.versao_id IN (SELECT DISTINCT versao_id FROM ${temp})`,
        linhas: leitura.linhas.map(l => ({
            versao_id: versaoId, ...meta(m), linha: l.linha, ano: leitura.ano, data: `${l.competencia}-01`,
            competencia: l.competencia, cc_dr: l.ccDr, grupo: l.grupo, conta: l.conta, descricao: l.descricao,
            tipo: l.tipo, valor: num(l.valor), classe: l.classe,
        })),
    });

    const ref = colVersoes().doc(versaoId);
    const anterior = await ref.get();
    const jaTemVigente = (await colVersoes().where("ano", "==", leitura.ano).get()).docs
        .some(d => d.id !== versaoId && (d.data() as Versao).tipo === tipo && (d.data() as Versao).vigente);
    const vigente = dados.vigente === true || !jaTemVigente;
    const versao: Versao = {
        versaoId, tipo, ano: leitura.ano, nome, tipoForecast, revisao,
        vigente: vigente || (anterior.exists && (anterior.data() as Versao).vigente === true),
        cargaId: m.cargaId, arquivo: m.arquivo, criadoEm: m.em, criadoPor: m.por,
        linhas: leitura.linhas.length, total: leitura.total, porMes: leitura.porMes,
    };
    await ref.set(versao);
    if (versao.vigente) await marcarVigente(versaoId, tipo, leitura.ano);
    await sincronizarVersoesBq(m.cargaId);

    return {
        versaoId, nomeVersao: nome, ano: leitura.ano, vigente: versao.vigente, substituiu: anterior.exists,
        linhas: leitura.linhas.length, total: leitura.total, porMes: leitura.porMes,
        avisos: leitura.avisos.slice(0, MAX_AVISOS), totalAvisos: leitura.avisos.length,
    };
};

const carregarDimensoes = async (abas: Record<string, unknown[][]>, m: Meta) => {
    let leitura;
    try { leitura = lerDimensoes(abas); } catch (e) { throw new HttpsError("invalid-argument", (e as Error).message); }
    await carregarNaBronze({
        tabela: "dim_centro_custo", schema: SCHEMA_CC, cargaId: m.cargaId, substituir: null,
        criar: { description: "Dimensão de centros de custo (Planilha Dimensão)." },
        linhas: leitura.centros.map(c => ({
            ...meta(m), cc_totvs: c.ccTotvs, identificacao: c.identificacao, cc_dr: c.ccDr,
            tipo_cc: c.tipoCc, status: c.status, regional: c.regional,
        })),
    });
    await carregarNaBronze({
        tabela: "dim_conta", schema: SCHEMA_CONTA, cargaId: m.cargaId, substituir: null,
        criar: { description: "Dimensão de contas (Planilha Dimensão). Tipo Conta define as medidas." },
        linhas: leitura.contas.map(c => ({
            ...meta(m), conta: c.conta, descricao: c.descricao, grupo: c.grupo,
            tipo_conta: c.tipoConta, tipo_conta_2: c.tipoConta2,
        })),
    });
    return {
        centros: leitura.centros.length, contas: leitura.contas.length,
        avisos: leitura.avisos.slice(0, MAX_AVISOS), totalAvisos: leitura.avisos.length,
    };
};

const carregarGerenciais = async (abas: Record<string, unknown[][]>, m: Meta) => {
    const aba = abaDosGerenciais(abas);
    if (!aba) throw new HttpsError("invalid-argument", "Nenhuma aba com as colunas CUSTO, CONTA, DATA, HISTORICO, DEBITO e CREDITO.");
    let leitura;
    try { leitura = lerValoresGerenciais(abas[aba]); } catch (e) { throw new HttpsError("invalid-argument", (e as Error).message); }
    await carregarNaBronze({
        tabela: "valores_gerenciais", schema: SCHEMA_GERENCIAIS, cargaId: m.cargaId,
        criar: {
            timePartitioning: { type: "MONTH", field: "data" },
            clustering: { fields: ["centro_custo", "conta"] },
            description: "Valores gerenciais lançados fora do TOTVS (bronze).",
        },
        substituir: temp => `t.competencia IN (SELECT DISTINCT competencia FROM ${temp})`,
        linhas: leitura.lancamentos.map(l => ({
            ...meta(m), linha: l.linha, data: l.data, competencia: l.competencia, centro_custo: l.centroCusto,
            conta: l.conta, historico: l.historico, debito: num(l.debito), credito: num(l.credito),
            padrao: l.padrao, codigo: l.codigo, empresa_pessoa: l.empresaPessoa, descricao: l.descricao,
            pedido: l.pedido, observacao: l.observacao, ativo: l.ativo,
        })),
    });
    const porCompetencia: Record<string, { lancamentos: number; valor: number }> = {};
    for (const l of leitura.lancamentos) {
        porCompetencia[l.competencia] ??= { lancamentos: 0, valor: 0 };
        porCompetencia[l.competencia].lancamentos++;
        porCompetencia[l.competencia].valor += l.credito - l.debito;
    }
    return {
        lancamentos: leitura.lancamentos.length, competencias: leitura.competencias, porCompetencia,
        avisos: leitura.avisos.slice(0, MAX_AVISOS), totalAvisos: leitura.avisos.length,
    };
};

// ---------------------------------------------------------------- callables

export const finCarregarPlanilha = onCall(
    { region: "us-central1", timeoutSeconds: 540, memory: "2GiB" },
    async request => {
        if (!request.auth) throw new HttpsError("unauthenticated", "O usuário deve estar logado.");
        const email = await assertSuperAdmin(request.auth.uid);
        const dados = (request.data ?? {}) as Record<string, unknown>;

        const tipo = String(dados.tipo ?? "") as TipoCarga;
        if (!TIPOS.includes(tipo)) throw new HttpsError("invalid-argument", "Tipo de carga inválido.");
        const path = String(dados.path ?? "");
        const prefixo = `fin-cargas/${tipo}/`;
        if (!path.startsWith(prefixo) || path.includes("..")) throw new HttpsError("invalid-argument", "Arquivo de carga inválido.");
        const cargaId = path.slice(prefixo.length).split("/")[0];
        const arquivo = String(dados.arquivoOriginal ?? "").slice(0, 200) || (path.split("/").pop() ?? "");
        const cargaRef = admin.firestore().collection("fin_cargas").doc(cargaId);
        const m: Meta = { cargaId, arquivo, em: new Date().toISOString(), por: email };
        await cargaRef.set({ tipo, arquivo, path, enviadoPor: email, uid: request.auth.uid, iniciadoEm: m.em, status: "processando" });

        try {
            const [buffer] = await admin.storage().bucket().file(path).download();
            const abas = lerAbas(buffer);
            const resumo = tipo === "budget" || tipo === "forecast"
                ? await carregarPlano(tipo, abas, m, dados)
                : tipo === "dimensoes" ? await carregarDimensoes(abas, m) : await carregarGerenciais(abas, m);
            await cargaRef.update({ status: "concluida", concluidoEm: new Date().toISOString(), resumo });
            logger.info("finCarregarPlanilha: carga concluída", { cargaId, tipo });
            return { cargaId, tipo, ...resumo };
        } catch (error) {
            const mensagem = error instanceof HttpsError ? error.message : String((error as Error)?.message ?? error);
            logger.error("finCarregarPlanilha: falha", { cargaId, tipo, erro: mensagem });
            await cargaRef.update({ status: "erro", erro: mensagem.slice(0, 1500), concluidoEm: new Date().toISOString() });
            if (error instanceof HttpsError) throw error;
            throw new HttpsError("internal", `Não foi possível carregar a planilha: ${mensagem.slice(0, 300)}`);
        }
    }
);

/** Troca a versão vigente de Budget ou Forecast de um ano. */
export const finDefinirVigente = onCall({ region: "us-central1" }, async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "O usuário deve estar logado.");
    await assertSuperAdmin(request.auth.uid);
    const versaoId = String(request.data?.versaoId ?? "");
    const snap = versaoId ? await colVersoes().doc(versaoId).get() : null;
    if (!snap?.exists) throw new HttpsError("not-found", "Versão não encontrada.");
    const v = snap.data() as Versao;
    await marcarVigente(versaoId, v.tipo, v.ano);
    await sincronizarVersoesBq(`vigente_${Date.now()}`);
    return { versaoId, tipo: v.tipo, ano: v.ano };
});
