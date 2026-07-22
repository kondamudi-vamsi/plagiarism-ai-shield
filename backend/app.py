import io
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Tuple

# Import custom core modules
from plagiarism import (
    get_text_similarity,
    get_code_similarity,
    extract_text_from_pdf,
    extract_text_from_docx
)
from ai_detector import detect_ai_content

app = FastAPI(title="Plagiarism & AI Detection API", version="1.0.0")

# Enable CORS for frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local execution ease
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# Schema Definitions
# ==========================================

class CompareSnippet(BaseModel):
    name: str
    content: str
    is_code: bool = False

class CompareRequest(BaseModel):
    items: List[CompareSnippet]
    # Configuration weights for winnowing
    k_value: Optional[int] = 8
    w_value: Optional[int] = 5

class AIDetectRequest(BaseModel):
    content: str
    is_code: bool = False

# ==========================================
# Helper Utilities
# ==========================================

def get_file_type_and_text(filename: str, file_bytes: bytes) -> Tuple[bool, str]:
    """
    Determines if a file is code or text, and extracts text content.
    Returns: Tuple[is_code: bool, content: str]
    """
    ext = filename.split('.')[-1].lower() if '.' in filename else ""
    
    # 1. Check specialized text documents
    if ext == 'pdf':
        return False, extract_text_from_pdf(file_bytes)
    elif ext in ('doc', 'docx'):
        return False, extract_text_from_docx(file_bytes)
        
    # 2. Extract as raw text
    try:
        content_str = file_bytes.decode('utf-8')
    except UnicodeDecodeError:
        try:
            content_str = file_bytes.decode('latin-1')
        except Exception:
            raise HTTPException(status_code=400, detail=f"Unsupported or unreadable binary file formatting: {filename}")
            
    # 3. Classify if code or text based on extensions
    code_extensions = {
        'py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'csv', 'yaml', 
        'xml', 'h', 'c', 'cpp', 'cc', 'java', 'cs', 'go', 'rs', 'php', 'sh', 
        'sql', 'rb', 'pl', 'kt', 'swift', 'r', 'm', 'dart'
    }
    
    is_code = ext in code_extensions
    return is_code, content_str

from typing import Tuple

# ==========================================
# Endpoints: Plagiarism Comparison
# ==========================================

@app.post("/api/plagiarism/compare")
def compare_snippets(req: CompareRequest):
    """
    Compares custom copy-pasted code/text blocks.
    Returns similarity matrix and details.
    """
    items = req.items
    if len(items) < 2:
        raise HTTPException(status_code=400, detail="Must provide at least 2 content snippets to compare.")
        
    results = []
    # Conduct pairwise computations
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            item1 = items[i]
            item2 = items[j]
            
            # Use average score if mismatch, else compute
            is_code_run = item1.is_code or item2.is_code
            if is_code_run:
                sim_res = get_code_similarity(item1.content, item2.content, k=req.k_value, w=req.w_value)
            else:
                sim_res = get_text_similarity(item1.content, item2.content)
                
            results.append({
                "source_index": i,
                "source_name": item1.name,
                "target_index": j,
                "target_name": item2.name,
                "is_code": is_code_run,
                "score": sim_res["score"],
                "matches": sim_res["matches"]
            })
            
    return {
        "items": [{"name": it.name, "length": len(it.content), "is_code": it.is_code} for it in items],
        "comparisons": results
    }


@app.post("/api/plagiarism/compare-files")
async def compare_files(
    files: List[UploadFile] = File(...),
    k_value: int = Form(8),
    w_value: int = Form(5)
):
    """
    Handles multi-file uploads and returns a mutual comparison report.
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Upload at least 2 files for similarity mapping.")
        
    parsed_items = []
    for file in files:
        file_bytes = await file.read()
        try:
            is_code, text_content = get_file_type_and_text(file.filename, file_bytes)
            parsed_items.append(CompareSnippet(
                name=file.filename,
                content=text_content,
                is_code=is_code
            ))
        except HTTPException as he:
            raise he
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed reading {file.filename}: {str(e)}")
            
    req = CompareRequest(items=parsed_items, k_value=k_value, w_value=w_value)
    return compare_snippets(req)


# ==========================================
# Endpoints: AI Authorship Checker
# ==========================================

@app.post("/api/ai/detect")
def detect_ai(req: AIDetectRequest):
    """Detects if a given text/code snippet was generated by AI model."""
    try:
        report = detect_ai_content(req.content, req.is_code)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Detection error: {str(e)}")


@app.post("/api/ai/detect-file")
async def detect_ai_file(
    file: UploadFile = File(...),
    is_code: Optional[bool] = Form(None)
):
    """Processes uploaded file and runs text/code AI classification."""
    file_bytes = await file.read()
    try:
        detected_is_code, text_content = get_file_type_and_text(file.filename, file_bytes)
        
        # Override is_code if user explicitly supplied it
        final_is_code = is_code if is_code is not None else detected_is_code
        
        report = detect_ai_content(text_content, final_is_code)
        report["filename"] = file.filename
        report["detected_is_code"] = detected_is_code
        report["content"] = text_content
        return report
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed checking {file.filename}: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
