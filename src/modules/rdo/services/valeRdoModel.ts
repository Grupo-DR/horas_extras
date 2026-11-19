/**
 * Modelo de RDO da Vale — "Projeto Novas Ferrovias / Relatório Diário de Obras".
 *
 * Diferenças para o RDO padrão:
 *  - atividades sem código de serviço: a quantidade vem no texto ("... - total: 131 m²").
 *    A IA recebe a PQ da obra e escolhe o item; só códigos que existem na PQ são aceitos.
 *  - mão de obra e equipamentos em quantidade por turno (contratado / em operação /
 *    fiscalizado), sem horas. As horas vêm do quadro "Horas Trabalhadas" do dia da
 *    semana, menos 1 h de intervalo (mesma regra dos RDOs Rumo: 07:00-17:00 = 9 h).
 *  - condição da área (operável, parcialmente, inoperável) e clima por turno marcados
 *    com ícones; a IA lê o PDF como imagem.
 */
import { Schema, Type } from "@google/genai";
import { generateWithAi, parseAiJson } from "@/services/aiGateway";
import {
  Activity, Equipment, Occurrence, RDOData, ServiceItem,
  ValeActivity, ValeRdoDetail, ValeResourceRow, Workforce,
} from "../types";
import { generateUUID } from "../utils";

/** Intervalo de refeição descontado da jornada do quadro "Horas Trabalhadas". */
export const VALE_INTERVALO_HORAS = 1;

const shiftCountProps = {
  contratado: { type: Type.NUMBER, description: "Coluna Geral > Contratado" },
  manhaOperacao: { type: Type.NUMBER, description: "Manhã > Em Operação" },
  manhaFiscalizado: { type: Type.NUMBER, description: "Manhã > Fiscalizado" },
  tardeOperacao: { type: Type.NUMBER, description: "Tarde > Em Operação" },
  tardeFiscalizado: { type: Type.NUMBER, description: "Tarde > Fiscalizado" },
  noiteOperacao: { type: Type.NUMBER, description: "Noite > Em Operação" },
  noiteFiscalizado: { type: Type.NUMBER, description: "Noite > Fiscalizado" },
};

const resourceSchema = (nameDescription: string): Schema => ({
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      nome: { type: Type.STRING, description: nameDescription },
      frenteObra: { type: Type.STRING },
      classificacao: { type: Type.STRING, description: "DIRETO ou INDIRETO" },
      ...shiftCountProps,
    },
    required: ["nome", "classificacao", ...Object.keys(shiftCountProps)],
  },
});

