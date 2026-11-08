/**
 * Importação da "Planilha de Quantidades e Preços" (PQ) da Vale.
 *
 * As colunas são localizadas pelo cabeçalho (ITEM, CÓD. ATIVIDADE, DESCRIÇÃO DAS
 * ATIVIDADES, UNID., QUANTIDADE, UNITÁRIO). O código do serviço é o CÓD. ATIVIDADE
 * (ex.: C.99.02.01.002): o número do ITEM se repete na PQ e muda entre revisões.
 * Só entram as linhas com unidade e preço unitário (itens pagáveis, não os grupos).
 */
import type { WorkBook } from 'xlsx';
import { utils } from 'xlsx';
import { ServiceItem } from '../types';

export const VALE_PQ_SHEET = 'Planilha de Quantidades';

const norm = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

export const isValePQ = (workbook: WorkBook): boolean => workbook.SheetNames.includes(VALE_PQ_SHEET);

export const parseValePQ = (workbook: WorkBook): ServiceItem[] => {
  const sheet = workbook.Sheets[VALE_PQ_SHEET];
  if (!sheet) throw new Error(`Aba "${VALE_PQ_SHEET}" não encontrada na PQ.`);
  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });

  const headerIdx = rows.findIndex((r) => norm(r[0]) === 'ITEM' && r.some((c) => norm(c).startsWith('DESCRICAO')));
  if (headerIdx < 0) throw new Error('Cabeçalho da PQ Vale não encontrado (coluna ITEM / DESCRIÇÃO DAS ATIVIDADES).');
  const header = rows[headerIdx].map(norm);
  const subHeader = (rows[headerIdx + 1] ?? []).map(norm);

  const codeStart = header.findIndex((c) => c.startsWith('COD. ATIVIDADE') || c.startsWith('COD ATIVIDADE'));
  const descIdx = header.findIndex((c) => c.startsWith('DESCRICAO'));
  const unitIdx = header.findIndex((c) => c.startsWith('UNID'));
  const priceIdx = subHeader.findIndex((c) => c.startsWith('UNITARIO'));
  if (codeStart < 0 || unitIdx < 0 || priceIdx < 0) {
    throw new Error('Colunas da PQ Vale não reconhecidas (CÓD. ATIVIDADE, UNID. ou PREÇO UNITÁRIO).');
  }

  const services: ServiceItem[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(headerIdx + 2)) {
    const unit = String(row[unitIdx] ?? '').trim();
    const price = row[priceIdx];
    if (!unit || typeof price !== 'number') continue;

    const code = row.slice(codeStart, descIdx)
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join('.');
    if (!code || seen.has(code)) continue;
    seen.add(code);

    const item = String(row[0] ?? '').trim();
    const description = String(row[descIdx] ?? '').trim();
    services.push({
      code,
      scope: item ? `${item} · ${description}` : description,
      unit,
      value: price,
    });
  }
  if (services.length === 0) throw new Error('Nenhum item com unidade e preço encontrado na PQ Vale.');
  return services;
};
