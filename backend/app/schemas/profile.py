from pydantic import BaseModel, EmailStr, Field, field_serializer
from app.services import storage as storage_svc


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    oaciq_number: str | None = None  # courtier-only ; 8 chiffres


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class NotificationPrefs(BaseModel):
    email_notifications: bool


class ProfileView(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    phone: str | None = None
    profile_photo_path: str | None = None
    email_notifications: bool = True
    is_active: bool = True
    is_qualified: bool = False

    @field_serializer('profile_photo_path')
    def _ser_profile_photo_path(self, v):
        return storage_svc.to_signed_url(v)
