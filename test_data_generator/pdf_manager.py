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

def parse_page_spec(spec: str, total_pages: int) -> list[int]:
    """
    Parses a page range string like '1-3, 5, 7-9' into a 0-indexed list.
    Returns all pages if spec is empty or 'all'.
    """
    spec = spec.strip().lower()
    if not spec or spec == "all":
        return list(range(total_pages))
    
    pages = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            start = max(1, int(start.strip()))
            end = min(total_pages, int(end.strip()))
            pages.extend(range(start - 1, end))
        else:
            p = int(part.strip())
            if 1 <= p <= total_pages:
                pages.append(p - 1)
    return pages


def combine_pdfs(
    pdf_bytes_list: list[bytes],
    page_specs: list[str] = None,
    file_order: list[int] = None
) -> bytes:

    if not pdf_bytes_list:
        return b""

    n_files = len(pdf_bytes_list)
    n_slots = len(file_order) if file_order else n_files

    if file_order is None:
        file_order = list(range(n_files))
    if page_specs is None or len(page_specs) != len(file_order):
        page_specs = ["all"] * len(file_order)

    out_pdf = fitz.open()

    for position, idx in enumerate(file_order):
        pdf_bytes = pdf_bytes_list[idx]
        spec = page_specs[position] 
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total = doc.page_count
        pages = parse_page_spec(spec, total)

        for page_num in pages:
            out_pdf.insert_pdf(doc, from_page=page_num, to_page=page_num)

        doc.close()

    out_bytes = out_pdf.write(garbage=4, deflate=True)
    out_pdf.close()

    return out_bytes
