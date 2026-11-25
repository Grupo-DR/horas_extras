"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finDefinirVigente = exports.finCarregarPlanilha = void 0;
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
const https_1 = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const XLSX = require("xlsx");
const fs = require("fs");
const os = require("os");
const pathLib = require("path");
const financeiro_1 = require("./financeiro");
const budgetForecast_1 = require("./shared/financeiro/budgetForecast");
const dimensoes_1 = require("./shared/financeiro/dimensoes");
const valoresGerenciais_1 = require("./shared/financeiro/valoresGerenciais");
const TIPOS = ["budget", "forecast", "dimensoes", "gerenciais"];
const MAX_AVISOS = 50;
const colunasMeta = [
    { name: "carga_id", type: "STRING", mode: "REQUIRED" },
    { name: "arquivo", type: "STRING" },
    { name: "carregado_em", type: "TIMESTAMP" },
    { name: "carregado_por", type: "STRING" },
];
const meta = (m) => ({ carga_id: m.cargaId, arquivo: m.arquivo, carregado_em: m.em, carregado_por: m.por });
const SCHEMA_PLANO = [
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
const SCHEMA_VERSOES = [
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
const SCHEMA_CC = [
    ...colunasMeta,
    { name: "cc_totvs", type: "STRING", mode: "REQUIRED" },
    { name: "identificacao", type: "STRING" },
    { name: "cc_dr", type: "STRING" },
    { name: "tipo_cc", type: "STRING" },
    { name: "status", type: "STRING" },
    { name: "regional", type: "STRING" },
];
const SCHEMA_CONTA = [
    ...colunasMeta,
    { name: "conta", type: "STRING", mode: "REQUIRED" },
    { name: "descricao", type: "STRING" },
    { name: "grupo", type: "STRING" },
    { name: "tipo_conta", type: "STRING", description: "Faturamento, Impostos, Despesa, Medição" },
    { name: "tipo_conta_2", type: "STRING" },
];
const SCHEMA_GERENCIAIS = [
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
const num = (v) => v.toFixed(6);
/**
 * Grava as linhas na bronze por load job (arquivo NDJSON temporário). `substituir` recebe o nome da
 * tabela temporária e devolve a condição do DELETE (alias t = destino); null = troca a tabela inteira.
 */
const carregarNaBronze = async (o) => {
    await (0, financeiro_1.garantirTabela)(o.tabela, o.schema, o.criar);
    const id = o.cargaId.replace(/[^A-Za-z0-9_]/g, "_");
    const arquivo = pathLib.join(os.tmpdir(), `${o.tabela}-${id}.ndjson`);
    await fs.promises.writeFile(arquivo, o.linhas.map(l => JSON.stringify(l)).join("\n"));
    const carga = { sourceFormat: "NEWLINE_DELIMITED_JSON", schema: { fields: o.schema }, writeDisposition: "WRITE_TRUNCATE" };
    try {
        const dataset = financeiro_1.bigquery.dataset(financeiro_1.DATASET_BRONZE);
        if (!o.substituir) {
            await dataset.table(o.tabela).load(arquivo, carga);
            return;
        }
        const staging = `${o.tabela}__carga_${id}`;
        await dataset.table(staging).load(arquivo, carga);
        const alvo = `\`${financeiro_1.DATASET_BRONZE}.${o.tabela}\``;
        const temp = `\`${financeiro_1.DATASET_BRONZE}.${staging}\``;
        const [job] = await financeiro_1.bigquery.createQueryJob({
            location: financeiro_1.LOCATION,
            query: `
                BEGIN TRANSACTION;
                DELETE FROM ${alvo} t WHERE ${o.substituir(temp)};
                INSERT INTO ${alvo} SELECT * FROM ${temp};
                COMMIT TRANSACTION;
                DROP TABLE ${temp};`,
        });
        await job.getQueryResults();
    }
    finally {
        await fs.promises.unlink(arquivo).catch(() => undefined);
    }
};
const lerAbas = (buffer) => {
    const wb = XLSX.read(buffer, { type: "buffer", dense: true });
    return Object.fromEntries(wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, blankrows: true })]));
};
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const colVersoes = () => admin.firestore().collection("fin_versoes");
/** Define o id, nome e revisão da versão a partir do que foi informado no envio. */
const identificarVersao = async (tipo, ano, dados) => {
    if (tipo === "budget") {
        const nome = String(dados.nome ?? "").trim();
        if (!nome || nome.length > 40)
            throw new https_1.HttpsError("invalid-argument", "Informe o nome da versão do Budget (até 40 caracteres).");
        const versaoId = `budget-${ano}-${slug(nome)}`;
        if (versaoId === `budget-${ano}-`)
            throw new https_1.HttpsError("invalid-argument", "Nome de versão inválido.");
        return { versaoId, nome, tipoForecast: null, revisao: 1 };
    }
    const tipoForecast = String(dados.tipoForecast ?? "");
    if (!budgetForecast_1.TIPOS_FORECAST.includes(tipoForecast))
        throw new https_1.HttpsError("invalid-argument", `Tipo de Forecast inválido. Use: ${budgetForecast_1.TIPOS_FORECAST.join(", ")}.`);
    const existentes = await colVersoes().where("ano", "==", ano).get();
    const revisao = 1 + Math.max(0, ...existentes.docs
        .map(d => d.data())
        .filter(v => v.tipo === "forecast" && v.tipoForecast === tipoForecast)
        .map(v => v.revisao));
    return { versaoId: `forecast-${ano}-${tipoForecast.replace("+", "mais")}-r${revisao}`, nome: `${tipoForecast} rev. ${revisao}`, tipoForecast, revisao };
};
/** Marca uma versão como vigente e desmarca as outras do mesmo tipo e ano. */
const marcarVigente = async (versaoId, tipo, ano) => {
    const doAno = await colVersoes().where("ano", "==", ano).get();
    const batch = admin.firestore().batch();
    for (const d of doAno.docs) {
        const v = d.data();
        if (v.tipo !== tipo)
            continue;
        const vigente = d.id === versaoId;
        if (v.vigente !== vigente)
            batch.update(d.ref, { vigente });
    }
    await batch.commit();
};
/** Espelha o catálogo no BigQuery (tabela pequena, trocada inteira) para as views prata/ouro. */
const sincronizarVersoesBq = async (cargaId) => {
    const todas = (await colVersoes().get()).docs.map(d => d.data());
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
const carregarPlano = async (tipo, abas, m, dados) => {
    const aba = (0, budgetForecast_1.abaDoPlano)(abas);
    if (!aba)
        throw new https_1.HttpsError("invalid-argument", "Nenhuma aba com as colunas Mês, CC DR, Conta, Valor e Ano.");
    let leitura;
    try {
        leitura = (0, budgetForecast_1.lerPlanilhaPlano)(abas[aba]);
    }
    catch (e) {
        if (e instanceof budgetForecast_1.DivergenciaMesError)
            throw new https_1.HttpsError("failed-precondition", e.message, { total: e.total, exemplos: e.exemplos });
        throw new https_1.HttpsError("invalid-argument", e.message);
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
        .some(d => d.id !== versaoId && d.data().tipo === tipo && d.data().vigente);
    const vigente = dados.vigente === true || !jaTemVigente;
    const versao = {
        versaoId, tipo, ano: leitura.ano, nome, tipoForecast, revisao,
        vigente: vigente || (anterior.exists && anterior.data().vigente === true),
        cargaId: m.cargaId, arquivo: m.arquivo, criadoEm: m.em, criadoPor: m.por,
        linhas: leitura.linhas.length, total: leitura.total, porMes: leitura.porMes,
    };
    await ref.set(versao);
    if (versao.vigente)
        await marcarVigente(versaoId, tipo, leitura.ano);
    await sincronizarVersoesBq(m.cargaId);
    return {
        versaoId, nomeVersao: nome, ano: leitura.ano, vigente: versao.vigente, substituiu: anterior.exists,
        linhas: leitura.linhas.length, total: leitura.total, porMes: leitura.porMes,
        avisos: leitura.avisos.slice(0, MAX_AVISOS), totalAvisos: leitura.avisos.length,
    };
};
const carregarDimensoes = async (abas, m) => {
    let leitura;
    try {
        leitura = (0, dimensoes_1.lerDimensoes)(abas);
    }
    catch (e) {
        throw new https_1.HttpsError("invalid-argument", e.message);
    }
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
const carregarGerenciais = async (abas, m) => {
    var _a;
    const aba = (0, valoresGerenciais_1.abaDosGerenciais)(abas);
    if (!aba)
        throw new https_1.HttpsError("invalid-argument", "Nenhuma aba com as colunas CUSTO, CONTA, DATA, HISTORICO, DEBITO e CREDITO.");
    let leitura;
    try {
        leitura = (0, valoresGerenciais_1.lerValoresGerenciais)(abas[aba]);
    }
    catch (e) {
        throw new https_1.HttpsError("invalid-argument", e.message);
    }
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
    const porCompetencia = {};
    for (const l of leitura.lancamentos) {
        porCompetencia[_a = l.competencia] ?? (porCompetencia[_a] = { lancamentos: 0, valor: 0 });
        porCompetencia[l.competencia].lancamentos++;
        porCompetencia[l.competencia].valor += l.credito - l.debito;
    }
    return {
        lancamentos: leitura.lancamentos.length, competencias: leitura.competencias, porCompetencia,
        avisos: leitura.avisos.slice(0, MAX_AVISOS), totalAvisos: leitura.avisos.length,
    };
};
// ---------------------------------------------------------------- callables
exports.finCarregarPlanilha = (0, https_1.onCall)({ region: "us-central1", timeoutSeconds: 540, memory: "2GiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "O usuário deve estar logado.");
    const email = await (0, financeiro_1.assertSuperAdmin)(request.auth.uid);
    const dados = (request.data ?? {});
    const tipo = String(dados.tipo ?? "");
    if (!TIPOS.includes(tipo))
        throw new https_1.HttpsError("invalid-argument", "Tipo de carga inválido.");
    const path = String(dados.path ?? "");
    const prefixo = `fin-cargas/${tipo}/`;
    if (!path.startsWith(prefixo) || path.includes(".."))
        throw new https_1.HttpsError("invalid-argument", "Arquivo de carga inválido.");
    const cargaId = path.slice(prefixo.length).split("/")[0];
    const arquivo = String(dados.arquivoOriginal ?? "").slice(0, 200) || (path.split("/").pop() ?? "");
    const cargaRef = admin.firestore().collection("fin_cargas").doc(cargaId);
    const m = { cargaId, arquivo, em: new Date().toISOString(), por: email };
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
    }
    catch (error) {
        const mensagem = error instanceof https_1.HttpsError ? error.message : String(error?.message ?? error);
        logger.error("finCarregarPlanilha: falha", { cargaId, tipo, erro: mensagem });
        await cargaRef.update({ status: "erro", erro: mensagem.slice(0, 1500), concluidoEm: new Date().toISOString() });
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", `Não foi possível carregar a planilha: ${mensagem.slice(0, 300)}`);
    }
});
/** Troca a versão vigente de Budget ou Forecast de um ano. */
exports.finDefinirVigente = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "O usuário deve estar logado.");
    await (0, financeiro_1.assertSuperAdmin)(request.auth.uid);
    const versaoId = String(request.data?.versaoId ?? "");
    const snap = versaoId ? await colVersoes().doc(versaoId).get() : null;
    if (!snap?.exists)
        throw new https_1.HttpsError("not-found", "Versão não encontrada.");
    const v = snap.data();
    await marcarVigente(versaoId, v.tipo, v.ano);
    await sincronizarVersoesBq(`vigente_${Date.now()}`);
    return { versaoId, tipo: v.tipo, ano: v.ano };
});
//# sourceMappingURL=financeiroPlanilhas.js.map