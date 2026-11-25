/** Utilitários comuns aos leitores das planilhas do lakehouse financeiro (funções puras). */

/** Linhas de uma aba, como `sheet_to_json(..., { header: 1, defval: null, blankrows: true })`. */
export type Linhas = unknown[][];

/** Texto comparável: sem acentos, espaços simples, maiúsculas. */
export const norm = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

export const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

export const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

/** Número de série do Excel (ou "dd/mm/aaaa") → "AAAA-MM-DD"; null se inválido. */
export const dataExcel = (v: unknown): string | null => {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = Math.round((Math.floor(v) - 25569) * 86_400_000);
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  // Aceita hora depois da data ("07/01/2026 00:00"), como as exportações do Protheus.
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v ?? '').trim());
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};

/** Número de célula: aceita número ou texto no formato brasileiro; vazio = 0; inválido = NaN. */
export const numero = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Acha o cabeçalho nas primeiras linhas (a primeira que tem todas as colunas exigidas) e devolve
 * o índice de cada coluna. `colunas` mapeia o nome interno para os nomes aceitos no arquivo.
 */
export const localizarColunas = <C extends Record<string, readonly string[]>, K extends keyof C & string = keyof C & string>(
  rows: Linhas,
  colunas: C,
  obrigatorias: readonly K[],
  maxLinhas = 15
): { headerIdx: number; idx: Record<keyof C & string, number> } | null => {
  type Chave = keyof C & string;
  for (let h = 0; h < Math.min(rows.length, maxLinhas); h++) {
    const header = (rows[h] ?? []).map(norm);
    const idx = {} as Record<Chave, number>;
    for (const [k, nomes] of Object.entries(colunas) as [Chave, readonly string[]][]) {
      idx[k] = nomes.map(n => header.indexOf(norm(n))).find(i => i >= 0) ?? -1;
    }
    if (obrigatorias.every(k => idx[k] >= 0)) return { headerIdx: h, idx };
  }
  return null;
};
