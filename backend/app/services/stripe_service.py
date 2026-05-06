"""
Couche fine au-dessus de l'API Stripe.

Toutes les fonctions sont synchrones (le SDK Stripe est sync) et lèvent
StripeError en cas d'échec — l'appelant décide quoi faire.
"""
import logging
from typing import Any
import stripe
from app.config import get_settings

settings = get_settings()
stripe.api_key = settings.stripe_secret_key

log = logging.getLogger("logeo.stripe")
log.setLevel(logging.INFO)


def is_configured() -> bool:
    return bool(settings.stripe_secret_key)


def _redact(key: str) -> str:
    if not key:
        return "<empty>"
    return f"{key[:8]}...({len(key)} chars)"


def runtime_diagnostic() -> dict:
    """Retourne un diag non sensible des clés actuelles (préfixes)."""
    return {
        "secret_key_prefix": _redact(settings.stripe_secret_key),
        "publishable_key_prefix": _redact(settings.stripe_publishable_key),
        "secret_key_mode": (
            "test" if settings.stripe_secret_key.startswith("sk_test_") else
            "live" if settings.stripe_secret_key.startswith("sk_live_") else "unknown"
        ),
        "publishable_key_mode": (
            "test" if settings.stripe_publishable_key.startswith("pk_test_") else
            "live" if settings.stripe_publishable_key.startswith("pk_live_") else "unknown"
        ),
        "keys_same_account": (
            settings.stripe_secret_key[8:16] == settings.stripe_publishable_key[8:16]
            if (settings.stripe_secret_key and settings.stripe_publishable_key)
            else False
        ),
    }


def get_or_create_customer(user_id: str, email: str, full_name: str | None,
                           existing_customer_id: str | None) -> str:
    if existing_customer_id:
        try:
            existing = stripe.Customer.retrieve(existing_customer_id)
            # Si le customer a été supprimé côté Stripe, retrieve renvoie {deleted: true}
            # sans lever d'exception → on doit en recréer un.
            if getattr(existing, "deleted", False):
                log.warning(
                    "stripe.customer %s is deleted in Stripe, recreating for user=%s",
                    existing_customer_id, user_id,
                )
            else:
                log.info("stripe.customer reused id=%s for user=%s", existing_customer_id, user_id)
                return existing_customer_id
        except stripe.InvalidRequestError as e:
            log.warning("stripe.customer retrieve failed (will recreate): %s", e)

    customer = stripe.Customer.create(
        email=email,
        name=full_name or email,
        metadata={"logeo_user_id": str(user_id)},
    )
    log.info("stripe.customer created id=%s for user=%s email=%s", customer.id, user_id, email)
    return customer.id


def create_setup_intent(customer_id: str) -> dict[str, Any]:
    log.info("stripe.setup_intent.create customer=%s", customer_id)
    try:
        intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=["card"],
            usage="off_session",
        )
    except stripe.StripeError as e:
        body = getattr(e, "user_message", None) or str(e)
        code = getattr(e, "code", None)
        http_status = getattr(e, "http_status", None)
        log.error(
            "stripe.setup_intent.create FAILED customer=%s code=%s status=%s body=%s",
            customer_id, code, http_status, body,
        )
        raise
    log.info("stripe.setup_intent OK id=%s status=%s", intent.id, intent.status)
    return {
        "client_secret": intent.client_secret,
        "id": intent.id,
        "status": intent.status,
    }


def attach_payment_method(customer_id: str, payment_method_id: str) -> dict[str, Any]:
    log.info("stripe.pm.attach pm=%s customer=%s", payment_method_id, customer_id)
    try:
        stripe.PaymentMethod.attach(payment_method_id, customer=customer_id)
        stripe.Customer.modify(
            customer_id,
            invoice_settings={"default_payment_method": payment_method_id},
        )
        pm = stripe.PaymentMethod.retrieve(payment_method_id)
    except stripe.StripeError as e:
        log.error("stripe.pm.attach FAILED pm=%s code=%s body=%s",
                  payment_method_id, getattr(e, "code", None), str(e))
        raise
    card = pm.get("card") or {}
    return {
        "payment_method_id": payment_method_id,
        "brand": card.get("brand"),
        "last4": card.get("last4"),
        "exp_month": card.get("exp_month"),
        "exp_year": card.get("exp_year"),
    }


def detach_payment_method(payment_method_id: str) -> None:
    try:
        stripe.PaymentMethod.detach(payment_method_id)
    except stripe.InvalidRequestError:
        pass


def list_customer_cards(customer_id: str) -> list[dict]:
    """
    Liste les cartes attachées à un customer Stripe.
    Retourne [{payment_method_id, brand, last4, exp_month, exp_year, created}, ...]
    triées de la plus récente à la plus ancienne.
    """
    log.info("stripe.pm.list customer=%s", customer_id)
    try:
        result = stripe.PaymentMethod.list(customer=customer_id, type="card", limit=20)
    except stripe.StripeError as e:
        log.error("stripe.pm.list FAILED customer=%s err=%s", customer_id, str(e))
        return []

    items = list(result.data) if hasattr(result, "data") else list(result)
    out: list[dict] = []
    for pm in items:
        card = getattr(pm, "card", None)
        out.append({
            "payment_method_id": pm.id,
            "brand":     getattr(card, "brand", None) if card else None,
            "last4":     getattr(card, "last4", None) if card else None,
            "exp_month": getattr(card, "exp_month", None) if card else None,
            "exp_year":  getattr(card, "exp_year", None) if card else None,
            "created":   getattr(pm, "created", 0),
        })
    out.sort(key=lambda c: c.get("created") or 0, reverse=True)
    return out


def get_default_payment_method_id(customer_id: str) -> str | None:
    """Récupère le PM par défaut configuré sur le customer Stripe (si présent)."""
    try:
        c = stripe.Customer.retrieve(customer_id)
        if getattr(c, "deleted", False):
            return None
        invoice_settings = getattr(c, "invoice_settings", None)
        if not invoice_settings:
            return None
        return getattr(invoice_settings, "default_payment_method", None)
    except stripe.StripeError as e:
        log.warning("stripe.customer retrieve for default_pm failed: %s", e)
        return None


def charge_off_session(
    customer_id: str,
    payment_method_id: str,
    amount_cents: int,
    currency: str,
    idempotency_key: str,
    metadata: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Débit hors session sur la carte sauvegardée du client.
    Lève stripe.CardError / stripe.StripeError en cas d'échec.
    """
    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency=currency,
        customer=customer_id,
        payment_method=payment_method_id,
        off_session=True,
        confirm=True,
        metadata=metadata or {},
        idempotency_key=idempotency_key,
    )
    return {
        "id": intent.id,
        "status": intent.status,
        "amount": intent.amount,
        "currency": intent.currency,
        "last_payment_error": intent.last_payment_error,
    }


def construct_webhook_event(payload: bytes, signature: str) -> stripe.Event:
    return stripe.Webhook.construct_event(
        payload, signature, settings.stripe_webhook_secret
    )
