"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finCarregarRazao = exports.finAutorizarCarga = exports.FIN_CARGA_CLAIM = void 0;
/**
 * Lakehouse financeiro — carga do razão contábil (Protheus) na camada bronze do BigQuery.
 *
 * Fluxo: o portal envia o Excel cru para o Storage (fin-cargas/razao/<carga>/<arquivo>) e chama
 * `finCarregarRazao`. A função lê o arquivo (juntando as continuações do histórico e classificando,
 * como o protheus_parserV5.py), grava os lançamentos em fin_bronze.razao_totvs substituindo só as
 * competências × filiais presentes no arquivo, e registra a carga em Firestore (fin_cargas).
 *
 * Desenho completo: src/modules/financeiro/LAKEHOUSE.md.
 */
const https_1 = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const bigquery_1 = require("@google-cloud/bigquery");
const XLSX = require("xlsx");
const razaoProtheus_1 = require("./shared/financeiro/razaoProtheus");
const LOCATION = "southamerica-east1";
const DATASET_BRONZE = "fin_bronze";
const TABELA_RAZAO = "razao_totvs";
const PREFIXO_RAZAO = "fin-cargas/razao/";
const MAX_AVISOS = 50;
const bigquery = new bigquery_1.BigQuery();
const SCHEMA_RAZAO = [
    { name: "carga_id", type: "STRING", mode: "REQUIRED" },
    { name: "arquivo", type: "STRING" },
    { name: "carregado_em", type: "TIMESTAMP" },
    { name: "carregado_por", type: "STRING" },
    { name: "linha", type: "INT64", description: "Linha da planilha de origem" },
    { name: "filial", type: "STRING", description: "0101 Construtora, 0201 Rental" },
    { name: "data", type: "DATE", mode: "REQUIRED" },
    { name: "competencia", type: "STRING", description: "AAAA-MM" },
    { name: "centro_custo", type: "STRING", description: "Com máscara (3.0.1.804); vazio se não houver" },
    { name: "conta", type: "STRING", description: "Com máscara (3.1.1.01.000001)" },
    { name: "descricao_conta", type: "STRING" },
    { name: "historico", type: "STRING", description: "Completo, com as linhas de continuação" },
    { name: "debito", type: "NUMERIC" },
    { name: "credito", type: "NUMERIC" },
    { name: "padrao", type: "STRING", description: "Classificação do histórico (protheus_parserV5)" },
    { name: "codigo", type: "STRING" },
    { name: "empresa_pessoa", type: "STRING" },
    { name: "descricao", type: "STRING" },
    { name: "pedido", type: "STRING" },
    { name: "observacao", type: "STRING" },
    { name: "ativo", type: "STRING" },
];
/** Por enquanto só super admin envia cargas financeiras (decisão de 24/11/2026). */
const assertSuperAdmin = async (uid) => {
    const snap = await admin.firestore().collection("user_profiles").doc(uid).get();
    const profile = snap.data();
    if (profile?.isSuperAdmin !== true) {
        throw new https_1.HttpsError("permission-denied", "Só o administrador pode enviar cargas financeiras.");
    }
    return String(profile.email ?? uid);
};
/** Cria o dataset e a tabela do razão na primeira carga (idempotente). */
const garantirTabelaRazao = async () => {
    const dataset = bigquery.dataset(DATASET_BRONZE);
    const [datasetExiste] = await dataset.exists();
    if (!datasetExiste) {
        await bigquery.createDataset(DATASET_BRONZE, {
            location: LOCATION,
            description: "Lakehouse financeiro — camada bronze (dado como chega). Ver LAKEHOUSE.md.",
        });
    }
    const tabela = dataset.table(TABELA_RAZAO);
    const [tabelaExiste] = await tabela.exists();
    if (!tabelaExiste) {
        await dataset.createTable(TABELA_RAZAO, {
            schema: SCHEMA_RAZAO,
            timePartitioning: { type: "MONTH", field: "data" },
            clustering: { fields: ["filial", "centro_custo", "conta"] },
            description: "Razão contábil do Protheus (lançamentos com histórico completo e classificado).",
        });
    }
};
const paraLinhaBq = (l, meta) => ({
    carga_id: meta.cargaId,
    arquivo: meta.arquivo,
    carregado_em: meta.em,
    carregado_por: meta.por,
    linha: l.linha,
    filial: l.filial,
    data: l.data,
    competencia: l.competencia,
    centro_custo: l.centroCusto,
    conta: l.conta,
    descricao_conta: l.descricaoConta,
    historico: l.historico,
    debito: l.debito.toFixed(2),
    credito: l.credito.toFixed(2),
    padrao: l.padrao,
    codigo: l.codigo,
    empresa_pessoa: l.empresaPessoa,
    descricao: l.descricao,
    pedido: l.pedido,
    observacao: l.observacao,
    ativo: l.ativo,
});
/** Carimbo no token de login que libera o envio para fin-cargas/ no Storage (ver storage.rules). */
exports.FIN_CARGA_CLAIM = "finCarga";
/**
 * Libera o envio de arquivos de carga para quem é super admin, gravando a custom claim `finCarga`
 * no login. A regra do Storage confere só a claim (sem consultar o Firestore, o que exigiria
 * permissão de IAM entre serviços). Quem deixar de ser super admin perde a claim na próxima chamada,
 * e a carga em si continua conferindo o perfil em finCarregarRazao.
 */
