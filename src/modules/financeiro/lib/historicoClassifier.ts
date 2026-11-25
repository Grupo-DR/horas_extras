/**
 * Classificação do histórico dos lançamentos do razão (Protheus).
 * Tradução fiel do `DataCategorizer` do script `protheus_parserV5.py` da Controladoria:
 * mesmas expressões, mesma ordem de teste e mesmos textos de saída, para que o resultado
 * seja idêntico ao arquivo processado em Python.
 */

export interface HistoricoClassificado {
  padrao: string;        // Padrão
  codigo: string;        // Código
  empresaPessoa: string; // Empresa/Pessoa
  descricao: string;     // Descrição
  pedido: string;        // Pedido
  observacao: string;    // Observação
  ativo: string;         // Ativo
}

const vazio = (padrao: string, extra: Partial<HistoricoClassificado> = {}): HistoricoClassificado => ({
  padrao, codigo: '', empresaPessoa: '', descricao: '', pedido: '', observacao: '', ativo: '', ...extra,
});

/** `str.strip()` do Python (espaços e quebras nas pontas). */
const strip = (s: string) => s.replace(/^\s+|\s+$/g, '');

/** `str.rsplit(sep, 1)` do Python. */
const rsplitOnce = (s: string, sep: string): [string, string] => {
  const i = s.lastIndexOf(sep);
  return [s.slice(0, i), s.slice(i + sep.length)];
};

const REGEX_NF_SMART = new RegExp(
  '^NF\\.\\s*([^/]+)\\s*/\\s*([^-]+)\\s*-\\s*(.+?)\\s*-\\s*' +
  '((?:EXC\\.\\s*)?(?:COMPRA|DESPESA|SERVICO|SERV\\.?|AQUISICAO|LOCACAO|PRESTACAO|REEMBOLSO|ADIANTAMENTO|BRITA|OBRAS|RATEIO|VENDA|COFINS|PIS|IRPJ|CSLL|ISS).*)',
  'i'
);
const REGEX_NF_FALLBACK = /^NF\.\s*([^/]+)\s*\/\s*([^\-]+)\s*-\s*(.+)/i;
const REGEX_PED_DESC = /(.+?)\s*-\s*P\s*E\s*D\.?\s*(.*)/i;
const REGEX_OBS_SPLIT = /^([^\s\-]+)(?:\s*-\s*(.*))?/;

const REGEX_BEM_DEPREC = /\b(?:RATEIO\s+)?BEM\s*:\s*([A-Za-z0-9-]+)-\d{4}\b(?!-)/gi;
const REGEX_ASSET = /\b(CAD|CBL|CM|CTL|EH|MEL|MNL|MN|PCL|PC|REL|RE|VLL|VL|TR)[-\s]*(\d+)\b/gi;

const SIMPLE_PATTERNS: [RegExp, string][] = [
  [/^MOV\s*BANC\s*PAG\.?/i, 'Mov Banc Pagamento'],
  [/\bCARTAO\s*CORPORATIVO\b/i, 'Cartão Corporativo'],
  [/^RECLASSIFICACAO\b/i, 'Reclassificação'],
  [/^ESTORNO\b/i, 'Estorno'],
  [/^DOC\./i, 'DOC'],
  [/^APROPRIACAO\b/i, 'Apropriação'],
  [/^AJUSTE\s*SALDO\s*CONTAS\b/i, 'Ajuste Saldo Contas'],
  [/^TRF\s*CC\s*BEM\b/i, 'TRF CC BEM'],
  [/^APOLICE\b/i, 'APOLICE'],
  [/^BEM\s*:/i, 'Depreciação'],
  [/^RATEIO\s*BEM\s*:/i, 'Rateio Depreciação'],
];

const STARTS_NF = /^NF\./i;
const STARTS_CX = /^CX\s/i;
const STARTS_NUMERIC = /^\d{4}\s*-/;
const STARTS_FOLHA_INTERNA = /^[PD]\d{3}/;
const STARTS_REVERSAO = /^REVERSAO\s*PROVISAO/i;
const STARTS_PROVISAO = /^PROVISAO\b/i;

const parseNf = (text: string): HistoricoClassificado => {
  const entry = vazio('Nota Fiscal');
  const match = REGEX_NF_SMART.exec(text);
  if (match) {
    entry.codigo = strip(match[1]);
    entry.empresaPessoa = strip(match[3]);
    const remaining = strip(match[4]);
    const ped = REGEX_PED_DESC.exec(remaining);
    if (ped) {
      entry.descricao = strip(ped[1]);
      const restoPed = strip(ped[2]);
      const obs = REGEX_OBS_SPLIT.exec(restoPed);
      if (obs) {
        entry.pedido = strip(obs[1]);
        entry.observacao = obs[2] ? strip(obs[2]) : '';
      } else {
        entry.pedido = restoPed;
      }
    } else {
      entry.descricao = remaining;
    }
    return entry;
  }

  const fallback = REGEX_NF_FALLBACK.exec(text);
  if (!fallback) {
    entry.observacao = text;
    return entry;
  }
  entry.codigo = strip(fallback[1]);
  const resto = strip(fallback[3]);
  const ped = REGEX_PED_DESC.exec(resto);
  if (ped) {
    const tudoAntes = strip(ped[1]);
    const restoPed = strip(ped[2]);
    const obs = REGEX_OBS_SPLIT.exec(restoPed);
    if (obs) {
      entry.pedido = strip(obs[1]);
      entry.observacao = obs[2] ? strip(obs[2]) : '';
    } else {
      entry.pedido = restoPed;
    }
    if (tudoAntes.includes(' - ')) [entry.empresaPessoa, entry.descricao] = rsplitOnce(tudoAntes, ' - ');
    else entry.empresaPessoa = tudoAntes;
  } else if (resto.includes(' - ')) {
    [entry.empresaPessoa, entry.descricao] = rsplitOnce(resto, ' - ');
  } else {
    entry.empresaPessoa = resto;
  }
  return entry;
};

