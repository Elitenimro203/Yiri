from pydantic import BaseModel


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    cle_p256dh: str
    cle_auth: str


class PushSubscriptionOut(BaseModel):
    id_subscription: int
    endpoint: str

    class Config:
        from_attributes = True


class VapidPublicKeyOut(BaseModel):
    vapid_public_key: str | None