export const valeRdoSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    numeroRdo: { type: Type.STRING, description: "Número RDO" },
    dataRdo: { type: Type.STRING, description: "Data RDO no formato DD/MM/AAAA (não a Data de Emissão)" },
    numeroPedido: { type: Type.STRING, description: "Campo 'Número do' (pedido/contrato), ex.: 48000003511" },
    status: { type: Type.STRING, description: "Status do RDO, ex.: Em Aprovação pela Vale" },
    horasTrabalhadas: {
      type: Type.OBJECT,
      properties: {
        segundaAQuinta: { type: Type.STRING, description: "HH:MM - HH:MM ou vazio" },
        sexta: { type: Type.STRING },
        sabado: { type: Type.STRING },
        domingo: { type: Type.STRING },
      },
      required: ["segundaAQuinta", "sexta", "sabado", "domingo"],
    },
    condicaoArea: { type: Type.STRING, description: "Linha marcada em Condições da Área: OPERAVEL, PARCIAL ou INOPERAVEL" },
    clima: {
      type: Type.OBJECT,
      description: "Condições Climáticas: ícone marcado em cada turno. ENSOLARADO (sol), NUBLADO (nuvem com sol), CHUVOSO (nuvem com chuva) ou vazio se nada marcado",
      properties: {
        manha: { type: Type.STRING },
        tarde: { type: Type.STRING },
        noite: { type: Type.STRING },
      },
      required: ["manha", "tarde", "noite"],
    },
    pluviometria: {
      type: Type.OBJECT,
      properties: {
        manha: { type: Type.NUMBER },
        tarde: { type: Type.NUMBER },
        noite: { type: Type.NUMBER },
      },
      required: ["manha", "tarde", "noite"],
    },
    prazos: {
      type: Type.OBJECT,
      properties: {
        contratualDias: { type: Type.NUMBER, nullable: true },
        decorridoDias: { type: Type.NUMBER, nullable: true },
        faltanteDias: { type: Type.NUMBER, nullable: true },
        prorrogadoDias: { type: Type.NUMBER, nullable: true },
        inicioPrevisto: { type: Type.STRING, description: "DD/MM/AAAA" },
        terminoPrevisto: { type: Type.STRING, description: "DD/MM/AAAA" },
      },
    },
    atividades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          frenteObra: { type: Type.STRING },
          area: { type: Type.STRING },
          subArea: { type: Type.STRING },
          descricao: { type: Type.STRING, description: "Descrição completa, exatamente como no RDO" },
          servico: { type: Type.STRING, description: "Só o serviço, sem lado, km e total. Ex.: 'Roçada', 'Limpeza de valeta'" },
          lado: { type: Type.STRING, description: "LE, LD ou vazio" },
          kmInicial: { type: Type.STRING, description: "Ex.: 38+730, ou vazio" },
          kmFinal: { type: Type.STRING, description: "Ex.: 38+861, ou vazio (quando há só um km, repita o inicial)" },
          quantidade: { type: Type.NUMBER, nullable: true, description: "Número após 'total:'" },
          unidade: { type: Type.STRING, description: "Unidade após o número do total: m, m², m³, un..." },
          codigoServico: { type: Type.STRING, description: "Código da lista de serviços da obra que corresponde à atividade, ou vazio" },
          confiancaCodigo: { type: Type.STRING, description: "ALTA, MEDIA ou BAIXA" },
        },
        required: ["descricao", "servico", "quantidade", "unidade", "codigoServico", "confiancaCodigo"],
      },
    },
    maoDeObra: resourceSchema("Função"),
    equipamentos: resourceSchema("Recurso (equipamento)"),
    comentarios: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          data: { type: Type.STRING },
          area: { type: Type.STRING },
          usuario: { type: Type.STRING },
          comentario: { type: Type.STRING },
        },
        required: ["comentario"],
      },
    },
    assinaturas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING },
          usuario: { type: Type.STRING },
          data: { type: Type.STRING },
        },
      },
    },
  },
  required: ["numeroRdo", "dataRdo", "condicaoArea", "atividades", "maoDeObra", "equipamentos"],
};

export const buildValePrompt = (services: ServiceItem[]): string => {
  const list = services.length > 0
    ? services.map((s) => `${s.code} | ${s.scope} | ${s.unit}`).join("\n")
    : "(a obra ainda não tem tabela de serviços: deixe codigoServico vazio)";
  return `Você está lendo um "Relatório Diário de Obras" do Projeto Novas Ferrovias da Vale (PDF com várias folhas).
Extraia os dados no formato pedido. Regras:
1. As tabelas continuam de uma folha para a outra: junte todas as linhas. Ignore linhas TOTAL.
2. Atividades: cada linha da tabela ATIVIDADES é uma atividade. Da descrição, separe serviço, lado (LE/LD), km inicial e final, quantidade e unidade do "total".
3. Para cada atividade, escolha na LISTA DE SERVIÇOS DA OBRA o código do item que paga aquele serviço, considerando descrição e unidade.
   Se houver mais de um item possível (ex.: tamanhos diferentes de valeta), escolha o mais provável e marque confiancaCodigo MEDIA ou BAIXA.
   Se nenhum item servir, deixe codigoServico vazio e confiancaCodigo BAIXA. Nunca invente código fora da lista.
4. Condições da Área e Condições Climáticas são marcadas com um visto (✓): informe a opção marcada.
5. Mão de obra e equipamentos: copie os números de cada coluna exatamente como estão, inclusive zeros.
6. Datas no formato DD/MM/AAAA. Números sem separador de milhar.

LISTA DE SERVIÇOS DA OBRA (código | descrição | unidade):
${list}`;
};

// ─── Conversão para o formato do RDO Online ─────────────────────────────────

