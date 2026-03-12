"""Environment configuration with validation."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    openai_api_key: str
    supabase_url: str
    supabase_anon_key: str
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_phone_number: str
    twilio_messaging_service_sid: str
    builder_api_url: str
    supabase_storage_bucket: str
    recording_retention_hours: int
    port: int
    host: str

    @classmethod
    def from_env(cls) -> "Config":
        openai_api_key = os.getenv("OPENAI_API_KEY", "")
        if not openai_api_key:
            raise ValueError("OPENAI_API_KEY is required")

        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
        supabase_anon_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
        if not supabase_url or not supabase_anon_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY are required")

        twilio_account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        twilio_phone_number = os.getenv("TWILIO_PHONE_NUMBER", "")
        twilio_messaging_service_sid = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "")

        return cls(
            openai_api_key=openai_api_key,
            supabase_url=supabase_url,
            supabase_anon_key=supabase_anon_key,
            twilio_account_sid=twilio_account_sid,
            twilio_auth_token=twilio_auth_token,
            twilio_phone_number=twilio_phone_number,
            twilio_messaging_service_sid=twilio_messaging_service_sid,
            builder_api_url=os.getenv("BUILDER_API_URL", "https://pravik-builder.vercel.app"),
            supabase_storage_bucket=os.getenv("SUPABASE_STORAGE_BUCKET", "call-recordings"),
            recording_retention_hours=int(os.getenv("RECORDING_RETENTION_HOURS", "72")),
            port=int(os.getenv("PORT", "8080")),
            host=os.getenv("HOST", "0.0.0.0"),
        )


config = Config.from_env()
