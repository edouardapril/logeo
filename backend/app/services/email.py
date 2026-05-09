import logging
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

log = logging.getLogger("logeo.email")

# Diagnostic au boot — visible dans Railway logs au démarrage. Aide à
# identifier en 1 coup d'œil si la config Resend est cassée (cause #1 des
# emails qui n'arrivent pas en MVP : domaine non vérifié OU API key absente).
def _log_email_config():
    api_key_set = bool(settings.resend_api_key)
    key_preview = (
        settings.resend_api_key[:6] + "..." if api_key_set else "<MISSING>"
    )
    from_email = settings.from_email or "<MISSING>"
    if not api_key_set:
        log.error(
            "[EMAIL CONFIG] RESEND_API_KEY non configurée — aucun email ne "
            "partira. Set RESEND_API_KEY dans Railway env vars."
        )
    elif "example" in (settings.resend_api_key or "").lower() or settings.resend_api_key.startswith("re_xxxx"):
        log.error(
            "[EMAIL CONFIG] RESEND_API_KEY ressemble à une valeur exemple "
            "(%s) — set la vraie clé Resend dans Railway env vars.",
            key_preview,
        )
    else:
        reply_to = settings.reply_to_email or "<none>"
        log.info(
            "[EMAIL CONFIG] api_key=%s · from=%s · reply_to=%s · "
            "(si emails non livrés : vérifier que le domaine de from_email "
            "est verified sur Resend dashboard)",
            key_preview, from_email, reply_to,
        )

_log_email_config()


async def _log_email(
    db: AsyncSession,
    email_type: EmailType,
    recipient_id: uuid.UUID | None,
    deal_id: uuid.UUID | None,
    resend_id: str | None = None,
    error: str | None = None,
):
    row = EmailLog(
        email_type=email_type,
        recipient_id=recipient_id,
        deal_id=deal_id,
        resend_id=resend_id,
        error=error,
    )
    db.add(row)
    await db.flush()


async def _send(to: str, subject: str, html: str, attachments: list[dict] | None = None) -> str | None:
    """Envoie un email via Resend. Retourne l'`id` Resend ou `None` en cas d'échec.

    Tous les chemins (succès/échec) sont logués au niveau INFO/ERROR pour
    qu'un échec de Resend (domaine non vérifié, API key révoquée, rate limit,
    typo dans l'adresse) soit visible immédiatement dans Railway logs au lieu
    d'être avalé silencieusement.

    attachments : liste de dicts {filename, content (bytes), content_type?} — Resend 2.x.
    """
    if not settings.resend_api_key:
        log.error("[EMAIL SEND] SKIP to=%s subject=%r — RESEND_API_KEY non configurée", to, subject)
        return None

    payload = {
        "from": f"Logeo <{settings.from_email}>",
        "to": [to],
        "subject": subject,
        "html": html,
    }
    # Reply-To : redirige les replies vers la boîte perso d'Edouard sans avoir
    # à monter un mailbox sur logeo.ca. Resend Python SDK accepte `reply_to`
    # comme clé du payload (string ou liste). Header omis si la var est vide.
    if settings.reply_to_email:
        payload["reply_to"] = settings.reply_to_email
    if attachments:
        import base64
        payload["attachments"] = [
            {
                "filename": a["filename"],
                "content": base64.b64encode(a["content"]).decode("ascii")
                    if isinstance(a["content"], (bytes, bytearray))
                    else a["content"],
            }
            for a in attachments
        ]
    try:
        result = resend.Emails.send(payload)
        rid = result.get("id") if isinstance(result, dict) else None
        if rid:
            log.info("[EMAIL SEND] OK to=%s subject=%r resend_id=%s", to, subject, rid)
            return rid
        # Resend a renvoyé sans `id` → typiquement un message d'erreur dans le body.
        log.error("[EMAIL SEND] no_id to=%s subject=%r raw=%r", to, subject, result)
        return None
    except Exception as e:
        # Cause typique en MVP : "The domain logeo.ca is not verified" (Resend 403)
        # OU "Invalid API key" (Resend 401). exc_info pour la stack trace complète.
        log.error(
            "[EMAIL SEND] FAIL to=%s subject=%r err=%s",
            to, subject, e, exc_info=True,
        )
        return None