const parseCaixinha = (text: string): HistoricoClassificado => {
  const resto = strip(text.replace(/^CX\s+/, ''));
  const parts = resto.split(' - ');
  const entry = vazio('Caixinha');
  if (parts.length >= 3) {
    entry.observacao = strip(parts[0]);
    entry.empresaPessoa = strip(parts[1]);
    entry.descricao = strip(parts.slice(2).join(' - '));
  } else if (parts.length === 2) {
    entry.observacao = strip(parts[0]);
    entry.empresaPessoa = strip(parts[1]);
  } else {
    entry.observacao = text;
  }
  return entry;
};

const parseReversao = (text: string) =>
  /BONUS\b/i.test(text) ? vazio('Reversão Provisão Bônus', { descricao: text }) : vazio('Reversão Provisão', { descricao: text });

const parseProvisao = (text: string) => {
  if (/13.\s*SALARIO/i.test(text)) return vazio('Provisão 13º Salário', { descricao: text });
  if (/FERIAS/i.test(text)) return vazio('Provisão Férias', { descricao: text });
  return vazio('Provisão', { descricao: text });
};

const parseNumericCode = (text: string): HistoricoClassificado => {
  const m = /^(\d{4})\s*-\s*(.+)$/i.exec(strip(text));
  if (!m) return vazio('Outros', { descricao: text });
  const codeVal = m[1];
  const rest = strip(m[2]);
  const up = rest.toUpperCase();
  let cat = 'Outros';
  if (up.startsWith('FOLHA ')) {
    if (up.includes('SAT') && up.includes('AJUST')) cat = 'Folha SAT Ajustado';
    else if (up.includes('INSS') && up.includes('20%')) cat = 'Folha INSS 20%';
    else if (up.includes('INSS') && up.includes('TERCEIR')) cat = 'Folha INSS Terceiros';
    else if (up.includes('FGTS') && up.includes('8%')) cat = 'Folha FGTS 8%';
    else if (up.includes('FGTS') && up.includes('MULTA')) cat = 'Folha FGTS Multa';
    else cat = 'Folha';
  } else if (up.includes('13')) {
    if (up.includes('INSS')) cat = '13º INSS';
    else if (up.includes('TERCEIR')) cat = '13º Terceiros';
    else if (up.includes('SAT') && up.includes('AJUST')) cat = '13º SAT Ajustado';
    else if (up.includes('FGTS') && up.includes('8%')) cat = '13º FGTS 8%';
    else if (up.includes('PROVISAO')) cat = 'Provisão 13º Salário';
    else cat = '13º';
  } else if (up.startsWith('PROVISAO')) {
    cat = up.includes('FERIA') ? 'Provisão Férias' : 'Provisão';
  } else if (up.startsWith('ESTORNO')) {
    cat = 'Estorno';
  }
  return vazio(cat, { codigo: codeVal, descricao: rest });
};

/** Bens do ativo citados no texto (ex.: "EH-069, CM-12"). */
export const extrairAtivo = (text: string): string => {
  if (!text) return '';
  const assets: string[] = [];
  for (const m of text.matchAll(REGEX_BEM_DEPREC)) {
    const code = strip(m[1]);
    if (code && !assets.includes(code)) assets.push(code);
  }
  for (const m of text.matchAll(REGEX_ASSET)) {
    const fmt = `${m[1].toUpperCase()}-${m[2]}`;
    if (!assets.includes(fmt)) assets.push(fmt);
  }
  return assets.join(', ');
};

export const classificarHistorico = (raw: unknown): HistoricoClassificado => {
  if (typeof raw !== 'string' || !raw) return vazio('Outros', { observacao: raw ? String(raw) : '' });
  const text = strip(raw);
  let entry: HistoricoClassificado;

  if (STARTS_NF.test(text)) entry = parseNf(text);
  else if (STARTS_CX.test(text)) entry = parseCaixinha(text);
  else if (STARTS_NUMERIC.test(text)) entry = parseNumericCode(text);
  else if (STARTS_FOLHA_INTERNA.test(text)) {
    const parts = text.split('-');
    entry = vazio('Folha Pagamento Interna', { codigo: strip(parts[0]), descricao: parts.length > 1 ? strip(parts[1]) : '' });
  } else if (STARTS_REVERSAO.test(text)) entry = parseReversao(text);
  else if (STARTS_PROVISAO.test(text)) entry = parseProvisao(text);
  else {
    const simple = SIMPLE_PATTERNS.find(([pattern, category]) =>
      pattern.test(text) && !(category === 'Depreciação' && !/\bDEPREC\.?\s*NO\s*MES\b/i.test(text)));
    entry = simple ? vazio(simple[1], { descricao: text }) : vazio('Outros', { descricao: text });
  }

  entry.ativo = extrairAtivo(entry.observacao) || extrairAtivo(entry.descricao);
  return entry;
};
