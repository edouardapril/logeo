"""
Watermark Pillow pour les photos teaser.

Génère une image avec un texte semi-transparent en diagonale sur la photo originale.
Sortie : JPEG haute qualité (quality=85) — bon compromis qualité/taille.
"""
import io
from PIL import Image, ImageDraw, ImageFont, ImageFilter

WATERMARK_TEXT = "Logeo — Dossier complet après NDA"

# Conversion en sRGB et compression : photo teaser publique ~1280px max sur le grand côté
TEASER_MAX_DIM = 1280


def _resize(img: Image.Image, max_dim: int) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_dim:
        return img
    if w >= h:
        new_w = max_dim
        new_h = int(h * (max_dim / w))
    else:
        new_h = max_dim
        new_w = int(w * (max_dim / h))
    return img.resize((new_w, new_h), Image.LANCZOS)


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    # Pillow's default bitmap font is awful at large sizes. On Windows the system fonts work.
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf",  # Segoe UI Bold
        "C:/Windows/Fonts/arialbd.ttf",   # Arial Bold
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def watermark_image(content: bytes, text: str = WATERMARK_TEXT) -> bytes:
    """
    Applique un watermark diagonal semi-transparent et retourne le JPEG résultant.
    """
    img = Image.open(io.BytesIO(content)).convert("RGB")
    img = _resize(img, TEASER_MAX_DIM)

    # Couche transparente pour le texte (RGBA puis on aplatit)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Taille du texte ~7% de la diagonale
    diag = (img.size[0] ** 2 + img.size[1] ** 2) ** 0.5
    font_size = max(28, int(diag * 0.06))
    font = _load_font(font_size)

    # Mesure du texte
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    except AttributeError:
        tw, th = font.getsize(text)

    # Calque rotation : on dessine sur une grande couche puis on la rotate de 30°
    pad = max(tw, th)
    layer = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    # Halo (texte noir flou) puis texte blanc
    ld.text((pad, pad), text, font=font, fill=(0, 0, 0, 120))
    halo = layer.filter(ImageFilter.GaussianBlur(radius=4))
    ld_main = ImageDraw.Draw(halo)
    ld_main.text((pad, pad), text, font=font, fill=(255, 255, 255, 200))

    rotated = halo.rotate(30, resample=Image.BICUBIC, expand=True)

    # On centre le watermark
    rw, rh = rotated.size
    px = (img.size[0] - rw) // 2
    py = (img.size[1] - rh) // 2
    overlay.paste(rotated, (px, py), rotated)

    composite = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    out = io.BytesIO()
    composite.save(out, format="JPEG", quality=85, optimize=True)
    return out.getvalue()
