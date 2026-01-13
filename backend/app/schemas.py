from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class GridCell(BaseModel):
    value: Any
    r: int
    c: int

class SourceCell(BaseModel):
    r: int
    c: int
    sheet: Optional[str] = None

class FieldEvidence(BaseModel):
    value: Any
    source_cells: List[SourceCell] = []
    confidence: float = 1.0
    notes: Optional[str] = None

class BMMeta(BaseModel):
    contract_number: FieldEvidence
    bm_date: FieldEvidence
    competency: FieldEvidence
    title: FieldEvidence

class BMItem(BaseModel):
    item_code: FieldEvidence
    descricao: FieldEvidence
    previsto_contrato: FieldEvidence
    saldo: FieldEvidence
    exec_percent: FieldEvidence
    medicao_mes: FieldEvidence
    medicao_acumulada: FieldEvidence
    valor_unitario: FieldEvidence
    valor_total_item: FieldEvidence
    extra_fields: Dict[str, Any] = {}

class BMTotals(BaseModel):
    executed_month: FieldEvidence
    executed_total: FieldEvidence
    remaining_total: FieldEvidence

class ColumnMapItem(BaseModel):
    col: Optional[int]
    label: str
    confidence: float

class BMLayout(BaseModel):
    table_start_row: int
    table_end_row: int
    header_rows: List[int]
    column_map: Dict[str, ColumnMapItem]

class ParsedBM(BaseModel):
    bm_meta: BMMeta
    layout: BMLayout
    items: List[BMItem]
    totals: BMTotals
    warnings: List[str] = []
    overall_confidence: float = 1.0
