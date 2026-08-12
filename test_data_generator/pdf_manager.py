import fitz
import io

def replace_text_in_pdf(pdf_bytes: bytes, replacements: dict) -> bytes:
    """ 
    Replaces text in a PDF by redacting the old text and inserting the new text.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    for page in doc:
        for old_text, new_text in replacements.items():
            if not old_text:
                continue
            
            # Search for the target text
            text_instances = page.search_for(old_text)
            
            for inst in text_instances:
                fontsize = (inst.y1 - inst.y0) * 0.8
                
                page.add_redact_annot(
                    inst, 
                    text=new_text, 
                    fontname="helv", 
                    fontsize=fontsize, 
                    text_color=(0, 0, 0),
                    fill=(1, 1, 1)
                )

        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
        
    out_pdf = io.BytesIO()    
    out_bytes = doc.write(garbage=4, deflate=True)
    doc.close()
    
    return out_bytes

def combine_pdfs(pdf_bytes_list: list[bytes]) -> bytes:
    """Combines a list of PDF byte streams into a single PDF."""
    if not pdf_bytes_list:
        return b""
        
    out_pdf = fitz.open()
    
    for pdf_bytes in pdf_bytes_list:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        out_pdf.insert_pdf(doc)
        doc.close()
        
    out_bytes = out_pdf.write(garbage=4, deflate=True)
    out_pdf.close()
    
    return out_bytes
