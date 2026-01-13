from fastapi import UploadFile, HTTPException
from app.modules.loader import DataLoader
from app.modules.extractor import Extractor
from app.schemas import ParsedBM
import traceback

class BMParser:
    @staticmethod
    async def parse_file(file: UploadFile) -> ParsedBM:
        content = await file.read()
        filename = file.filename.lower()
        
        try:
            # 1. Load Grid
            if filename.endswith(".xlsx"):
                grid = DataLoader.load_xlsx(content)
            elif filename.endswith(".xls"):
                grid = DataLoader.load_xls(content)
            else:
                raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .xlsx or .xls")
            
            # 2. Extract
            extractor = Extractor(grid)
            bm = extractor.extract()
            
            # 3. Overall Confidence Calculation (Simple average of columns for now)
            # This could be more sophisticated
            conf_sum = 0
            conf_count = 0
            for item in bm.layout.column_map.values():
                if item.col is not None:
                    conf_sum += item.confidence
                    conf_count += 1
            
            if conf_count > 0:
                bm.overall_confidence = conf_sum / conf_count
            else:
                bm.overall_confidence = 0.0
                bm.warnings.append("No layout columns detected.")

            return bm

        except Exception as e:
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error processing BM: {str(e)}")
