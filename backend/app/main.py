from fastapi import FastAPI, UploadFile, File
from app.modules.bm_parser import BMParser
from app.schemas import ParsedBM

app = FastAPI(title="BM Parser Service", version="1.0.0")

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/contracts/{contract_id}/bm/parse", response_model=ParsedBM)
async def parse_bm(contract_id: str, file: UploadFile = File(...)):
    """
    Parses a Measurement Bulletin (BM) Excel file and returns structured data.
    """
    return await BMParser.parse_file(file)
