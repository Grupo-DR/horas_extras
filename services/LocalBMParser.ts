import * as pdfjsLib from 'pdfjs-dist';
import { ImportedData, ExtractedBM, ExtractedRDO, BMItem, RDOAtividade, RDOClimaPeriodo, RDOMaoDeObra } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const COLS = {
    // Spatial mapping for PDF Extraction
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

export const LocalBMParser = {
    async parsePDF(file: File): Promise<ImportedData> {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;

        let fullText = '';
        let p1Text = '';
        const pagesData: Array<{ items: any[], text: string }> = [];

        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();

            const items = (textContent.items as any[]).map(item => ({
                text: item.str,
                x0: item.transform[4],
                x1: item.transform[4] + item.width,
                y: item.transform[5],
                height: item.height
            }));

            const sortedForText = [...items].sort((a, b) => b.y - a.y || a.x0 - b.x0);
            const pageRawText = sortedForText.map(i => i.text).join(' ');

            if (i === 1) p1Text = pageRawText;
            fullText += pageRawText + '\n';
            pagesData.push({ items, text: pageRawText });
        }

        return this.processData(fullText, p1Text, pagesData, file.name);
    },

    processRDOData(fullText: string, lines: Record<number, any[]>, filename: string): ExtractedRDO {
        const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a);

        // Initial Empty Structure
        const rdo: ExtractedRDO = {
            filename: filename,
            type: 'RDO', // HELPER TAG
            relatorio: {
                numero: "", data: "", dia_semana: "", contrato: "", obra: ""
            },
            horario_trabalho: { entrada_saida: "", horas_trabalhadas: "" },
            clima: { manha: { tempo: "", condicao: "" }, tarde: { tempo: "", condicao: "" } },
            mao_de_obra: [],
            equipamentos: [],
            atividades: [],
            ocorrencias: [],
            comentarios: []
        };

        const findVal = (regex: RegExp, text: string) => {
            const match = text.match(regex);
            return match ? match[1].trim() : "";
        };

        // 1. Header Logic
        rdo.relatorio.numero = findVal(/Relatório n[º°]\s*(\d+)/i, fullText);
        rdo.relatorio.data = findVal(/Data do relatório\s*([\d\/]+)/i, fullText);
        rdo.relatorio.contrato = findVal(/Contrato\s*([A-Z0-9]+)/i, fullText);

        // 2. Section Parsing (Simplified for now - can be expanded with specific regex per section)
        // ... (keeping existing logic structure but mapped to new types)

        let currentSection: 'NONE' | 'CLIMA' | 'MAO_DE_OBRA' | 'EQUIPAMENTOS' | 'ATIVIDADES' | 'OCORRENCIAS' | 'COMENTARIOS' = 'NONE';

        for (const y of sortedYs) {
            const lineItems = lines[y].sort((a, b) => a.x0 - b.x0);
            const lineText = lineItems.map(i => i.text).join(" ").trim();
            const upperLine = lineText.toUpperCase();

            // Detect Sections
            if (upperLine.includes("CLIMA") && upperLine.includes("MANHÃ")) { currentSection = 'CLIMA'; continue; }
            if (upperLine.includes("MÃO DE OBRA") || (upperLine.includes("NOME") && upperLine.includes("FUNÇÃO"))) { currentSection = 'MAO_DE_OBRA'; continue; }
            if (upperLine.includes("EQUIPAMENTOS") || (upperLine.includes("DESCRIÇÃO") && upperLine.includes("HORÍMETRO"))) { currentSection = 'EQUIPAMENTOS'; continue; }
            if (upperLine.includes("ATIVIDADES") || upperLine.includes("SERVIÇOS EXECUTADOS")) { currentSection = 'ATIVIDADES'; continue; }
            if (upperLine.includes("OCORRÊNCIAS")) { currentSection = 'OCORRENCIAS'; continue; }
            if (upperLine.includes("COMENTÁRIOS") || upperLine.includes("OBSERVAÇÕES")) { currentSection = 'COMENTARIOS'; continue; }

            if (currentSection === 'MAO_DE_OBRA') {
                if (upperLine.startsWith("NOME") || lineText.length < 5) continue;
                // Basic Line Storage for now or Regex Split
                rdo.mao_de_obra.push({
                    nome: lineText, // Placeholder parsing
                    funcao: "",
                    entrada_saida: "",
                    intervalo: "",
                    horas: ""
                });
            } else if (currentSection === 'EQUIPAMENTOS') {
                if (upperLine.startsWith("DESCRIÇÃO") || lineText.length < 5) continue;
                rdo.equipamentos.push(lineText);
            } else if (currentSection === 'ATIVIDADES') {
                if (upperLine.startsWith("DESCRIÇÃO") || lineText.length < 5) continue;
                rdo.atividades.push({ descricao: lineText, unidade: "", status: "" });
            } else if (currentSection === 'OCORRENCIAS') {
                rdo.ocorrencias.push(lineText);
            } else if (currentSection === 'COMENTARIOS') {
                rdo.comentarios.push(lineText);
            }
        }

        return rdo;
    },

    processData(fullText: string, p1Text: string, pagesData: any[], filename: string): ImportedData {
        let isBM = false;
        if (filename.includes('BM') || fullText.includes('BOLETIM DE MEDIÇÃO') || fullText.includes('MEDIÇÃO DE OBRAS')) {
            isBM = true;
        }

        if (!isBM) {
            // RDO Logic
            const p1Items = pagesData[0].items;
            const linesY: Record<number, any[]> = {};
            for (const w of p1Items) {
                const yKey = Math.round(w.y / 2) * 2;
                if (!linesY[yKey]) linesY[yKey] = [];
                linesY[yKey].push(w);
            }
            return this.processRDOData(fullText, linesY, filename);
        }

        // BM Logic
        const dados: ExtractedBM = {
            arquivo: filename,
            contrato: "",
            contratada: "",
            data_emissao: "",
            periodo: "",
            valor_medicao_cabecalho: 0.0,
            itens: [],
            total_extraido: 0.0,
            type: 'BM'
        };

        const matchContrato = p1Text.match(/Contrato N\.º\s+(\d+)/i) || p1Text.match(/(\d{10})/);
        if (matchContrato) dados.contrato = matchContrato[1];

        const matchContratada = p1Text.match(/\d{10}\s+(.*?)\s+EQUIPAMENTOS/i);
        dados.contratada = matchContratada ? matchContratada[1] + " EQUIPAMENTOS" : "Não identificado";

        const matchData = p1Text.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/i);
        if (matchData) dados.data_emissao = matchData[1];

        const matchPeriodo = p1Text.match(/(\d{2}\/\d{2}\/\d{4}\s+a\s+\d{2}\/\d{2}\/\d{4})/);
        if (matchPeriodo) dados.periodo = matchPeriodo[1];

        const matchValor = fullText.match(/Valor desta medição \(R\$\):\s*R\$\s*([\d\.\s]+,\d{2})/i);
        if (matchValor) dados.valor_medicao_cabecalho = this.limparValor(matchValor[1]);

        // Process Items (Spatial)
        for (const page of pagesData) {
            const words = page.items;
            const linesY: Record<number, any[]> = {};
            for (const w of words) {
                const yKey = Math.round(w.y / 2) * 2;
                if (!linesY[yKey]) linesY[yKey] = [];
                linesY[yKey].push(w);
            }
            const sortedYs = Object.keys(linesY).map(Number).sort((a, b) => b - a);

            for (const y of sortedYs) {
                const lineWords = linesY[y].sort((a, b) => a.x0 - b.x0);
                if (lineWords.length === 0) continue;

                const first = lineWords[0];
                if (first.x0 < 60 && /^\d+\.\d+$/.test(first.text.trim())) {
                    const item: BMItem = {
                        item: first.text,
                        codigo: "",
                        descricao: "",
                        unidade: "",
                        preco_unitario: 0,
                        qtd_contrato: 0, qtd_anterior: 0, qtd_mes: 0, qtd_acumulado: 0,
                        valor_contrato: 0, valor_anterior: 0, valor_mes: 0, valor_acumulado: 0,
                        saldo: 0
                    };

                    // Description Logic
                    const descWords: string[] = [];
                    for (const w of lineWords) {
                        const cx = (w.x0 + w.x1) / 2;
                        if (cx > 60 && cx < 320) descWords.push(w.text);
                        else if (cx > 325 && cx < 350) item.unidade = w.text;
                    }
                    const fullDesc = descWords.join(" ");
                    const matchCod = fullDesc.match(/(S\.VP[I]?-\d+)\s*(.*)/);
                    if (matchCod) {
                        item.codigo = matchCod[1];
                        item.descricao = matchCod[2];
                    } else {
                        item.descricao = fullDesc;
                    }

                    // Columns Logic
                    for (const [colKey, range] of Object.entries(COLS)) {
                        const val = this.extrairValorColuna(lineWords, range[0], range[1]);
                        (item as any)[colKey] = val; // TS dynamic assignment
                    }
                    dados.itens.push(item);
                }
            }
        }

        const total = dados.itens.reduce((acc, item) => acc + item.valor_mes, 0);
        dados.total_extraido = Math.round(total * 100) / 100;

        return dados;
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
        return this.limparValor(candidatos.join(""));
    },

    limparValor(texto: string): number {
        if (!texto) return 0.0;
        if (texto.includes('%')) return 0.0;
        let limpo = texto.replace(/[^\d,\.-]/g, '');
        if (!limpo) return 0.0;
        const ehNegativo = texto.includes('-') || texto.includes('(');
        limpo = limpo.replace(/-/g, '').replace(/\(/g, '').replace(/\)/g, '');
        if (limpo.includes(',')) {
            limpo = limpo.replace(/\./g, '').replace(/,/g, '.');
        }
        try {
            const val = parseFloat(limpo);
            return ehNegativo ? -val : val;
        } catch {
            return 0.0;
        }
    }
};
