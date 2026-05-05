import uuid
import resend
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.models.user import User, UserRole
from app.models.email_log import EmailLog, EmailType

settings = get_settings()
resend.api_key = settings.resend_api_key


async def _log_email(
    db: AsyncSession,
    email_type: EmailType,
    recipient_id: uuid.UUID | None,
    deal_id: uuid.UUID | None,
    resend_id: str | None = None,
    error: str | None = None,
):
    log = EmailLog(
        email_type=email_type,
        recipient_id=recipient_id,
        deal_id=deal_id,
        resend_id=resend_id,
        error=error,
    )
    db.add(log)
    await db.flush()


async def _send(to: str, subject: str, html: str) -> str | None:
    try:
        result = resend.Emails.send({
            "from": f"Logeo <{settings.from_email}>",
            "to": [to],
            "subject": subject,
            "html": html,
        })
        return result.get("id")
    except Exception as e:
        return None


async def send_nouveau_deal(db: AsyncSession, deal_id: uuid.UUID, deal_city: str, deal_type: str):
    result = await db.execute(
        select(User).where(User.role == UserRole.acheteur, User.is_qualified == True, User.is_active == True)
    )
    acheteurs = result.scalars().all()

    for acheteur in acheteurs:
        html = f"""
        <h2>Nouveau deal disponible sur Logeo</h2>
        <p>Bonjour {acheteur.full_name},</p>
        <p>Un nouveau deal vient d'être publié : <strong>{deal_type} à {deal_city}</strong>.</p>
        <p>Connectez-vous pour découvrir le teaser et signer le NDA pour accéder au dossier complet.</p>
        <a href="{settings.frontend_url}/deals/{deal_id}">Voir le deal</a>
        """
        resend_id = await _send(acheteur.email, f"[Logeo] Nouveau deal - {deal_type} à {deal_city}", html)
        await _log_email(db, EmailType.nouveau_deal, acheteur.id, deal_id, resend_id)


async def send_nda_signee(db: AsyncSession, acheteur: User, deal_id: uuid.UUID):
    html = f"""
    <h2>NDA signé avec succès</h2>
    <p>Bonjour {acheteur.full_name},</p>
    <p>Votre NDA pour le deal <strong>{deal_id}</strong> a été enregistré.</p>
    <p>Vous avez maintenant accès au dossier complet, incluant l'adresse exacte et les coordonnées du courtier.</p>
    <a href="{settings.frontend_url}/deals/{deal_id}/full">Accéder au dossier</a>
    """
    resend_id = await _send(acheteur.email, "[Logeo] NDA signé - Accès complet accordé", html)
    await _log_email(db, EmailType.nda_signee, acheteur.id, deal_id, resend_id)

    admin_html = f"<p>NDA signé par {acheteur.full_name} ({acheteur.email}) pour le deal {deal_id}</p>"
    await _send(settings.admin_email, f"[Logeo Admin] NDA signé - {acheteur.email}", admin_html)


async def send_bid_soumis_admin(db: AsyncSession, deal_id: uuid.UUID, acheteur_name: str, amount: int):
    html = f"<p>Nouveau bid soumis par <strong>{acheteur_name}</strong> : <strong>{amount:,} $</strong> sur le deal {deal_id}</p>"
    await _send(settings.admin_email, f"[Logeo Admin] Nouveau bid - {amount:,}$", html)
    await _log_email(db, EmailType.bid_soumis, None, deal_id)


async def send_fermeture_gagnant(db: AsyncSession, gagnant: User, deal_id: uuid.UUID, amount: int, fee: int):
    deposit = int(fee * 0.25)
    html = f"""
    <h2>Félicitations ! Vous avez remporté l'enchère</h2>
    <p>Bonjour {gagnant.full_name},</p>
    <p>Votre offre de <strong>{amount:,} $</strong> est la plus haute sur ce deal.</p>
    <h3>Instructions pour le dépôt (25% des frais Logeo)</h3>
    <p>Veuillez envoyer <strong>{deposit:,} $</strong> par Interac à : <strong>{settings.admin_email}</strong></p>
    <p>Message Interac : <strong>LOGEO-{str(deal_id)[:8].upper()}</strong></p>
    <p><strong>Important :</strong> Ce dépôt doit être reçu dans les 48h, faute de quoi le deal sera offert au prochain enchérisseur.</p>
    """
    resend_id = await _send(gagnant.email, "[Logeo] Vous avez remporté l'enchère - Instructions de paiement", html)
    await _log_email(db, EmailType.fermeture_gagnant, gagnant.id, deal_id, resend_id)


