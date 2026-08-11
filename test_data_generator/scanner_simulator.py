import fitz
import cv2
import numpy as np
import io

def apply_degradations(img_array: np.ndarray, skew: bool, blur: bool, noise: bool, low_dpi: bool, skew_angle: float, blur_strength: int, noise_intensity: float) -> np.ndarray:
    result = img_array.copy()
    
    if low_dpi:
        h, w = result.shape[:2]
        result = cv2.resize(result, (w // 3, h // 3), interpolation=cv2.INTER_LINEAR)
        result = cv2.resize(result, (w, h), interpolation=cv2.INTER_NEAREST)
        
    if blur:
        # Ensure blur strength is odd
        ksize = blur_strength if blur_strength % 2 == 1 else blur_strength + 1
        result = cv2.GaussianBlur(result, (ksize, ksize), 0)
        
    if skew:
        h, w = result.shape[:2]
        # Randomize direction based on the max angle
        angle = np.random.uniform(-skew_angle, skew_angle)
        M = cv2.getRotationMatrix2D((w/2, h/2), angle, 1)
        # 255 border value for white background
        result = cv2.warpAffine(result, M, (w, h), borderValue=(255, 255, 255))
        
    if noise:
        noise_img = np.random.normal(0, noise_intensity, result.shape).astype(np.float32)
        result = np.clip(result.astype(np.float32) + noise_img, 0, 255).astype(np.uint8)
        
    return result

def simulate_scan(
    pdf_bytes: bytes, 
    skew: bool, 
    blur: bool, 
    noise: bool, 
    low_dpi: bool,
    skew_angle: float = 1.5,
    blur_strength: int = 5,
    noise_intensity: float = 15.0,
    overlay_image_bytes: bytes = None
) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    out_doc = fitz.open()
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # Insert overlay image if provided (on the first page or all pages)
        if overlay_image_bytes:
            # Create a 200x200 rect in the top right corner
            # 20 pixels padding from top and right
            rect = fitz.Rect(page.rect.width - 220, 20, page.rect.width - 20, 220)
            page.insert_image(rect, stream=overlay_image_bytes)

        zoom = 2.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False, colorspace=fitz.csRGB)
        
        img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, 3)
        
        degraded = apply_degradations(img_array, skew, blur, noise, low_dpi, skew_angle, blur_strength, noise_intensity)
        
        # Safely convert to a Pixmap using PNG encoding
        # This completely avoids PyMuPDF shape/colorspace/bytecount signature mismatches
        # that cause 400 Bad Request
        _, img_encoded = cv2.imencode('.png', degraded)
        new_pix = fitz.Pixmap(img_encoded.tobytes())
        
        new_page = out_doc.new_page(width=page.rect.width, height=page.rect.height)
        new_page.insert_image(new_page.rect, pixmap=new_pix)
        
    out_pdf = io.BytesIO()
    out_doc.save(out_pdf, garbage=4, deflate=True)
    
    doc.close()
    out_doc.close()
    
    return out_pdf.getvalue()
