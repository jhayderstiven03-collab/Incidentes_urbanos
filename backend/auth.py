import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from db.dynamo import get_table
from models.incident import UsuarioRegister, ROLES_VALIDOS

SECRET_KEY = os.getenv("JWT_SECRET", "urban-incidents-secret-2024-change-in-prod")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


# ─── Passwords ─────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── JWT ───────────────────────────────────────────────────────────────────────

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


# ─── Dependency: usuario actual ─────────────────────────────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    if credentials is None:
        return None  # Rutas públicas aceptan None
    payload = decode_token(credentials.credentials)
    return payload  # {"usuario_id", "email", "rol", "nombre"}


def require_role(*roles):
    """Factory: exige que el usuario tenga uno de los roles indicados."""
    def dependency(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    ):
        if credentials is None:
            raise HTTPException(status_code=401, detail="Autenticación requerida")
        payload = decode_token(credentials.credentials)
        if payload.get("rol") not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Rol insuficiente. Se requiere uno de: {list(roles)}",
            )
        return payload
    return dependency


# ─── Helpers DynamoDB usuarios ─────────────────────────────────────────────────

def get_user_by_email(email: str) -> Optional[dict]:
    tabla = get_table("Usuarios")
    result = tabla.query(
        IndexName="GSI-email",
        KeyConditionExpression="email = :e",
        ExpressionAttributeValues={":e": email},
    )
    items = result.get("Items", [])
    return items[0] if items else None


def create_user(data: UsuarioRegister) -> dict:
    if data.rol not in ROLES_VALIDOS:
        raise HTTPException(400, f"Rol inválido. Debe ser uno de: {ROLES_VALIDOS}")

    existing = get_user_by_email(data.email)
    if existing:
        raise HTTPException(400, "El email ya está registrado")

    tabla = get_table("Usuarios")
    uid = str(uuid.uuid4())
    item = {
        "usuario_id": uid,
        "email": data.email,
        "nombre": data.nombre,
        "telefono": data.telefono,
        "direccion": data.direccion,
        "password_hash": hash_password(data.password),
        "rol": data.rol,
        "activo": True,
        "fecha_registro": datetime.utcnow().isoformat(),
    }
    tabla.put_item(Item=item)
    return item
