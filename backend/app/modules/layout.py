from typing import List, Dict, Tuple, Optional, Any
import re
from rapidfuzz import process, fuzz
from app.modules.loader import SheetGrid
from app.schemas import BMLayout, ColumnMapItem

class LayoutAnalyzer:
    def __init__(self, grid: SheetGrid):
        self.grid = grid
        self.n_rows = grid.n_rows
        self.n_cols = grid.n_cols
        
    def _get_val(self, r: int, c: int) -> Any:
        if 0 <= r < self.n_rows and 0 <= c < self.n_cols:
            return self.grid.grid[r][c]
        return None

    def analyze(self) -> BMLayout:
        # 1. Detect Header Row and Column Map
        header_row_idx, column_map = self._detect_columns()
        
        # 2. Detect Table Start/End
        table_start, table_end = self._detect_table_range(header_row_idx, column_map)
        
        return BMLayout(
            table_start_row=table_start,
            table_end_row=table_end,
            header_rows=[header_row_idx] if header_row_idx != -1 else [],
            column_map=column_map
        )

    def _detect_columns(self) -> Tuple[int, Dict[str, ColumnMapItem]]:
        # Required columns keywords
        target_columns = {
            "item_code": ["ITEM", "CODIGO", "ITEM Nº", "CÓDIGO"],
            "descricao": ["DESCRIÇÃO", "DISCRIMINAÇÃO", "SERVIÇO", "DESCRIÇÃO DOS SERVIÇOS"],
            "previsto_contrato": ["PREVISTO", "CONTRATO", "VALOR CONTRATUAL", "QUANTIDADE CONTRATUAL"],
            "saldo": ["SALDO", "A MEDIR", "SALDO A MEDIR"],
            "exec_percent": ["EXEC", "%", "EXECUÇÃO", "PERC", "% ACUM"],
            "medicao_mes": ["MEDIÇÃO", "MÊS", "VALOR MEDIDO", "QTD MEDIDA"],
            "medicao_acumulada": ["ACUMULADO", "TOTAL MEDIDO"],
            "valor_unitario": ["UNITÁRIO", "VALOR UNIT"],
            "valor_total_item": ["VALOR TOTAL", "PREÇO TOTAL"]
        }
        
        best_row_score = -1
        best_row_idx = -1
        best_map = {}

        # Scan first 50 rows for header
        for r in range(min(50, self.n_rows)):
            row_values = []
            for c in range(self.n_cols):
                val = self._get_val(r, c)
                if isinstance(val, str):
                    row_values.append((c, val))
            
            if not row_values:
                continue
                
            # Try to map targets to this row
            current_map = {}
            row_matches = 0
            
            for field, keywords in target_columns.items():
                # Find best match in row
                best_match = None
                best_score = 0
                
                for c, val in row_values:
                    # check against all keywords
                    score = process.extractOne(val.upper(), keywords, scorer=fuzz.partial_ratio)
                    if score and score[1] > 60: # Threshold
                         if score[1] > best_score:
                             best_score = score[1]
                             best_match = (c, val, score[1])
                
                if best_match:
                    current_map[field] = ColumnMapItem(
                        col=best_match[0],
                        label=best_match[1],
                        confidence=best_match[2] / 100.0
                    )
                    row_matches += 1
                else:
                    # Field not found in this row
                    current_map[field] = ColumnMapItem(col=None, label="", confidence=0.0)

            # Heuristic: A good header row usually has ITEM and DESCRIPTION and at least one numerical column
            has_core = (current_map["item_code"].col is not None and 
                        current_map["descricao"].col is not None)
            
            if has_core and row_matches > best_row_score:
                best_row_score = row_matches
                best_row_idx = r
                best_map = current_map

        return best_row_idx, best_map

    def _detect_table_range(self, header_row: int, col_map: Dict[str, ColumnMapItem]) -> Tuple[int, int]:
        if header_row == -1:
            return 0, 0
            
        start_row = header_row + 1
        item_col = col_map["item_code"].col
        
        # Refine start row: look for first regex match of item code
        # Regex: Digit + dot + digit...
        item_regex = re.compile(r"^\d+(\.\d+)+")
        
        real_start = start_row
        if item_col is not None:
            for r in range(start_row, min(start_row + 10, self.n_rows)):
                val = str(self._get_val(r, item_col) or "").strip()
                if item_regex.match(val):
                    real_start = r
                    break
        
        # Detect end row: "TOTAL" OR many empty lines
        current_row = real_start
        empty_count = 0
        
        # Look for "TOTAL" in description column or just generally stop at end
        desc_col = col_map["descricao"].col
        
        for r in range(current_row, self.n_rows):
            # Check for TOTAL
            found_total = False
            row_str = ""
            for c in range(self.n_cols):
                val = str(self._get_val(r, c) or "").upper()
                row_str += val
                if "TOTAL" in val:
                    found_total = True
            
            if found_total and "GERAL" in row_str: # TOTAL GERAL often ends table
                return real_start, r

            # Check if row is mostly empty (naive)
            is_empty = all(self._get_val(r, c) is None for c in range(self.n_cols))
            if is_empty:
                empty_count += 1
            else:
                empty_count = 0
            
            if empty_count > 5: # 5 consecutive empty rows -> end
                return real_start, r - 5
                
        return real_start, self.n_rows
