"""Webhooks Stripe + endpoints publics aux paiements."""
import json
import uuid
import logging
from fastapi import APIRouter, Request, HTTPException, Header, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import stripe

from app.config import get_settings
from app.database import get_db
from app.models.payment import Payment, PaymentState
from app.models.bid import Bid, PaymentStatus as BidPaymentStatus
from app.services import stripe_service
from datetime import datetime, timezone

settings = get_settings()
log = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])


def _utcnow():
    return datetime.now(timezone.utc)


@router.post("/webhook", status_code=200)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="stripe-signature"),
    db: AsyncSession = Depends(get_db),
):
    payload = await request.body()

    if settings.stripe_webhook_secret and stripe_signature:
        try:
            event = stripe_service.construct_webhook_event(payload, stripe_signature)
        except (ValueError, stripe.SignatureVerificationError):
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # Mode dev sans secret webhook : on parse à nu (NE PAS faire en prod)
        try:
            event = stripe.Event.construct_from(
                json.loads(payload.decode("utf-8")), stripe.api_key
            )
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload")

    type_ = event["type"]
    obj = event["data"]["object"]

    if type_ in ("payment_intent.succeeded", "payment_intent.payment_failed"):
        intent_id = obj.get("id")
        metadata = obj.get("metadata") or {}
        logeo_pid = metadata.get("logeo_payment_id")

        payment = None
        if logeo_pid:
            try:
                pid = uuid.UUID(logeo_pid)
                res = await db.execute(select(Payment).where(Payment.id == pid))
                payment = res.scalar_one_or_none()
            except ValueError:
                pass
        if payment is None and intent_id:
            res = await db.execute(
                select(Payment).where(Payment.stripe_payment_intent_id == intent_id)
            )
            payment = res.scalar_one_or_none()

        if payment is None:
            log.warning("Webhook %s for unknown payment intent %s", type_, intent_id)
            return {"received": True}

        if type_ == "payment_intent.succeeded" and payment.state != PaymentState.succeeded:
            payment.state = PaymentState.succeeded
            payment.succeeded_at = _utcnow()
            payment.stripe_payment_intent_id = intent_id

            # Met aussi à jour le bid associé pour cohérence
            bid_res = await db.execute(select(Bid).where(Bid.id == payment.bid_id))
            bid = bid_res.scalar_one_or_none()
            if bid:
                if payment.type.value == "deposit":
                    bid.payment_status = BidPaymentStatus.deposit_confirmed
                elif payment.type.value == "balance":
                    bid.payment_status = BidPaymentStatus.paid

        elif type_ == "payment_intent.payment_failed":
            payment.state = PaymentState.failed
            payment.failed_at = _utcnow()
            err = obj.get("last_payment_error") or {}
            payment.failure_code = err.get("code")
            payment.failure_message = err.get("message")
            payment.stripe_payment_intent_id = intent_id

        await db.flush()

    return {"received": True}
