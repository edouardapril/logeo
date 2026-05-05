import os
import uuid
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
import io


UPLOAD_DIR = "uploads"
WATERMARKED_DIR = "uploads/watermarked"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(WATERMARKED_DIR, exist_ok=True)


def _create_watermark(acheteur_name: str, acheteur_email: str) -> io.BytesIO:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    c.setFont("Helvetica-Bold", 40)
    # Gris semi-transparent
    c.setFillColor(Color(0.7, 0.7, 0.7, alpha=0.35))

    c.saveState()
    c.translate(width / 2, height / 2)
    c.rotate(45)

    stamp_text = f"CONFIDENTIEL - {acheteur_name}"
    c.drawCentredString(0, 30, stamp_text)

    c.setFont("Helvetica", 16)
    date_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    c.drawCentredString(0, -10, f"{acheteur_email} | {date_str}")

    c.restoreState()
    c.save()
    buffer.seek(0)
    return buffer


def apply_watermark(
    source_path: str,
    acheteur_id: uuid.UUID,
    acheteur_name: str,
    acheteur_email: str,
) -> str:
    watermark_buf = _create_watermark(acheteur_name, acheteur_email)
    watermark_reader = PdfReader(watermark_buf)
    watermark_page = watermark_reader.pages[0]

    reader = PdfReader(source_path)
    writer = PdfWriter()

    for page in reader.pages:
        page.merge_page(watermark_page)
        writer.add_page(page)

    output_filename = f"{WATERMARKED_DIR}/{acheteur_id}_{uuid.uuid4()}.pdf"
    with open(output_filename, "wb") as f:
        writer.write(f)

    return output_filename


def save_uploaded_file(content: bytes, filename: str, subfolder: str = "") -> str:
    folder = os.path.join(UPLOAD_DIR, subfolder) if subfolder else UPLOAD_DIR
    os.makedirs(folder, exist_ok=True)
    safe_name = f"{uuid.uuid4()}_{filename}"
    path = os.path.join(folder, safe_name)
    with open(path, "wb") as f:
        f.write(content)
    return path
