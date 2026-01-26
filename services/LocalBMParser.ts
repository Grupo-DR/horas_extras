import * as pdfjsLib from 'pdfjs-dist';

// --- CONFIGURATION ---
// Ensure the worker is correctly loaded.
// In production/Vite, this might need adjustment, but CDN is a safe fallback for now.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// --- CONSTANTS FROM PYTHON SCRIPT ---
const COLS = {
    "preco_unitario": [355, 385],
    "qtd_contrato": [390, 425],
    "qtd_anterior": [440, 470],
    "qtd_mes": [480, 510],
    "qtd_acumulado": [515, 550],
    "valor_anterior": [555, 600],
    "valor_mes": [605, 645],
    "valor_acumulado": [650, 690],
    "valor_contrato": [700, 740],
    "saldo": [745, 785]
};

export interface ExtractedData {
    type: 'BM' | 'RDO' | 'UNKNOWN';
    rawText: string;
    fields: {
        // BM Fields
        contractId?: string;
        date?: string;
        period?: string;
        contractor?: string;
        entityType?: 'RENTAL' | 'CONSTRUTORA';
        value?: number; // Valor Total Medição (Cabeçalho)
        totalExtraido?: number; // Soma dos itens
        auditMatrix?: any[];

        // RDO Fields
        relatorio?: any;
        horario_trabalho?: any;
        clima?: any;
        mao_de_obra?: any[];
        equipamentos?: string[];
        atividades?: any[];
        ocorrencias?: string[];
        comentarios?: string[];

        // Universal/Legacy
        siteName?: string;
        number?: string;
        possibleValues?: string[];
    };
    confidence: number;
}

