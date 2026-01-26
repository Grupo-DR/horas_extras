from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from app.modules.bm_parser import BMParser
from app.modules.pdf_parser_service import PDFParserService
from app.schemas import ParsedBM

app = FastAPI(title="BM Parser Service", version="1.0.0")

# Setup CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, set to specific frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/contracts/{contract_id}/bm/parse", response_model=ParsedBM)
async def parse_bm(contract_id: str, file: UploadFile = File(...)):
    """
    Parses a Measurement Bulletin (BM) Excel file and returns structured data.
    """
    return await BMParser.parse_file(file)

@app.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    """
    Parses a PDF file (BM or RDO) and returns structured data.
    """
    contents = await file.read()
    # Create a BytesIO-like object or pass bytes directly if pdfplumber supports it (it usually expects file-like or path)
    # pdfplumber.open(file)
    # Actually pdfplumber.open() accepts a file-like object.
    import io
    file_bytes = io.BytesIO(contents)
    
    result = PDFParserService.parse_pdf(file_bytes, file.filename)
    return result
