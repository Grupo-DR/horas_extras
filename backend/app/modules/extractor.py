from typing import List, Any
from app.modules.loader import SheetGrid
from app.modules.layout import LayoutAnalyzer
from app.modules.validator import Validator
from app.schemas import ParsedBM, BMItem, BMMeta, BMTotals, FieldEvidence, SourceCell

class Extractor:
    def __init__(self, grid: SheetGrid):
        self.grid = grid
        self.analyzer = LayoutAnalyzer(grid)
        
    def _get_val(self, r: int, c: int) -> Any:
        # Check merges
        # In SheetGrid (from loader), we already cleared merged cells except top-left
        # But if we are querying a cell that IS hidden, we should perhaps return the top-left value?
        # The prompt says: "comportamento de merges (somente célula superior esquerda tem valor; as demais são vazias)"
        # So raw grid usage is correct.
        if 0 <= r < self.grid.n_rows and 0 <= c < self.grid.n_cols:
            return self.grid.grid[r][c]
        return None

    def extract(self) -> ParsedBM:
        # 1. Analyze Layout
        layout = self.analyzer.analyze()
        
        # 2. Extract Items
        items = []
        col_map = layout.column_map
        
        # Current Item Context (for description aggregation if multi-line)
        last_item: BMItem = None
        
        for r in range(layout.table_start_row, layout.table_end_row):
            # Check Item Code
            code_col = col_map["item_code"].col
            raw_code = self._get_val(r, code_col) if code_col is not None else None
            
            desc_col = col_map["descricao"].col
            raw_desc = self._get_val(r, desc_col) if desc_col is not None else None
            
            # Helper to extract field
            def extract_field(field_name: str, normalize_num=False) -> FieldEvidence:
                c_idx = col_map[field_name].col
                if c_idx is None:
                    return FieldEvidence(value=None, confidence=0.0)
                val = self._get_val(r, c_idx)
                if normalize_num:
                    val = Validator.normalize_number(val)
                return FieldEvidence(
                    value=val,
                    source_cells=[SourceCell(r=r, c=c_idx, sheet=self.grid.sheet_name)],
                    confidence=col_map[field_name].confidence
                )

            if raw_code and str(raw_code).strip() != "":
                # New Item
                item = BMItem(
                    item_code=extract_field("item_code"),
                    descricao=extract_field("descricao"),
                    previsto_contrato=extract_field("previsto_contrato", True),
                    saldo=extract_field("saldo", True),
                    exec_percent=extract_field("exec_percent", True),
                    medicao_mes=extract_field("medicao_mes", True),
                    medicao_acumulada=extract_field("medicao_acumulada", True),
                    valor_unitario=extract_field("valor_unitario", True),
                    valor_total_item=extract_field("valor_total_item", True)
                )
                items.append(item)
                last_item = item
            elif raw_desc and str(raw_desc).strip() != "" and last_item:
                # Continuation of description?
                # If code is empty but description is not, append to last item
                current_desc = last_item.descricao.value or ""
                last_item.descricao.value = f"{current_desc} {raw_desc}".strip()
                last_item.descricao.source_cells.append(SourceCell(r=r, c=desc_col, sheet=self.grid.sheet_name))
        
        # 3. Extract Metadata (Placeholder logic for now)
        meta = BMMeta(
            contract_number=FieldEvidence(value=None),
            bm_date=FieldEvidence(value=None),
            competency=FieldEvidence(value=None),
            title=FieldEvidence(value=None)
        )
        
        # 4. Extract Totals (Placeholder)
        totals = BMTotals(
            executed_month=FieldEvidence(value=None),
            executed_total=FieldEvidence(value=None),
            remaining_total=FieldEvidence(value=None)
        )

        bm = ParsedBM(
            bm_meta=meta,
            layout=layout,
            items=items,
            totals=totals
        )
        
        # 5. Validate
        bm = Validator.validate(bm)
        
        return bm
