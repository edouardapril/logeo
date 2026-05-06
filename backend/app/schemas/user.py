import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import UserRole


class UserRegisterCourtier(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    oaciq_number: str
    agency_name: str
    # T&C — sprint final item 9
    tos_cgu: bool = False
    tos_privacy: bool = False
    tos_canadian_resident: bool = False


class UserRegisterAcheteur(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    # T&C — sprint final item 9 (acheteurs ont en plus la confirmation investisseur qualifié)
    tos_cgu: bool = False
    tos_privacy: bool = False
    tos_canadian_resident: bool = False
    tos_qualified_investor: bool = False


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
