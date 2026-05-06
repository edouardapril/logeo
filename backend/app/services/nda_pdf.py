"""
Génération du PDF NDA signé pour Logeo.

Le PDF inclut toutes les données légalement requises :
  - Nom complet acheteur
  - Date+heure signature
  - Adresse EXACTE du deal (révélée à la signature)
  - Numéro court du deal
  - 4 clauses cochées
  - Durée non-contournement 24 mois + pénalité 3× frais
  - IP + user agent + preuve Loi 25
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)
from reportlab.lib.enums import TA_LEFT


CLAUSES = [
    ("consent_confidentiality",
     "Confidentialité totale",
     "Je m'engage à maintenir une confidentialité totale sur l'ensemble des informations relatives à ce deal "
     "(adresse exacte, identité du vendeur, identité du courtier, données financières, documents). Je ne "
     "divulguerai aucune de ces informations à un tiers, par quelque moyen que ce soit."),
    ("consent_no_direct_contact",
     "Non-contact direct vendeur/courtier",
     "Je m'engage à ne pas contacter directement le vendeur ou le courtier en dehors du canal officiel Logeo "
     "pendant la durée de l'enchère et pour les 24 mois suivant la dernière action sur le deal."),
    ("consent_logeo_exclusive_source",
     "Reconnaissance de la source exclusive Logeo",
     "Je reconnais que Logeo est la source exclusive de cette opportunité. Toute transaction conclue sur cette "
     "propriété dans les 24 mois doit transiter par Logeo, faute de quoi une pénalité de 3× les frais Logeo "
     "applicables sera due et juridiquement exigible."),
    ("consent_no_third_party_share",
     "Non-partage des informations avec tiers",
     "Je m'engage à ne partager aucune information du dossier (photos, documents, données financières, identité "
     "du courtier ou du vendeur) avec un tiers, qu'il soit investisseur, conseiller, ou toute autre personne, "
     "sans autorisation écrite préalable de Logeo."),
]


def _styles():
    base = getSampleStyleSheet()
    base.add(ParagraphStyle(
        name='Brand', fontSize=22, leading=26, textColor=HexColor('#EA580C'),
        spaceAfter=12, alignment=TA_LEFT, fontName='Helvetica-Bold',
    ))
    base.add(ParagraphStyle(
        name='H1', fontSize=14, leading=18, textColor=HexColor('#1A1A1A'),
        spaceAfter=8, fontName='Helvetica-Bold',
    ))
    base.add(ParagraphStyle(
        name='H2', fontSize=12, leading=16, textColor=HexColor('#9A3412'),
        spaceBefore=8, spaceAfter=4, fontName='Helvetica-Bold',
    ))
    base.add(ParagraphStyle(
        name='Body', fontSize=10, leading=14, spaceAfter=6, fontName='Helvetica',
    ))
    base.add(ParagraphStyle(
        name='Small', fontSize=8, leading=11, textColor=HexColor('#666666'), fontName='Helvetica',
    ))
    base.add(ParagraphStyle(
        name='Mono', fontSize=9, leading=12, fontName='Courier',
    ))
    return base


def generate_nda_pdf(
    *,
    acheteur_full_name: str,
    acheteur_email: str,
    deal_id: str,
    deal_city: str,
    deal_address_private: str,
    deal_property_type: str,
    signed_at: datetime,
    ip_address: str,
    user_agent: str | None,
    consents: dict,
) -> bytes:
    """Retourne les octets du PDF NDA généré."""
    styles = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    )
    story: list = []

    story.append(Paragraph('LOGEO', styles['Brand']))
    story.append(Paragraph(
        "Accord de non-divulgation et de non-contournement (NDA)",
        styles['H1'],
    ))
    story.append(Spacer(1, 12))

    short_id = str(deal_id)[:8].upper()
    info_data = [
        ['Numéro de deal Logeo', f'#{short_id}'],
        ['Type de propriété', deal_property_type],
        ['Ville', deal_city],
        ['Adresse exacte (révélée par ce NDA)', deal_address_private],
        ['Acheteur signataire', acheteur_full_name],
        ['Email acheteur', acheteur_email],
        ['Date et heure de signature (UTC)', signed_at.strftime('%Y-%m-%d %H:%M:%S')],
        ['Adresse IP de signature', ip_address or '—'],
    ]
    table = Table(info_data, colWidths=[2.5 * inch, 3.5 * inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), HexColor('#FFEDD5')),
        ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#9A3412')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#FDBA74')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 18))

    story.append(Paragraph(
        "1. Engagement de non-contournement (24 mois)",
        styles['H2'],
    ))
    story.append(Paragraph(
        "Le signataire s'engage, pour une durée de <b>24 mois</b> à compter de la date de signature ci-dessus, "
        "à ne pas contourner Logeo en concluant directement avec le vendeur ou via tout autre canal une "
        "transaction relative à la propriété identifiée ci-dessus.",
        styles['Body'],
    ))
    story.append(Paragraph(
        "Toute infraction entraîne une <b>pénalité financière de 3× les frais Logeo applicables</b>, "
        "juridiquement exigible devant les tribunaux du Québec, en plus de l'expulsion immédiate et permanente "
        "du signataire de la plateforme Logeo.",
        styles['Body'],
    ))

    story.append(Paragraph("2. Clauses signées individuellement", styles['H2']))
    for key, title, body in CLAUSES:
        checked = bool(consents.get(key))
        mark = '☑' if checked else '☐'
        story.append(Paragraph(f"<b>{mark} {title}</b>", styles['Body']))
        story.append(Paragraph(body, styles['Body']))
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 12))
    story.append(Paragraph("3. Preuves légales", styles['H2']))
    story.append(Paragraph(
        f"Conformément à la Loi 25 (Loi sur la protection des renseignements personnels — Québec), la signature "
        f"électronique de cet accord est horodatée et associée à l'adresse IP du signataire ainsi qu'à l'agent "
        f"utilisateur du navigateur.",
        styles['Body'],
    ))
    story.append(Spacer(1, 6))
    ua_short = (user_agent or '—')[:200]
    story.append(Paragraph(f"User agent : <font face='Courier'>{ua_short}</font>", styles['Small']))

    story.append(Spacer(1, 24))
    story.append(Paragraph(
        f"Signé électroniquement par <b>{acheteur_full_name}</b> le "
        f"{signed_at.strftime('%d %B %Y à %H:%M UTC')}.",
        styles['Body'],
    ))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "Document généré automatiquement par Logeo · Conservez ce PDF comme preuve de signature.",
        styles['Small'],
    ))

    doc.build(story)
    return buf.getvalue()