async def send_nouveau_deal(db: AsyncSession, deal_id: uuid.UUID, deal_city: str, deal_type: str):
    # Calcule la durée de l'enchère depuis le deal pour rester cohérent avec
    # les paramètres réels du verdict (pas de hard-code "10 jours").
    from app.models.deal import Deal
    deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = deal_res.scalar_one_or_none()
    duration_days = None
    close_str = ""
    if deal and deal.bid_open_at and deal.bid_close_at:
        delta = deal.bid_close_at - deal.bid_open_at
        duration_days = round(delta.total_seconds() / 86400, 1)
        close_str = deal.bid_close_at.strftime("%d %b %Y %H:%M UTC")

    duration_html = ""
    if duration_days:
        duration_html = (
            f"<p><strong>Durée de l'enchère :</strong> {duration_days:g} jour"
            f"{'s' if duration_days >= 2 else ''} "
            f"(fermeture prévue le {close_str}).</p>"
        )

    result = await db.execute(
        select(User).where(User.role == UserRole.acheteur, User.is_qualified == True, User.is_active == True)
    )
    acheteurs = result.scalars().all()

    for acheteur in acheteurs:
        html = f"""
        <h2>Nouveau deal disponible sur Logeo</h2>
        <p>Bonjour {acheteur.full_name},</p>
        <p>Un nouveau deal vient d'être publié : <strong>{deal_type} à {deal_city}</strong>.</p>
        {duration_html}
        <p>Connectez-vous pour découvrir le teaser et signer le NDA pour accéder au dossier complet.</p>
        <a href="{settings.frontend_url}/deals/{deal_id}">Voir le deal</a>
        """
        resend_id = await _send(acheteur.email, f"[Logeo] Nouveau deal - {deal_type} à {deal_city}", html)
        await _log_email(db, EmailType.nouveau_deal, acheteur.id, deal_id, resend_id)


async def send_nda_signee(
    db: AsyncSession, acheteur: User, deal_id: uuid.UUID,
    pdf_bytes: bytes | None = None, deal_city: str | None = None,
):
    short = str(deal_id)[:8].upper()
    location = f" pour le deal <strong>{deal_city or short}</strong>" if deal_city else f" #{short}"
    html = f"""
    <h2>NDA signé avec succès</h2>
    <p>Bonjour {acheteur.full_name},</p>
    <p>Votre NDA{location} a été enregistré et horodaté.</p>
    <p>Vous trouverez en pièce jointe le PDF signé contenant l'adresse exacte de la propriété,
       les 4 clauses cochées et les preuves légales (IP + horodatage).</p>
    <p>Vous avez maintenant accès au dossier complet sur la plateforme :</p>
    <a href="{settings.frontend_url}/acheteur/deals/{deal_id}">Accéder au dossier complet</a>
    """
    attachments = None
    if pdf_bytes:
        attachments = [{"filename": f"NDA-Logeo-{short}.pdf", "content": pdf_bytes}]
    resend_id = await _send(
        acheteur.email,
        f"[Logeo] NDA signé · #{short} · PDF en pièce jointe",
        html,
        attachments=attachments,
    )
    await _log_email(db, EmailType.nda_signee, acheteur.id, deal_id, resend_id)

    admin_html = f"<p>NDA signé par {acheteur.full_name} ({acheteur.email}) pour le deal #{short}</p>"
    await _send(settings.admin_email, f"[Logeo Admin] NDA signé · #{short}", admin_html)