async def send_fermeture_perdants(db: AsyncSession, perdants: list[User], deal_id: uuid.UUID):
    for perdant in perdants:
        html = f"""
        <h2>Résultat de l'enchère</h2>
        <p>Bonjour {perdant.full_name},</p>
        <p>L'enchère sur ce deal est maintenant terminée. Votre offre n'a malheureusement pas été retenue.</p>
        <p>Restez à l'affût des prochains deals sur Logeo !</p>
        <a href="{settings.frontend_url}/deals">Voir les deals actifs</a>
        """
        resend_id = await _send(perdant.email, "[Logeo] Résultat de l'enchère", html)
        await _log_email(db, EmailType.fermeture_perdants, perdant.id, deal_id, resend_id)


async def send_depot_confirme(
    db: AsyncSession,
    gagnant: User,
    courtier: User,
    deal_id: uuid.UUID,
    amount: int,
):
    # Email au gagnant
    gagnant_html = f"""
    <h2>Dépôt confirmé - Introduction officielle</h2>
    <p>Bonjour {gagnant.full_name},</p>
    <p>Votre dépôt a bien été reçu. Vous êtes officiellement l'acheteur retenu pour ce deal.</p>
    <h3>Votre courtier</h3>
    <p><strong>Nom :</strong> {courtier.full_name}</p>
    <p><strong>Email :</strong> {courtier.email}</p>
    <p><strong>Téléphone :</strong> {courtier.phone or 'N/A'}</p>
    <p><strong>Agence :</strong> {courtier.agency_name or 'N/A'}</p>
    <p>Le courtier vous contactera sous peu pour organiser la visite.</p>
    """
    resend_id = await _send(gagnant.email, f"[Logeo] Introduction officielle - Deal {str(deal_id)[:8].upper()}", gagnant_html)
    await _log_email(db, EmailType.depot_confirme, gagnant.id, deal_id, resend_id)

    # Email au courtier
    courtier_html = f"""
    <h2>Votre acheteur a été confirmé</h2>
    <p>Bonjour {courtier.full_name},</p>
    <p>L'enchère sur votre deal est finalisée. Voici les coordonnées de votre acheteur :</p>
    <p><strong>Nom :</strong> {gagnant.full_name}</p>
    <p><strong>Email :</strong> {gagnant.email}</p>
    <p><strong>Téléphone :</strong> {gagnant.phone or 'N/A'}</p>
    <p><strong>Prix retenu :</strong> {amount:,} $</p>
    <p>Veuillez uploader la promesse d'achat signée dans l'application pour finaliser le deal.</p>
    """
    await _send(courtier.email, f"[Logeo] Acheteur confirmé - Action requise", courtier_html)


async def send_verdict_go(db: AsyncSession, courtier: User, deal_id: uuid.UUID):
    html = f"""
    <h2>Votre deal a été approuvé !</h2>
    <p>Bonjour {courtier.full_name},</p>
    <p>Bonne nouvelle : votre soumission a été analysée et approuvée par l'équipe Logeo.</p>
    <p>Votre deal est maintenant en ligne et les enchères sont ouvertes aux acheteurs qualifiés.</p>
    <a href="{settings.frontend_url}/courtier/deals/{deal_id}">Suivre votre deal</a>
    """
    resend_id = await _send(courtier.email, "[Logeo] Votre deal est en ligne ✓", html)
    await _log_email(db, EmailType.verdict_go, courtier.id, deal_id, resend_id)


async def send_verdict_nogo(db: AsyncSession, courtier: User, deal_id: uuid.UUID, reason: str):
    html = f"""
    <h2>Résultat de l'analyse de votre deal</h2>
    <p>Bonjour {courtier.full_name},</p>
    <p>Après analyse, votre deal n'a pas été retenu pour publication sur Logeo.</p>
    <h3>Motif</h3>
    <p>{reason}</p>
    <p>N'hésitez pas à soumettre d'autres opportunités. Notre équipe reste disponible si vous avez des questions.</p>
    """
    resend_id = await _send(courtier.email, "[Logeo] Résultat de l'analyse de votre soumission", html)
    await _log_email(db, EmailType.verdict_nogo, courtier.id, deal_id, resend_id)


async def send_pa_signee(db: AsyncSession, gagnant: User, courtier: User, deal_id: uuid.UUID):
    for user in [gagnant, courtier]:
        html = f"""
        <h2>Promesse d'achat confirmée</h2>
        <p>Bonjour {user.full_name},</p>
        <p>La promesse d'achat pour le deal <strong>{str(deal_id)[:8].upper()}</strong> a été déposée et confirmée.</p>
        <p>Le deal est maintenant archivé. Merci de votre confiance en Logeo.</p>
        """
        resend_id = await _send(user.email, "[Logeo] Promesse d'achat confirmée - Deal finalisé", html)
        await _log_email(db, EmailType.pa_signee, user.id, deal_id, resend_id)
