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
    """Applique un watermark PDF. Lit depuis storage (local ou Supabase), écrit via storage."""
    from app.services import storage

    watermark_buf = _create_watermark(acheteur_name, acheteur_email)
    watermark_reader = PdfReader(watermark_buf)
    watermark_page = watermark_reader.pages[0]

    # Charge le PDF source — soit depuis le disque, soit via signed URL (Supabase)
    if storage._split_supabase(source_path):
        try:
            import httpx
            r = httpx.get(storage.signed_url(source_path), timeout=30.0)
            r.raise_for_status()
            reader = PdfReader(io.BytesIO(r.content))
        except Exception:
            return source_path
    else:
        reader = PdfReader(source_path)

    writer = PdfWriter()
    for page in reader.pages:
        page.merge_page(watermark_page)
        writer.add_page(page)

    out_buf = io.BytesIO()
    writer.write(out_buf)
    out_buf.seek(0)

    return storage.save(
        content=out_buf.read(),
        filename=f"{acheteur_id}.pdf",
        kind=storage.KIND_DOCUMENTS,
        subfolder="watermarked",
        content_type="application/pdf",
    )


def save_uploaded_file(content: bytes, filename: str, subfolder: str = "",
                       kind: str = "documents", content_type: str | None = None) -> str:
    """
    Sauvegarde un fichier via la couche storage (local ou Supabase).
    Conservé pour rétrocompat ; les nouveaux call-sites peuvent appeler
    `app.services.storage.save()` directement.
    """
    from app.services.storage import save as _storage_save
    return _storage_save(
        content=content,
        filename=filename,
        kind=kind,
        subfolder=subfolder,
        content_type=content_type or "application/octet-stream",
    )


def _legacy_save_uploaded_file(content: bytes, filename: str, subfolder: str = "") -> str:
    """Ancienne implémentation locale (gardée si on a besoin d'écrire en dur)."""
    folder = os.path.join(UPLOAD_DIR, subfolder) if subfolder else UPLOAD_DIR
    os.makedirs(folder, exist_ok=True)
    safe_name = f"{uuid.uuid4()}_{filename}"
    path = os.path.join(folder, safe_name)
    with open(path, "wb") as f:
        f.write(content)
    return path