async def send_email_verification(user: User, token: str) -> bool:
    """Envoie l'email de confirmation d'inscription (sprint final item 10).

    Retourne True si Resend a accepté l'envoi (resend_id reçu), False sinon.
    Le caller décide de l'action : bloquer la création de compte ou continuer
    avec un flag dans la réponse pour que le frontend prévienne l'utilisateur.
    """
    verify_url = f"{settings.frontend_url}/verify-email?token={token}"
    html = f"""
    <h2>Bienvenue sur Logeo</h2>
    <p>Bonjour {user.full_name},</p>
    <p>Merci de votre inscription. Pour activer votre compte, confirmez votre adresse email
       en cliquant sur le bouton ci-dessous :</p>
    <p>
      <a href="{verify_url}"
         style="display:inline-block;padding:12px 22px;background:#EA580C;color:white;
                text-decoration:none;border-radius:8px;font-weight:600;">
        Confirmer mon email
      </a>
    </p>
    <p style="color:#666;font-size:13px;">
      Lien valide 24 heures. Si vous n'avez pas créé de compte sur Logeo, ignorez cet email.
    </p>
    <p style="color:#999;font-size:11px;">
      Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
      <code>{verify_url}</code>
    </p>
    """
    rid = await _send(user.email, "Bienvenue sur Logeo — Confirmez votre compte", html)
    log.info("[EMAIL VERIFY] sent=%s to=%s user_id=%s", bool(rid), user.email, user.id)
    return bool(rid)


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
    """Email tripartite d'introduction officielle (sprint v13 item 4).

    Envoyé automatiquement quand le dépôt 25 % du gagnant est confirmé Stripe.
    Acheteur reçoit les coordonnées du courtier (incl. OACIQ).
    Courtier reçoit les coordonnées de l'acheteur.
    Admin reçoit une copie pour traçabilité.
    """
    from app.models.deal import Deal
    deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = deal_res.scalar_one_or_none()

    short = str(deal_id)[:8].upper()
    type_label = (deal.property_type.value if deal and hasattr(deal.property_type, "value")
                  else str(getattr(deal, "property_type", "deal")))
    city = deal.city if deal else ""
    subject = f"Logeo — Introduction officielle · {type_label} · {city}"

    # ── Body acheteur ────────────────────────────────────────────────────────
    oaciq_line = (
        f"<p><strong>N° licence OACIQ :</strong> {courtier.oaciq_number}</p>"
        if courtier.oaciq_number else ""
    )
    gagnant_html = f"""
    <h2>Félicitations ! Vous avez remporté l'enchère.</h2>
    <p>Bonjour {gagnant.full_name},</p>
    <p>Votre dépôt de <strong>{amount:,} $ CAD</strong> a été confirmé. L'introduction officielle est faite.</p>

    <h3 style="color:#9A3412;">Voici les coordonnées de votre courtier :</h3>
    <p><strong>Nom :</strong> {courtier.full_name}</p>
    <p><strong>Téléphone :</strong> {courtier.phone or 'Non renseigné'}</p>
    <p><strong>Email :</strong> <a href="mailto:{courtier.email}">{courtier.email}</a></p>
    <p><strong>Agence :</strong> {courtier.agency_name or 'Non renseignée'}</p>
    {oaciq_line}

    <h3 style="color:#9A3412;">Prochaines étapes</h3>
    <p>Vous avez <strong>5 jours ouvrables</strong> pour compléter votre due diligence
       (visite physique, vérifications notaires, financement) et confirmer dans votre portail Logeo.</p>
    <p>Une fois confirmé, le solde 75 % des frais Logeo sera débité automatiquement de votre carte enregistrée.</p>

    <p>
      <a href="{settings.frontend_url}/acheteur/deals/{deal_id}"
         style="display:inline-block;padding:12px 22px;background:#EA580C;color:white;
                text-decoration:none;border-radius:8px;font-weight:600;">
        Confirmer ma due diligence
      </a>
    </p>
    """.replace(",", " ")
    resend_id = await _send(gagnant.email, subject, gagnant_html)
    await _log_email(db, EmailType.depot_confirme, gagnant.id, deal_id, resend_id)

    # ── Body courtier ────────────────────────────────────────────────────────
    courtier_html = f"""
    <h2>Un acheteur a remporté l'enchère sur votre deal.</h2>
    <p>Bonjour {courtier.full_name},</p>
    <p>L'enchère sur le deal <strong>{type_label} · {city}</strong> est finalisée.
       Le dépôt 25 % a été confirmé.</p>

    <h3 style="color:#9A3412;">Coordonnées de votre acheteur :</h3>
    <p><strong>Nom :</strong> {gagnant.full_name}</p>
    <p><strong>Téléphone :</strong> {gagnant.phone or 'Non renseigné'}</p>
    <p><strong>Email :</strong> <a href="mailto:{gagnant.email}">{gagnant.email}</a></p>
    <p><strong>Prix retenu :</strong> {amount:,} $ CAD</p>

    <p>Vous pouvez le contacter directement pour organiser la visite et finaliser la PA.</p>
    <p>L'acheteur a <strong>5 jours ouvrables</strong> pour compléter sa due diligence.
       Vous serez informé du déclenchement du solde 75 %.</p>

    <p>
      <a href="{settings.frontend_url}/courtier/deals/{deal_id}"
         style="display:inline-block;padding:12px 22px;background:#EA580C;color:white;
                text-decoration:none;border-radius:8px;font-weight:600;">
        Voir le deal
      </a>
    </p>
    """.replace(",", " ")
    await _send(courtier.email, subject, courtier_html)

    # ── Copie admin (traçabilité) ────────────────────────────────────────────
    admin_html = f"""
    <h2>Introduction officielle déclenchée — {type_label} · {city}</h2>
    <p>Deal : <strong>#{short}</strong></p>
    <p>Acheteur gagnant : {gagnant.full_name} · {gagnant.email} · {gagnant.phone or '—'}</p>
    <p>Courtier : {courtier.full_name} · {courtier.email} · OACIQ {courtier.oaciq_number or '—'}</p>
    <p>Prix retenu : {amount:,} $ CAD</p>
    <p>Délai due diligence : 5 jours ouvrables.</p>
    """.replace(",", " ")
    await _send(settings.admin_email, f"[Logeo Admin] Introduction · #{short}", admin_html)