const num = (value: unknown): number => {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const text = (value: unknown): string => (value == null ? "" : String(value).trim());

/** "07:00 - 17:00" → 10 (horas decimais); vazio ou inválido → 0. */
export const spanHours = (range: string): number => {
  const match = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/.exec(range ?? "");
  if (!match) return 0;
  const [, h1, m1, h2, m2] = match.map(Number);
  let minutes = h2 * 60 + m2 - (h1 * 60 + m1);
  if (minutes < 0) minutes += 24 * 60; // turno que vira a noite
  return minutes / 60;
};

/** Horas da jornada no dia da semana do RDO (DD/MM/AAAA), menos o intervalo. */
export const valeWorkHours = (date: string, horas: ValeRdoDetail["horasTrabalhadas"]): number => {
  const [d, m, y] = date.split("/").map(Number);
  const weekday = new Date(y, (m || 1) - 1, d || 1).getDay(); // 0 = domingo
  const range = weekday === 0 ? horas.domingo
    : weekday === 6 ? horas.sabado
    : weekday === 5 ? horas.sexta
    : horas.segundaAQuinta;
  const span = spanHours(range);
  return span > 0 ? Math.max(span - VALE_INTERVALO_HORAS, 0) : 0;
};

const toResourceRow = (raw: Record<string, unknown>): ValeResourceRow => ({
  nome: text(raw.nome),
  frenteObra: text(raw.frenteObra),
  classificacao: text(raw.classificacao).toUpperCase(),
  contratado: num(raw.contratado),
  manhaOperacao: num(raw.manhaOperacao),
  manhaFiscalizado: num(raw.manhaFiscalizado),
  tardeOperacao: num(raw.tardeOperacao),
  tardeFiscalizado: num(raw.tardeFiscalizado),
  noiteOperacao: num(raw.noiteOperacao),
  noiteFiscalizado: num(raw.noiteFiscalizado),
});

/** Maior quantidade em operação entre os turnos (quantas pessoas/máquinas trabalharam no dia). */
export const peakInOperation = (row: ValeResourceRow): number =>
  Math.max(row.manhaOperacao, row.tardeOperacao, row.noiteOperacao);

const CLIMA_LABEL: Record<string, string> = { ENSOLARADO: "Ensolarado", NUBLADO: "Nublado", CHUVOSO: "Chuvoso" };
const AREA_LABEL: Record<string, string> = { PARCIAL: "operável parcialmente", INOPERAVEL: "inoperável" };

const plain = (value: unknown) =>
  text(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/**
 * A IA às vezes devolve o texto do documento ("Operável Parcialmente") em vez do código
 * pedido ("PARCIAL"); sem normalizar, a área parcial não virava ocorrência.
 */
export const normalizeAreaCondition = (value: unknown): "OPERAVEL" | "PARCIAL" | "INOPERAVEL" => {
  const v = plain(value);
  if (v.includes("INOPER")) return "INOPERAVEL";
  if (v.includes("PARCIAL")) return "PARCIAL";
  return "OPERAVEL";
};

/** Clima do turno no código usado pelo sistema; vazio quando nada está marcado. */
export const normalizeWeather = (value: unknown): string => {
  const v = plain(value);
  if (!v) return "";
  if (v.includes("CHUV")) return "CHUVOSO";
  if (v.includes("NUBL") || v.includes("NUVEM")) return "NUBLADO";
  if (v.includes("SOL") || v.includes("CLARO") || v.includes("BOM")) return "ENSOLARADO";
  return v;
};

/** Converte a resposta da IA (já em JSON) no RDO do sistema, validando os códigos contra a PQ da obra. */
export const mapValeExtraction = (
  raw: Record<string, unknown>,
  services: ServiceItem[]
): Omit<RDOData, "id" | "teamId"> => {
  const validCodes = new Set(services.map((s) => s.code.trim()));
  const horas = (raw.horasTrabalhadas ?? {}) as Record<string, unknown>;
  const clima = (raw.clima ?? {}) as Record<string, unknown>;
  const chuva = (raw.pluviometria ?? {}) as Record<string, unknown>;
  const prazos = (raw.prazos ?? {}) as Record<string, unknown>;
  const date = text(raw.dataRdo);

  const detail: ValeRdoDetail = {
    numeroPedido: text(raw.numeroPedido),
    status: text(raw.status),
    condicaoArea: normalizeAreaCondition(raw.condicaoArea),
    horasTrabalhadas: {
      segundaAQuinta: text(horas.segundaAQuinta),
      sexta: text(horas.sexta),
      sabado: text(horas.sabado),
      domingo: text(horas.domingo),
    },
    horasDia: 0,
    clima: { manha: normalizeWeather(clima.manha), tarde: normalizeWeather(clima.tarde), noite: normalizeWeather(clima.noite) },
    pluviometria: { manha: num(chuva.manha), tarde: num(chuva.tarde), noite: num(chuva.noite) },
    prazos: {
      contratualDias: prazos.contratualDias == null ? null : num(prazos.contratualDias),
      decorridoDias: prazos.decorridoDias == null ? null : num(prazos.decorridoDias),
      faltanteDias: prazos.faltanteDias == null ? null : num(prazos.faltanteDias),
      prorrogadoDias: prazos.prorrogadoDias == null ? null : num(prazos.prorrogadoDias),
      inicioPrevisto: text(prazos.inicioPrevisto),
      terminoPrevisto: text(prazos.terminoPrevisto),
    },
    atividades: ((raw.atividades ?? []) as Record<string, unknown>[]).map((a): ValeActivity => {
      const code = text(a.codigoServico);
      const confianca = text(a.confiancaCodigo).toUpperCase() || "BAIXA";
      const known = code !== "" && validCodes.has(code);
      return {
        frenteObra: text(a.frenteObra),
        area: text(a.area),
        subArea: text(a.subArea),
        descricao: text(a.descricao),
        servico: text(a.servico),
        lado: text(a.lado).toUpperCase(),
        kmInicial: text(a.kmInicial),
        kmFinal: text(a.kmFinal),
        quantidade: a.quantidade == null ? null : num(a.quantidade),
        unidade: text(a.unidade),
        codigoServico: known ? code : undefined,
        confiancaCodigo: confianca,
        revisar: !known || confianca !== "ALTA" || a.quantidade == null,
      };
    }),
    maoDeObra: ((raw.maoDeObra ?? []) as Record<string, unknown>[]).map(toResourceRow).filter((r) => r.nome),
    equipamentos: ((raw.equipamentos ?? []) as Record<string, unknown>[]).map(toResourceRow).filter((r) => r.nome),
    comentarios: ((raw.comentarios ?? []) as Record<string, unknown>[]).map((c) => ({
      data: text(c.data), area: text(c.area), usuario: text(c.usuario), comentario: text(c.comentario),
    })),
    assinaturas: ((raw.assinaturas ?? []) as Record<string, unknown>[]).map((s) => ({
      area: text(s.area), usuario: text(s.usuario), data: text(s.data),
    })),
  };
  detail.horasDia = valeWorkHours(date, detail.horasTrabalhadas);

  const workforce: Workforce[] = detail.maoDeObra
    .filter((r) => peakInOperation(r) > 0)
    .map((r) => ({ role: r.nome, count: peakInOperation(r), totalHours: peakInOperation(r) * detail.horasDia }));

  const equipment: Equipment[] = detail.equipamentos
    .filter((r) => peakInOperation(r) > 0)
    .map((r) => ({ name: r.nome, count: peakInOperation(r), hoursOperated: peakInOperation(r) * detail.horasDia }));

  const activities: Activity[] = detail.atividades.map((a) => ({
    description: a.descricao,
    code: a.codigoServico,
    quantity: a.quantidade ?? undefined,
    status: a.revisar ? "Revisar" : "Concluído",
  }));

  const occurrences: Occurrence[] = AREA_LABEL[detail.condicaoArea]
    ? [{ description: `Área ${AREA_LABEL[detail.condicaoArea]} (Condições da Área do RDO Vale)`, category: "CONDICAO_AREA" }]
    : [];

  return {
    date,
    reportNumber: text(raw.numeroRdo),
    contractNumber: detail.numeroPedido || undefined,
    weatherMorning: CLIMA_LABEL[detail.clima.manha] ?? (detail.clima.manha || undefined),
    weatherAfternoon: CLIMA_LABEL[detail.clima.tarde] ?? (detail.clima.tarde || undefined),
    rainIndexMm: detail.pluviometria.manha + detail.pluviometria.tarde + detail.pluviometria.noite,
    workforce,
    equipment,
    activities,
    occurrences,
    comments: detail.comentarios.map((c) => c.comentario).filter(Boolean).join("\n") || undefined,
    rdoModel: "VALE_NOVAS_FERROVIAS",
    vale: detail,
  };
};

/** Lê um RDO Vale (PDF ou imagem) usando a PQ da obra para identificar os serviços. */
export const extractValeRDO = async (
  base64: string,
  mimeType: string,
  services: ServiceItem[]
): Promise<RDOData> => {
  const response = await generateWithAi({
    feature: "construction_rdo",
    contents: [
      { inlineData: { mimeType, data: base64 } },
      { text: buildValePrompt(services) },
    ],
    responseMimeType: "application/json",
    responseSchema: valeRdoSchema,
    temperature: 0.1,
    thinkingLevel: "low",
  });
  if (!response.text) throw new Error("A IA não devolveu dados do RDO.");

  return {
    ...mapValeExtraction(parseAiJson(response.text, "o RDO da Vale"), services),
    id: generateUUID(),
    teamId: "",
    processedAt: new Date().toISOString(),
    tokenUsage: response.totalTokenCount || 0,
  };
};
