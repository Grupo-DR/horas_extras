
import fs from 'fs/promises';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// --- CONFIG ---
const BM_FILE = 'doc_models/BM 09 OC 4600012091 DR RENTAL Abril-25.pdf';
const RDO_FILE = 'doc_models/Relatório Diário de Obra (RDO) n° 4 - 11-09-2025.pdf';

// Helper to extract text from a file path
async function extractText(filePath) {
    console.log(`\n--- READING: ${filePath} ---`);
    try {
        const data = await fs.readFile(filePath);
        const uint8Array = new Uint8Array(data);

        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const doc = await loadingTask.promise;

        console.log(`Pages: ${doc.numPages}`);

        let fullText = '';

        // Read all pages
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();

            // Join items with specialized separator to detect table columns easier
            // usually items are separated by coordinate logic, but in standard stream they come in order
            const strings = textContent.items.map(item => item.str);
            fullText += `\n[PAGE ${i}]\n` + strings.join(' | ');
        }

        return fullText;
    } catch (e) {
        return `ERROR: ${e.message}`;
    }
}


async function run() {
    console.log("Analyzing PDFs...");
    const bmText = await extractText(BM_FILE);
    const rdoText = await extractText(RDO_FILE);


    // Log to console (chunked if needed, but here just first 5k)
    console.log("--- BM FILE START ---");
    console.log(bmText.substring(0, 5000));
    console.log("--- BM FILE END ---");

    console.log("--- RDO FILE START ---");
    console.log(rdoText.substring(0, 5000));
    console.log("--- RDO FILE END ---");
}

run();
