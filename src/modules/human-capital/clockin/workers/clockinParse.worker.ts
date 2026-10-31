import * as XLSX from 'xlsx';
import { parseClockinRows } from '../domain/clockinParser';
import type { ClockinWorkerRequest, ClockinWorkerResponse } from './clockinWorkerMessages';

/**
 * Lê o Excel do Carol Clock In fora da thread da tela. O arquivo de um mês
 * passa de 50 MB por causa do hash do rosto; o parser descarta essa coluna.
 */
// Sem `lib: webworker` no tsconfig: tipa só o que a worker usa.
const ctx = self as unknown as {
    postMessage: (message: ClockinWorkerResponse) => void;
    onmessage: ((event: MessageEvent<ClockinWorkerRequest>) => void) | null;
};

ctx.onmessage = event => {
    try {
        ctx.postMessage({ type: 'progress', stage: 'reading' });
        const workbook = XLSX.read(event.data.buffer, {
            type: 'array',
            dense: true,
            cellDates: false,
            cellNF: false,
            cellHTML: false,
            cellFormula: false,
            cellText: false
        });
        const sheetName = workbook.SheetNames.find(n => n.toLowerCase().startsWith('marca')) ?? workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null });

        ctx.postMessage({ type: 'progress', stage: 'normalizing' });
        ctx.postMessage({ type: 'done', result: parseClockinRows(rows) });
    } catch (error) {
        ctx.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Falha ao ler o arquivo.' });
    }
};