async def send_verdict_go(db: AsyncSession, courtier: User, deal_id: uuid.UUID):
    from app.models.deal import Deal
    deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = deal_res.scalar_one_or_none()
    duration_html = ""
    if deal and deal.bid_open_at and deal.bid_close_at:
        days = round((deal.bid_close_at - deal.bid_open_at).total_seconds() / 86400, 1)
        close_str = deal.bid_close_at.strftime("%d %b %Y %H:%M UTC")
        duration_html = (
            f"<p>L'enchère est ouverte pendant <strong>{days:g} jour"
            f"{'s' if days >= 2 else ''}</strong> — "
            f"fermeture le <strong>{close_str}</strong>.</p>"
        )

    html = f"""
    <h2>Votre deal a été approuvé !</h2>
    <p>Bonjour {courtier.full_name},</p>
    <p>Bonne nouvelle : votre soumission a été analysée et approuvée par l'équipe Logeo.</p>
    <p>Votre deal est maintenant en ligne et les enchères sont ouvertes aux acheteurs qualifiés.</p>
    {duration_html}
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


async def send_auction_ended_no_winner(db: AsyncSession, courtier: User, deal_id: uuid.UUID, city: str):
    """Cas B : enchère terminée sans bid → courtier peut relancer une nouvelle ronde."""
    html = f"""
    <h2>Votre enchère est terminée sans résultat</h2>
    <p>Bonjour {courtier.full_name},</p>
    <p>L'enchère pour le deal <strong>{city}</strong> est arrivée à terme sans recevoir d'offre.</p>
    <p>Vous pouvez <strong>relancer une nouvelle ronde</strong> de 10 jours depuis votre tableau de bord.
       L'admin Logeo confirmera la republication.</p>
    <a href="{settings.frontend_url}/courtier/deals/{deal_id}">Relancer le deal</a>
    """
    await _send(courtier.email, "[Logeo] Votre enchère est terminée — relancer une nouvelle ronde ?", html)


async def send_new_question(db: AsyncSession, courtier: User, asker_name: str,
                             deal_id: uuid.UUID, city: str, question: str):
    """Notification immédiate au courtier d'une nouvelle question FAQ."""
    truncated = question if len(question) <= 500 else question[:500] + '...'
    html = f"""
    <h2>Nouvelle question sur votre deal {city}</h2>
    <p>Bonjour {courtier.full_name},</p>
    <p>Un acheteur ({asker_name}) vient de poser une question sur l'un de vos deals :</p>
    <blockquote style="border-left:3px solid #FDBA74; padding:8px 12px; background:#FFEDD5; color:#9A3412;">
      {truncated}
    </blockquote>
    <p>Répondez-y depuis votre portail courtier — toutes les Q&R sont visibles
       par les acheteurs qui ont signé le NDA.</p>
    <a href="{settings.frontend_url}/courtier/deals/{deal_id}">Répondre maintenant</a>
    """
    await _send(courtier.email, f"[Logeo] Nouvelle question sur votre deal {city}", html)


