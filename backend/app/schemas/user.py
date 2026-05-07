import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import UserRole


import re

# Téléphone canadien : 10 chiffres acceptés en plusieurs formats
# (514) 555-1234 · 514-555-1234 · 5145551234 · +1 514 555 1234
_CA_PHONE_RE = re.compile(r"^\+?1?[\s.-]?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})$")


def _validate_canadian_phone(v: str) -> str:
    if not v:
        raise ValueError("Numéro de téléphone requis")
    cleaned = v.strip()
    if not _CA_PHONE_RE.match(cleaned):
        raise ValueError("Numéro de téléphone invalide. Format attendu : (xxx) xxx-xxxx")
    # Normalise à "(XXX) XXX-XXXX"
    m = _CA_PHONE_RE.match(cleaned)
    return f"({m.group(1)}) {m.group(2)}-{m.group(3)}"


class UserRegisterCourtier(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    oaciq_number: str
    agency_name: str
    # T&C — sprint final item 9
    tos_cgu: bool = False
    tos_privacy: bool = False
    tos_canadian_resident: bool = False

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _validate_canadian_phone(v)


class UserRegisterAcheteur(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    # T&C — sprint final item 9 (acheteurs ont en plus la confirmation investisseur qualifié)
    tos_cgu: bool = False
    tos_privacy: bool = False
    tos_canadian_resident: bool = False
    tos_qualified_investor: bool = False

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _validate_canadian_phone(v)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: uuid.UUID


class UserPublic(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    phone: str | None = None
    is_active: bool
    is_qualified: bool
    engagement_signed_at: datetime | None = None
    profile_photo_path: str | None = None
    email_notifications: bool = True
    email_verified: bool = True
    oaciq_number: str | None = None
    agency_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserAdminView(UserPublic):
    phone: str | None
    oaciq_number: str | None
    agency_name: str | None
    convention_signed_at: datetime | None
    engagement_signed_at: datetime | None

    model_config = {"from_attributes": True}


class UserQualifyRequest(BaseModel):
    is_qualified: bool
