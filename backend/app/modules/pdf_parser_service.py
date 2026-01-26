import pdfplumber
import re
import math
from typing import Dict, Any, List

# --- BM CONSTANTS ---
BM_COLS = {
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
}

class PDFParserService:
    
    @staticmethod
    def parse_pdf(file_bytes, filename: str) -> Dict[str, Any]:
        """
        Detects if BM or RDO and routes to specific parser.
        """
        # Determine type based on filename or content detection
        # Simple filename check first
        is_rdo = "RDO" in filename.upper() or "RELATÓRIO" in filename.upper()
        
        # We can also check first page content
        with pdfplumber.open(file_bytes) as pdf:
            first_page_text = pdf.pages[0].extract_text() or ""
            if "DIÁRIO DE OBRA" in first_page_text.upper():
                is_rdo = True
            elif "MEDIÇÃO" in first_page_text.upper() or "BOLETIM" in first_page_text.upper():
                is_rdo = False

        if is_rdo:
            return PDFParserService.extract_rdo_data(file_bytes, filename)
        else:
            return PDFParserService.extract_bm_data(file_bytes, filename)

    @staticmethod
    def extract_bm_data(file_bytes, filename: str) -> Dict[str, Any]:
        data = {
            "arquivo": filename,
            "type": "BM",
            "contrato": "",
            "contratada": "",
            "data_emissao": "",
            "periodo": "",
            "valor_medicao_cabecalho": 0.0,
            "itens": [],
            "total_extraido": 0.0
        }

        with pdfplumber.open(file_bytes) as pdf:
            p1 = pdf.pages[0]
            p1_text = p1.extract_text()
            full_text = "\n".join([p.extract_text() or "" for p in pdf.pages])
            
            # --- HEADER EXTRACTION ---
            # 1. Contrato
            match_contrato = re.search(r'Contrato N\.º\s+(\d+)', p1_text, re.IGNORECASE) or re.search(r'(\d{10})', p1_text)
            if match_contrato:
                data["contrato"] = match_contrato.group(1)

            # 2. Contratada
            match_contratada = re.search(r'\d{10}\s+(.*?)\s+EQUIPAMENTOS', p1_text, re.IGNORECASE)
            if match_contratada:
                data["contratada"] = match_contratada.group(1) + " EQUIPAMENTOS"
            else:
                data["contratada"] = "Não identificado"

            # 3. Data
            match_data = re.search(r'Data:\s*(\d{2}/\d{2}/\d{4})', p1_text, re.IGNORECASE)
            if match_data:
                data["data_emissao"] = match_data.group(1)

            # 4. Periodo
            match_periodo = re.search(r'(\d{2}/\d{2}/\d{4}\s+a\s+\d{2}/\d{2}/\d{4})', p1_text)
            if match_periodo:
                data["periodo"] = match_periodo.group(1)

            # 5. Valor Cabecalho
            match_valor = re.search(r'Valor desta medição \(R\$\):\s*R\$\s*([\d\.\s]+,\d{2})', full_text, re.IGNORECASE)
            if match_valor:
                data["valor_medicao_cabecalho"] = PDFParserService._clean_value(match_valor.group(1))

            # --- ITEMS EXTRACTION (SPATIAL) ---
            for page in pdf.pages:
                words = page.extract_words()
                
                # Group by Y (Row detection) using tolerance
                # pdfplumber 'top' is distance from top.
                lines = {}
                for w in words:
                    # Rounding to nearest 2 pixels to group items on same line
                    y = int(round(w['top'] / 2) * 2) 
                    if y not in lines:
                        lines[y] = []
                    lines[y].append(w)

                sorted_ys = sorted(lines.keys())

                for y in sorted_ys:
                    line_words = sorted(lines[y], key=lambda x: x['x0'])
                    if not line_words: continue

                    first_word = line_words[0]
                    # Check if line starts with Item Number (digit.digit) at X < 60
                    if first_word['x0'] < 60 and re.match(r'^\d+\.\d+$', first_word['text']):
                        
                        item = {
                            "item": first_word['text'],
                            "codeVLI": "",
                            "description": "",
                            "unidade": "",
                            "preco_unitario": 0.0,
                            # Quantities
                            "qtyContract": 0.0,
                            "qtyPrev": 0.0,
                            "qtyMonth": 0.0,
                            "qtyAccumulated": 0.0,
                            # Values
                            "prevAccumulated": 0.0,
                            "currentMonth": 0.0,
                            "totalAccumulated": 0.0,
                            "plannedContract": 0.0,
                            "balance": 0.0
                        }

                        # Extract Description & Unit
                        desc_words = []
                        for w in line_words:
                            cx = (w['x0'] + w['x1']) / 2
                            if 60 < cx < 320:
                                desc_words.append(w['text'])
                            elif 325 < cx < 350:
                                item["unidade"] = w['text']
                        
                        full_desc = " ".join(desc_words)
                        match_cod = re.match(r'(S\.VP[I]?-\d+)\s*(.*)', full_desc)
                        if match_cod:
                            item["codeVLI"] = match_cod.group(1)
                            item["description"] = match_cod.group(2)
                        else:
                            item["description"] = full_desc

                        # Extract Columns based on Constants
                        # Helper to extract value from range
                        def get_col_val(x_min, x_max):
                            vals = [w['text'] for w in line_words if x_min <= (w['x0'] + w['x1'])/2 <= x_max]
                            return PDFParserService._clean_value("".join(vals)) if vals else 0.0

                        item["preco_unitario"] = get_col_val(*BM_COLS["preco_unitario"])
                        item["qtyContract"] = get_col_val(*BM_COLS["qtd_contrato"])
                        item["qtyPrev"] = get_col_val(*BM_COLS["qtd_anterior"])
                        item["qtyMonth"] = get_col_val(*BM_COLS["qtd_mes"])
                        item["qtyAccumulated"] = get_col_val(*BM_COLS["qtd_acumulado"])
                        
                        item["prevAccumulated"] = get_col_val(*BM_COLS["valor_anterior"])
                        item["currentMonth"] = get_col_val(*BM_COLS["valor_mes"])
                        item["totalAccumulated"] = get_col_val(*BM_COLS["valor_acumulado"])
                        item["plannedContract"] = get_col_val(*BM_COLS["valor_contrato"])
                        item["balance"] = get_col_val(*BM_COLS["saldo"])

                        data["itens"].append(item)

        total = sum(i["currentMonth"] for i in data["itens"])
        data["total_extraido"] = round(total, 2)
        
        # Map to Generic Fields expected by Frontend
        data["fields"] = {
            "contractId": data["contrato"],
            "contractor": data["contratada"],
            "date": data["data_emissao"],
            "period": data["periodo"],
            "value": data["valor_medicao_cabecalho"] or data["total_extraido"],
            "totalExtraido": data["total_extraido"],
            "auditMatrix": data["itens"],
            "entityType": "RENTAL" if "RENTAL" in data["contratada"].upper() else "CONSTRUTORA"
        }
        
        return data

    @staticmethod
    def extract_rdo_data(file_bytes, filename: str) -> Dict[str, Any]:
        data = {"filename": filename, "type": "RDO"}
        
        with pdfplumber.open(file_bytes) as pdf:
            page = pdf.pages[0]
            # Try table extraction first as per user script
            tables = page.extract_tables()
            
            # If tables found, use user's logic
            if tables:
                header_info = {}
                t0 = tables[0] if len(tables) > 0 else []
                flat_t0 = [str(cell) for row in t0 for cell in row if cell]

                def find_val(key_list, search_space, offset=1):
                    for i, item in enumerate(search_space):
                        if item and any(k in item for k in key_list):
                            if i + offset < len(search_space):
                                return search_space[i+offset]
                    return None

                header_info["numero"] = find_val(["Relatório n°", "Relatório nº"], flat_t0)
                header_info["data"] = find_val(["Data do relatório"], flat_t0)
                header_info["dia_semana"] = find_val(["Dia da semana"], flat_t0)
                header_info["contrato"] = find_val(["Contrato"], flat_t0)
                header_info["obra"] = find_val(["Obra"], flat_t0)
                
                data["relatorio"] = header_info

                # --- Work Hours ---
                t1 = tables[1] if len(tables) > 1 else []
                if len(t1) > 1:
                    row = t1[1]
                    data["horario_trabalho"] = {
                        "entrada_saida": row[1] if len(row) > 1 else None,
                        "horas_trabalhadas": row[2] if len(row) > 2 else None
                    }

                # --- Clima ---
                t2 = tables[2] if len(tables) > 2 else []
                clima = {}
                if len(t2) > 1:
                    clima["manha"] = {"tempo": t2[1][1], "condicao": t2[1][2]} if len(t2[1]) > 2 else {}
                if len(t2) > 2:
                    clima["tarde"] = {"tempo": t2[2][1], "condicao": t2[2][2]} if len(t2[2]) > 2 else {}
                data["clima"] = clima

                # --- Mao de Obra ---
                t3 = tables[3] if len(tables) > 3 else []
                labor = []
                # Header rows 0,1 usually. Data starts row 2.
                for row in t3[2:]:
                    if not row or not row[0]: continue
                    labor.append({
                        "nome": row[0],
                        "funcao": row[1],
                        "entrada_saida": row[2],
                        "intervalo": row[3],
                        "horas": row[4]
                    })
                data["mao_de_obra"] = labor

                # --- Equipamentos ---
                t4 = tables[4] if len(tables) > 4 else []
                equipments = []
                if len(t4) > 1:
                    # Sometimes data is just in the detected columns
                    for cell in t4[1]:
                        if cell and cell != "None":
                            equipments.append(cell.replace('\n', ' '))
                data["equipamentos"] = equipments

                # --- Atividades ---
                t5 = tables[5] if len(tables) > 5 else []
                activities = []
                if len(t5) > 1:
                    # First row of data
                    if t5[1][0]:
                        activities.append({
                            "descricao": t5[1][0].replace('\n', ' '),
                            "unidade": t5[1][1] if len(t5[1]) > 1 else "",
                            "status": t5[1][2] if len(t5[1]) > 2 else ""
                        })
                    # Subsequent rows
                    for row in t5[2:]:
                        if row[0]:
                            activities.append({
                                "descricao": row[0].replace('\n', ' '),
                                "unidade": row[1] if len(row) > 1 else "",
                                "status": row[2] if len(row) > 2 else ""
                            })
                data["atividades"] = activities

                # --- Ocorrencias ---
                t6 = tables[6] if len(tables) > 6 else []
                occurrences = []
                if len(t6) > 1:
                    for row in t6[1:]:
                        if row[0]: occurrences.append(row[0].replace('\n', ' '))
                data["ocorrencias"] = occurrences

                # --- Comentarios ---
                t7 = tables[7] if len(tables) > 7 else []
                comments = []
                if len(t7) > 1:
                     for row in t7[1:]:
                        if row[0]: comments.append(row[0].replace('\n', ' '))
                data["comentarios"] = comments

            else:
                # Fallback if no tables (use raw text heuristics or empty)
                data["error"] = "No tables found in RDO"

        # Map to Generic Fields
        data["fields"] = {
            "date": data.get("relatorio", {}).get("data"),
            "number": data.get("relatorio", {}).get("numero"),
            "siteName": data.get("relatorio", {}).get("obra"),
            "rdoDetails": data
        }

        return data

    @staticmethod
    def _clean_value(text: str) -> float:
        if not text: return 0.0
        if '%' in text: return 0.0
        
        # Remove anything except digits, comma, dot, minus
        clean = re.sub(r'[^\d,\.-]', '', text)
        if not clean: return 0.0
        
        is_negative = '-' in text or '(' in text
        clean = clean.replace('-', '').replace('(', '').replace(')', '')
        
        # Handle 1.000,00 structure
        if ',' in clean:
            clean = clean.replace('.', '') # Remove thousands dot
            clean = clean.replace(',', '.') # Convert decimal comma
        
        try:
            val = float(clean)
            return -val if is_negative else val
        except:
            return 0.0
