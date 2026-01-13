from typing import Any, Tuple, Optional
import re
from app.schemas import ParsedBM, BMItem

class Validator:
    @staticmethod
    def normalize_number(value: Any) -> float:
        """
        Converts:
        "1.234,56" -> 1234.56
        "R$ 1.000,00" -> 1000.00
        "25,5%" -> 0.255
        float -> float
        int -> float
        None -> 0.0
        """
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        
        s = str(value).strip()
        if not s:
            return 0.0
            
        # Remove currency
        s = s.replace("R$", "").replace("r$", "").strip()
        
        # Check percentage
        is_percent = "%" in s
        s = s.replace("%", "").strip()
        
        # Handle European/Brazilian format: 1.234,56
        # If there is a comma and a dot, assume dot is thousands sep
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            # Check if it looks like US format 1,234.56 (unlikely in BR but possible)
            # OR standard BR 1234,56. 
            # Safest for BR context: comma is decimal.
            s = s.replace(",", ".")
        
        try:
            f = float(s)
            if is_percent:
                f = f / 100.0
            return f
        except ValueError:
            return 0.0

    @staticmethod
    def validate(bm: ParsedBM) -> ParsedBM:
        # 1. Check item logic
        
        total_previsto = 0.0
        total_medido_mes = 0.0
        
        for item in bm.items:
            # Coerce values (in case they came raw) - actually extractor should have done it, 
            # but let's double check or add warnings
            
            previsto = item.previsto_contrato.value or 0.0
            saldo = item.saldo.value or 0.0
            # medicao = item.medicao_mes.value or 0.0
            
            # Logic: If item has valid predicted value, but saldo > previsto (and no additive), warning
            # But skipping complex additive logic for now.
            
            if isinstance(previsto, (int, float)) and isinstance(saldo, (int, float)):
                if saldo > previsto * 1.01: # 1% tolerance
                    bm.warnings.append(f"Item {item.item_code.value}: Saldo ({saldo}) maior que Previsto ({previsto})")

            # Check Item Code format
            code = str(item.item_code.value)
            if not re.match(r"^\d+(\.\d+)*$", code):
                 item.item_code.notes = (item.item_code.notes or "") + " [Invalid Format]"

        return bm
