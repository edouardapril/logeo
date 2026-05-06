from pydantic import BaseModel, EmailStr, Field


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None


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
