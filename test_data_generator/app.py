from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import uvicorn
from typing import List
from pdf_manager import replace_text_in_pdf, combine_pdfs
from scanner_simulator import simulate_scan

app = FastAPI(title="PDF Text Replacer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow Vite frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/replace")
async def replace_pdf_text(
    file: UploadFile = File(...),
    replacements: str = Form(...) # JSON string
):
    try:
        rep_dict = json.loads(replacements)
        pdf_bytes = await file.read()
        
        new_pdf_bytes = replace_text_in_pdf(pdf_bytes, rep_dict)
        
        return Response(
            content=new_pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=edited_{file.filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/simulate-scan")
async def api_simulate_scan(
    file: UploadFile = File(...),
    skew: bool = Form(False),
    blur: bool = Form(False),
    noise: bool = Form(False),
    low_dpi: bool = Form(False),
    skew_angle: float = Form(1.5),
    blur_strength: int = Form(5),
    noise_intensity: float = Form(15.0),
    overlay_image: UploadFile = File(None)
):
    try:
        pdf_bytes = await file.read()
        
        overlay_bytes = None
        if overlay_image and overlay_image.filename:
            overlay_bytes = await overlay_image.read()
        
        new_pdf_bytes = simulate_scan(
            pdf_bytes, 
            skew, blur, noise, low_dpi,
            skew_angle=skew_angle,
            blur_strength=blur_strength,
            noise_intensity=noise_intensity,
            overlay_image_bytes=overlay_bytes
        )
        
        return Response(
            content=new_pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=scanned_{file.filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/combine")
async def api_combine(files: List[UploadFile] = File(...)):
    try:
        pdf_bytes_list = []
        for file in files:
            pdf_bytes = await file.read()
            pdf_bytes_list.append(pdf_bytes)
            
        combined_pdf_bytes = combine_pdfs(pdf_bytes_list)
        
        return Response(
            content=combined_pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=combined_document.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