async def send_outbid(db: AsyncSession, previous_winner: User, deal_id: uuid.UUID, new_displayed_price: int):
    html = f"""
    <h2>Vous avez été dépassé</h2>
    <p>Bonjour {previous_winner.full_name},</p>
    <p>Une autre offre vient de prendre la tête sur le deal <strong>{str(deal_id)[:8].upper()}</strong>.</p>
    <p>Nouveau prix affiché : <strong>{new_displayed_price:,} CAD</strong>.</p>
    <p>Pour reprendre la tête, placez une nouvelle enchère.</p>
    <a href="{settings.frontend_url}/acheteur/deals/{deal_id}">Voir le deal</a>
    """.replace(",", " ")
    await _send(previous_winner.email, "[Logeo] Vous avez été dépassé sur une enchère", html)


async def send_now_leading(db: AsyncSession, new_winner: User, deal_id: uuid.UUID, displayed_price: int):
    html = f"""
    <h2>Vous êtes maintenant en avance</h2>
    <p>Bonjour {new_winner.full_name},</p>
    <p>Votre dernière offre vous place en tête sur le deal <strong>{str(deal_id)[:8].upper()}</strong>.</p>
    <p>Prix affiché courant : <strong>{displayed_price:,} CAD</strong>.</p>
    <a href="{settings.frontend_url}/acheteur/deals/{deal_id}">Suivre l'enchère</a>
    """.replace(",", " ")
    await _send(new_winner.email, "[Logeo] Vous êtes en tête de l'enchère", html)


async def send_auction_extended(db: AsyncSession, bidders: list[User], deal_id: uuid.UUID, new_close_at):
    when = new_close_at.strftime("%d %b %Y %H:%M") if new_close_at else ""
    for u in bidders:
        html = f"""
        <h2>Enchère prolongée de 10 minutes</h2>
        <p>Bonjour {u.full_name},</p>
        <p>Une offre vient d'être placée à moins de 10 minutes de la fin de l'enchère sur le deal
        <strong>{str(deal_id)[:8].upper()}</strong>. La fermeture est repoussée pour permettre
        une bataille équitable.</p>
        <p>Nouvelle fermeture : <strong>{when}</strong></p>
        <a href="{settings.frontend_url}/acheteur/deals/{deal_id}">Voir le deal</a>
        """
        await _send(u.email, "[Logeo] Enchère prolongée de 10 minutes", html)


async def send_visit_request(
    db: AsyncSession,
    courtier: User,
    acheteur: User,
    deal_id: uuid.UUID,
    proposed_slot: str | None = None,
    note: str | None = None,
):
    """Notification courtier → un acheteur veut visiter. Pas de log dédié (réutilise pas l'enum)."""
    slot_html = f"<p><strong>Créneau proposé :</strong> {proposed_slot}</p>" if proposed_slot else ""
    note_html = f"<p><strong>Message :</strong> {note}</p>" if note else ""
    html = f"""
    <h2>Demande de visite — deal {str(deal_id)[:8].upper()}</h2>
    <p>Bonjour {courtier.full_name},</p>
    <p>Un acheteur Logeo souhaite visiter votre propriété.</p>
    <p><strong>Acheteur :</strong> {acheteur.full_name} — {acheteur.email}{f' — {acheteur.phone}' if acheteur.phone else ''}</p>
    {slot_html}
    {note_html}
    <p>Contactez-le directement pour fixer la visite.</p>
    <a href="{settings.frontend_url}/courtier/deals/{deal_id}">Voir le deal</a>
    """
    await _send(courtier.email, "[Logeo] Demande de visite", html)


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
