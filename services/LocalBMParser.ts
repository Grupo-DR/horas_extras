
import * as pdfjsLib from 'pdfjs-dist';

// --- CONFIGURATION ---
// We need to set the worker source. In a Vite app, this is usually handled by importing the worker script.
// However, getting the worker URL correctly can be tricky. We'll try the standard CDN approach for simplicity or local import if possible.
// For now, let's use the CDN for the specific version installed to ensure it works without complex build config changes.
// Check package.json for version. If we installed latest, it's likely 4.x.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface ExtractedData {
    type: 'BM' | 'RDO' | 'UNKNOWN';
    rawText: string;
    fields: Record<string, any>;
    confidence: number;
}

export const LocalBMParser = {
    async parsePDF(file: File): Promise<ExtractedData> {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;

        let fullText = '';
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            // Join with space, but maybe we can be smarter about layout (future)
            // Using a special separator to debug layout
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += `\n--- PAGE ${i} ---\n` + pageText;
        }

        console.log("PDF Raw Text:", fullText);

        return this.analyzeText(fullText, file.name);
    },

    analyzeText(text: string, filename: string): ExtractedData {
        // 1. Detect Type
        let type: 'BM' | 'RDO' | 'UNKNOWN' = 'UNKNOWN';
        if (filename.includes('BM') || text.includes('BOLETIM DE MEDIÇÃO') || text.includes('MEDIÇÃO DE OBRAS')) {
            type = 'BM';
        } else if (filename.includes('RDO') || filename.includes('Relatório Diário') || text.includes('RELATÓRIO DIÁRIO DE OBRA')) {
            type = 'RDO';
        }

        const fields: Record<string, any> = {};

        if (type === 'BM') {
            // --- BM EXTRACTION LOGIC ---

            // CONTRATO: "Contrato nº 4600012091" or "Pedido 4600012091"
            const contractMatch = text.match(/(?:Contrato|Pedido|OC)[\s\n.:]*([0-9]+)/i);
            if (contractMatch) fields.contractId = contractMatch[1];

            // DATA / PERIODO: "Período: 01/04/2025 a 30/04/2025"
            // Simple date finder
            const dates = text.match(/([0-9]{2}\/[0-9]{2}\/[0-9]{4})/g);
            if (dates && dates.length > 0) {
                fields.date = dates[0]; // First date found usually mostly relevant
                if (dates.length > 1) fields.periodEnd = dates[1];
            }

            // VALOR TOTAL: Look for "Total" followed by currency
            // This is tricky. Let's look for the biggest number near "Total" or "A Pagar"
            // Regex for currency: R$ 1.234,56
            // We'll capture all currency-like values and maybe pick the last one (Totals are usually at bottom)
            const moneyMatches = text.match(/R\$\s?[\d.,]+/g) || text.match(/[\d]{1,3}(?:\.[\d]{3})*,\d{2}/g);

            if (moneyMatches) {
                // Heuristic: The largest value is usually the Total Contract or Total Measurement
                // Let's create a list of candidates
                fields.possibleValues = moneyMatches.map(m => m.trim());
                // Pick the last one found in text as a guess for "Total Final"
                fields.value = moneyMatches[moneyMatches.length - 1];
            }

            // EMPREITEIRO: Check filename or text for "CONSTRUTORA" vs "RENTAL"
            if (filename.toUpperCase().includes('RENTAL') || text.toUpperCase().includes('RENTAL')) {
                fields.entityType = 'RENTAL';
            } else {
                fields.entityType = 'CONSTRUTORA';
            }

        } else if (type === 'RDO') {
            // --- RDO EXTRACTION LOGIC ---

            // DATA: "Data: 11/09/2025"
            const dateMatch = text.match(/Data[\s\n.:]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
            if (dateMatch) fields.date = dateMatch[1];

            // OBRA / LOCAL
            const siteMatch = text.match(/Obra[\s\n.:]*([^\n]+)/i);
            if (siteMatch) fields.siteName = siteMatch[1].trim();

            // No RDO number?
            const rdoNum = text.match(/RDO\s*(?:n[ºo°])?[\s\n.:]*([0-9]+)/i);
            if (rdoNum) fields.number = rdoNum[1];
        }

        return {
            type,
            rawText: text,
            fields,
            confidence: 0.5 // Placeholder
        };
    }
};
