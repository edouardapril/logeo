"""Endpoint pour signer une URL Supabase Storage (ou retomber sur l'URL locale)."""
from fastapi import APIRouter, Depends, Query
from app.models.user import User
from app.services.auth import get_current_user
from app.services import storage as storage_svc

router = APIRouter(prefix="/storage", tags=["storage"])


@router.get("/sign")
async def sign(
    path: str = Query(..., description="Path stocké en DB (uploads/... ou bucket/...)"),
    ttl: int | None = Query(None, ge=60, le=86400),
    _user: User = Depends(get_current_user),
):
    """
    Retourne une URL utilisable pour afficher/télécharger le fichier.
    Authentifié uniquement (les bucket-policies Supabase doivent rester restrictives).
    """
    return {"url": storage_svc.signed_url(path, expires_in=ttl)}