export const LocalBMParser = {
    async parsePDF(file: File): Promise<ExtractedData> {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;

        let fullText = '';
        let p1Text = '';

        // We will collect items page by page
        const pagesData: Array<{ items: any[], text: string }> = [];

        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();

            // Map items to a simpler structure similar to pdfplumber 'words'
            // pdfjs item: { str: string, transform: [sx, ky, kx, sy, tx, ty], width: number, height: number, ... }
            const items = (textContent.items as any[]).map(item => ({
                text: item.str,
                x0: item.transform[4], // tx
                // width in pdfjs is technically width in scale 1?
                // We estimate x1 = x0 + width. 
                // Note: width might need scaling by transform[0] (sx) if font scaling applies, but usually usually decent approx.
                x1: item.transform[4] + item.width,
                // PDF Y is bottom-left origin. pdfplumber is usually top-left.
                // However, the python script uses y ordering: `y = round(w['top'] / 5) * 5`.
                // In PDFJS, 'ty' is bottom-up. High 'ty' = Top of page.
                // To match "Top-Down" sorting, we can just invert (e.g. 1000 - ty) or simply Sort Descending by TY.
                // The python script sorts by Y ascending (top-down in its coords)? No, `for y in y_ordenados`. `top` is usually 0 at top. 
                // We will stick to PDFJS 'ty' and Sort DESCENDING (Top to Bottom).
                y: item.transform[5],
                height: item.height
            }));

            // Generate raw text for page
            // Simple sort by Y desc, then X asc
            const sortedForText = [...items].sort((a, b) => b.y - a.y || a.x0 - b.x0);
            const pageRawText = sortedForText.map(i => i.text).join(' ');

            if (i === 1) p1Text = pageRawText;
            fullText += pageRawText + '\n';

            pagesData.push({ items, text: pageRawText });
        }

        return this.processData(fullText, p1Text, pagesData, file.name);
    },

    processRDOData(fullText: string, lines: Record<number, any[]>): ExtractedData {
        const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a);
        const data: any = {
            relatorio: {},
            horario_trabalho: {},
            clima: { manha: {}, tarde: {} },
            mao_de_obra: [],
            equipamentos: [],
            atividades: [],
            ocorrencias: [],
            comentarios: []
        };

        // Helper to find value in text
        const findVal = (regex: RegExp, text: string) => {
            const match = text.match(regex);
            return match ? match[1].trim() : null;
        };

        // 1. Header Info (Regex on full text because it's scattered)
        data.relatorio.numero = findVal(/Relatório n[º°]\s*(\d+)/i, fullText);
        data.relatorio.data = findVal(/Data do relatório\s*([\d\/]+)/i, fullText);
        data.relatorio.contrato = findVal(/Contrato\s*([A-Z0-9]+)/i, fullText);
        data.relatorio.obra = findVal(/Obra\s*([^\n]+)/i, fullText); // Rough guess
        // Enhance with more specific regex if needed based on layout

        // 2. Sections (State Machine over Lines)
        let currentSection: 'NONE' | 'CLIMA' | 'MAO_DE_OBRA' | 'EQUIPAMENTOS' | 'ATIVIDADES' | 'OCORRENCIAS' | 'COMENTARIOS' = 'NONE';

        for (const y of sortedYs) {
            const lineItems = lines[y].sort((a, b) => a.x0 - b.x0);
            const lineText = lineItems.map(i => i.text).join(" ").trim();
            const upperLine = lineText.toUpperCase();

            // Detect Section Headers
            if (upperLine.includes("CLIMA") && upperLine.includes("MANHÃ")) { currentSection = 'CLIMA'; continue; }
            if (upperLine.includes("MÃO DE OBRA") || (upperLine.includes("NOME") && upperLine.includes("FUNÇÃO"))) { currentSection = 'MAO_DE_OBRA'; continue; }
            if (upperLine.includes("EQUIPAMENTOS") || (upperLine.includes("DESCRIÇÃO") && upperLine.includes("HORÍMETRO"))) { currentSection = 'EQUIPAMENTOS'; continue; }
            if (upperLine.includes("ATIVIDADES") || upperLine.includes("SERVIÇOS EXECUTADOS")) { currentSection = 'ATIVIDADES'; continue; }
            if (upperLine.includes("OCORRÊNCIAS") || (upperLine.includes("OCORRENCIAS"))) { currentSection = 'OCORRENCIAS'; continue; }
            if (upperLine.includes("COMENTÁRIOS") || upperLine.includes("OBSERVAÇÕES")) { currentSection = 'COMENTARIOS'; continue; }

            // Parse Content based on Section
            if (currentSection === 'CLIMA') {
                // TBD: Parse Manha / Tarde columns. Usually they are side by side.
                // Assuming simple text for now or heuristic.
            }
            else if (currentSection === 'MAO_DE_OBRA') {
                // Heuristic: Name usually at start, Function after.
                // Ignore headers like "Nome", "Função"
                if (upperLine.startsWith("NOME") || lineText.length < 5) continue;

                // Try to split by expected column positions if available, or just space/tabs
                // For now, let's treat the whole line as a crude entry or try to regex:
                // Name (Words) | Role (Words) | Times
                data.mao_de_obra.push({ rawLine: lineText });
            }
            else if (currentSection === 'EQUIPAMENTOS') {
                if (upperLine.startsWith("DESCRIÇÃO") || lineText.length < 5) continue;
                data.equipamentos.push(lineText);
            }
            else if (currentSection === 'ATIVIDADES') {
                if (upperLine.startsWith("DESCRIÇÃO") || lineText.length < 5) continue;
                data.atividades.push({ descricao: lineText });
            }
            else if (currentSection === 'OCORRENCIAS') {
                data.ocorrencias.push(lineText);
            }
            else if (currentSection === 'COMENTARIOS') {
                data.comentarios.push(lineText);
            }
        }

        return {
            type: 'RDO',
            rawText: fullText,
            confidence: 0.8,
            fields: {
                ...data,
                // Map common fields
                date: data.relatorio.data,
                number: data.relatorio.numero,
                siteName: data.relatorio.obra
            }
        };
    },

    processData(fullText: string, p1Text: string, pagesData: any[], filename: string): ExtractedData {
        let type: 'BM' | 'RDO' | 'UNKNOWN' = 'UNKNOWN';
        if (filename.includes('BM') || fullText.includes('BOLETIM DE MEDIÇÃO') || fullText.includes('MEDIÇÃO DE OBRAS')) {
            type = 'BM';
        } else if (filename.includes('RDO') || fullText.includes('RELATÓRIO DIÁRIO') || fullText.includes('Diário de Obra') || fullText.includes('Relatório Diário')) {
            type = 'RDO';
        }

        if (type === 'RDO') {
            // Construct a single lists of lines for RDO parsing from Page 1 (Main tables)
            const p1Items = pagesData[0].items;
            const linesY: Record<number, any[]> = {};
            for (const w of p1Items) {
                const yKey = Math.round(w.y / 2) * 2;
                if (!linesY[yKey]) linesY[yKey] = [];
                linesY[yKey].push(w);
            }
            return this.processRDOData(fullText, linesY);
        }

        const dados: any = {
            arquivo: filename,
            contrato: "",
            contratada: "",
            data_emissao: "",
            periodo: "",
            valor_medicao_cabecalho: 0.0,
            itens: [],
            total_extraido: 0.0
        };

        // 1. Contrato
        const matchContrato = p1Text.match(/Contrato N\.º\s+(\d+)/i) || p1Text.match(/(\d{10})/);
        if (matchContrato) dados.contrato = matchContrato[1];

        // 2. Contratada
        // Python: re.search(r'\d{10}\s+(.*?)\s+EQUIPAMENTOS', p1_text)
        const matchContratada = p1Text.match(/\d{10}\s+(.*?)\s+EQUIPAMENTOS/i);
        if (matchContratada) {
            dados.contratada = matchContratada[1] + " EQUIPAMENTOS";
        } else {
            dados.contratada = "Não identificado";
        }

        // 3. Data
        const matchData = p1Text.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/i);
        // Note: The python script had multiline support regex `\s*[\r\n]*\s*`, JS regex handles this if we use appropriate flags or just on p1Text (which is flat space joined).
        if (matchData) {
            dados.data_emissao = matchData[1];
        } else {
            // Fallback spatial check (Top Right: X > 600, Y High)
            // Need to look at Page 1 Items again.
            const p1Items = pagesData[0].items;
            for (const w of p1Items) {
                // PDFJS Y is Bottom-Up. Page height is roughly 842 (A4). Top > 680 (160 from top).
                // X > 600.
                if (w.x0 > 600 && w.y > 600) { // Rough guess for Y > 600 (top part)
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(w.text.trim())) {
                        dados.data_emissao = w.text.trim();
                        break;
                    }
                }
            }
        }

        // 4. Período
        const matchPeriodo = p1Text.match(/(\d{2}\/\d{2}\/\d{4}\s+a\s+\d{2}\/\d{2}\/\d{4})/);
        if (matchPeriodo) dados.periodo = matchPeriodo[1];

        // 5. Valor Cabeçalho
        const matchValor = fullText.match(/Valor desta medição \(R\$\):\s*R\$\s*([\d\.\s]+,\d{2})/i);
        if (matchValor) {
            dados.valor_medicao_cabecalho = this.limparValor(matchValor[1]);
        }

        // 6. ITENS (Spatial Logic)
        for (const page of pagesData) {
            const words = page.items;

            // Group by Y (Line grouping)
            // Python: `y = round(w['top'] / 5) * 5`.
            // PDFJS: `y` is float. We can round to nearest 5 or similar tolerance.
            // Since PDFJS Y is inverted, we use Math.round(w.y / 5) * 5.
            const linesY: Record<number, any[]> = {};
            for (const w of words) {
                const yKey = Math.round(w.y / 2) * 2; // Tighter tolerance (2) might be better, but let's stick to concept.
                // Python used 5 on 'top'. 
                if (!linesY[yKey]) linesY[yKey] = [];
                linesY[yKey].push(w);
            }

            // Sort Lines (Top to Bottom -> High Y to Low Y)
            const sortedYs = Object.keys(linesY).map(Number).sort((a, b) => b - a);

            for (const y of sortedYs) {
                const linhaPalavras = linesY[y].sort((a, b) => a.x0 - b.x0);
                if (linhaPalavras.length === 0) continue;

                // Check ITEM string start (number.number) at X < 60
                const primeira = linhaPalavras[0];
                if (primeira.x0 < 60 && /^\d+\.\d+$/.test(primeira.text.trim())) {

                    const itemObj: any = {
                        codeVLI: "",
                        description: "",
                        unidade: "",
                        // ... cols
                    };

                    // Extract Description & Unit
                    const textosDesc: string[] = [];
                    for (const w of linhaPalavras) {
                        const cx = (w.x0 + w.x1) / 2;
                        if (cx > 60 && cx < 320) {
                            textosDesc.push(w.text);
                        } else if (cx > 325 && cx < 350) {
                            itemObj.unidade = w.text;
                        }
                    }
                    const fullDesc = textosDesc.join(" ");

                    const matchCod = fullDesc.match(/(S\.VP[I]?-\d+)\s*(.*)/);
                    if (matchCod) {
                        itemObj.codeVLI = matchCod[1];
                        itemObj.description = matchCod[2];
                    } else {
                        itemObj.description = fullDesc;
                    }

                    // Extract Columns
                    // Iterate keys of COLS
                    for (const [colKey, range] of Object.entries(COLS)) {
                        // range is [xmin, xmax]
                        // We map these keys to our interface keys
                        let mappedKey = colKey;
                        // Mapping python keys to our TS interface if needed
                        // For now we store raw, then map at end.
                        const val = this.extrairValorColuna(linhaPalavras, range[0], range[1]);
                        itemObj[colKey] = val;
                    }

                    // Map specific keys to our AuditMatrix format
                    const auditItem = {
                        item: primeira.text, // "3.1", "3.2" etc
                        codeVLI: itemObj.codeVLI,
                        description: itemObj.description,
                        unit: itemObj.unidade,
                        unitPrice: itemObj['preco_unitario'] || 0,
                        prevAccumulated: itemObj['valor_anterior'] || 0,
                        currentMonth: itemObj['valor_mes'] || 0,
                        totalAccumulated: itemObj['valor_acumulado'] || 0,
                        plannedContract: itemObj['valor_contrato'] || 0,
                        balance: itemObj['saldo'] || 0
                    };

                    dados.itens.push(auditItem);
                }
            }
        }

        const total = dados.itens.reduce((acc: number, item: any) => acc + item.currentMonth, 0);
        dados.total_extraido = Math.round(total * 100) / 100;

        console.log("Extracted Data:", dados);

        return {
            type: 'BM',
            rawText: fullText,
            confidence: dados.itens.length > 0 ? 0.9 : 0.0,
            fields: {
                contractId: dados.contrato,
                contractor: dados.contratada,
                date: dados.data_emissao,
                period: dados.periodo,
                value: dados.valor_medicao_cabecalho || dados.total_extraido,
                totalExtraido: dados.total_extraido,
                auditMatrix: dados.itens,
                // Pass processed items as auditMatrix
                entityType: dados.contratada.toUpperCase().includes('RENTAL') ? 'RENTAL' : 'CONSTRUTORA'
            }
        };
    },

    extrairValorColuna(words: any[], xMin: number, xMax: number): number {
        const candidatos: string[] = [];
        for (const w of words) {
            const xCentro = (w.x0 + w.x1) / 2;
            if (xCentro >= xMin && xCentro <= xMax) {
                candidatos.push(w.text);
            }
        }
        if (candidatos.length === 0) return 0.0;

        const textoCompleto = candidatos.join("");
        return this.limparValor(textoCompleto);
    },

    limparValor(texto: string): number {
        if (!texto) return 0.0;
        if (texto.includes('%')) return 0.0; // Ignore Percentages

        let limpo = texto.replace(/[^\d,\.-]/g, ''); // Keep digits, comma, dot, minus
        if (!limpo) return 0.0;

        const ehNegativo = texto.includes('-') || texto.includes('(');
        limpo = limpo.replace(/-/g, '').replace(/\(/g, '').replace(/\)/g, '');

        if (limpo.includes(',')) {
            limpo = limpo.replace(/\./g, ''); // Remove thousands separator
            limpo = limpo.replace(/,/g, '.'); // Swap decimal comma to dot
        }

        try {
            const val = parseFloat(limpo);
            return ehNegativo ? -val : val;
        } catch {
            return 0.0;
        }
    }
};