exports.finAutorizarCarga = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "O usuário deve estar logado.");
    const uid = request.auth.uid;
    const user = await admin.auth().getUser(uid);
    const claims = { ...(user.customClaims ?? {}) };
    const profile = (await admin.firestore().collection("user_profiles").doc(uid).get()).data();
    const permitido = profile?.isSuperAdmin === true;
    if (permitido && claims[exports.FIN_CARGA_CLAIM] !== true) {
        await admin.auth().setCustomUserClaims(uid, { ...claims, [exports.FIN_CARGA_CLAIM]: true });
        return { permitido, alterado: true };
    }
    if (!permitido && exports.FIN_CARGA_CLAIM in claims) {
        delete claims[exports.FIN_CARGA_CLAIM];
        await admin.auth().setCustomUserClaims(uid, claims);
    }
    if (!permitido)
        throw new https_1.HttpsError("permission-denied", "Só o administrador pode enviar cargas financeiras.");
    return { permitido, alterado: false };
});
exports.finCarregarRazao = (0, https_1.onCall)({ region: "us-central1", timeoutSeconds: 540, memory: "2GiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "O usuário deve estar logado.");
    const email = await assertSuperAdmin(request.auth.uid);
    const path = String(request.data?.path ?? "");
    if (!path.startsWith(PREFIXO_RAZAO) || path.includes("..")) {
        throw new https_1.HttpsError("invalid-argument", "Arquivo de carga inválido.");
    }
    const cargaId = path.slice(PREFIXO_RAZAO.length).split("/")[0];
    const arquivo = path.split("/").pop() ?? "";
    const cargaRef = admin.firestore().collection("fin_cargas").doc(cargaId);
    const em = new Date().toISOString();
    await cargaRef.set({ tipo: "razao", arquivo, path, enviadoPor: email, uid: request.auth.uid, iniciadoEm: em, status: "processando" });
    try {
        const bucket = admin.storage().bucket();
        const [buffer] = await bucket.file(path).download();
        const workbook = XLSX.read(buffer, { type: "buffer", dense: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: true });
        const leitura = (0, razaoProtheus_1.lerRazaoProtheus)(rows);
        if (leitura.lancamentos.length === 0)
            throw new https_1.HttpsError("invalid-argument", "Nenhum lançamento encontrado no arquivo.");
        // NDJSON no Storage → load job (sem custo de inserção por linha) numa tabela temporária da carga.
        const ndjsonPath = `${PREFIXO_RAZAO}${cargaId}/razao.ndjson`;
        const meta = { cargaId, arquivo, em, por: email };
        const ndjson = leitura.lancamentos.map(l => JSON.stringify(paraLinhaBq(l, meta))).join("\n");
        await bucket.file(ndjsonPath).save(ndjson, { contentType: "application/x-ndjson" });
        await garantirTabelaRazao();
        const dataset = bigquery.dataset(DATASET_BRONZE);
        const staging = `${TABELA_RAZAO}__carga_${cargaId.replace(/[^A-Za-z0-9_]/g, "_")}`;
        await dataset.table(staging).load(bucket.file(ndjsonPath), {
            sourceFormat: "NEWLINE_DELIMITED_JSON",
            schema: { fields: SCHEMA_RAZAO },
            writeDisposition: "WRITE_TRUNCATE",
        });
        // Substitui só as competências × filiais do arquivo, numa transação.
        const alvo = `\`${DATASET_BRONZE}.${TABELA_RAZAO}\``;
        const temp = `\`${DATASET_BRONZE}.${staging}\``;
        const [job] = await bigquery.createQueryJob({
            location: LOCATION,
            query: `
                    BEGIN TRANSACTION;
                    DELETE FROM ${alvo} t
                    WHERE EXISTS (SELECT 1 FROM ${temp} s WHERE s.filial = t.filial AND s.competencia = t.competencia);
                    INSERT INTO ${alvo} SELECT * FROM ${temp};
                    COMMIT TRANSACTION;
                    DROP TABLE ${temp};`,
        });
        await job.getQueryResults();
        await bucket.file(ndjsonPath).delete({ ignoreNotFound: true });
        const porCompetencia = {};
        for (const l of leitura.lancamentos) {
            const k = `${l.competencia} ${l.filial}`;
            porCompetencia[k] ?? (porCompetencia[k] = { lancamentos: 0, debito: 0, credito: 0 });
            porCompetencia[k].lancamentos++;
            porCompetencia[k].debito += l.debito;
            porCompetencia[k].credito += l.credito;
        }
        const resumo = {
            lancamentos: leitura.lancamentos.length,
            linhasContinuacao: leitura.linhasContinuacao,
            competencias: leitura.competencias,
            filiais: leitura.filiais,
            avisos: leitura.avisos.slice(0, MAX_AVISOS),
            totalAvisos: leitura.avisos.length,
            porCompetencia,
        };
        await cargaRef.update({ status: "concluida", concluidoEm: new Date().toISOString(), resumo });
        logger.info("finCarregarRazao: carga concluída", { cargaId, lancamentos: resumo.lancamentos, competencias: resumo.competencias });
        return { cargaId, ...resumo };
    }
    catch (error) {
        const mensagem = error instanceof https_1.HttpsError ? error.message : String(error?.message ?? error);
        logger.error("finCarregarRazao: falha", { cargaId, erro: mensagem });
        await cargaRef.update({ status: "erro", erro: mensagem.slice(0, 1000), concluidoEm: new Date().toISOString() });
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", `Não foi possível carregar o razão: ${mensagem.slice(0, 300)}`);
    }
});
//# sourceMappingURL=financeiro.js.map