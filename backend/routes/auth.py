from fastapi import APIRouter
from auth import create_token, verify_password, get_user_by_email, create_user
from models.incident import UsuarioLogin, UsuarioRegister, TokenResponse
from fastapi import HTTPException

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/register", status_code=201)
def register(data: UsuarioRegister):
    user = create_user(data)
    return {"mensaje": "Usuario registrado", "usuario_id": user["usuario_id"]}


@router.post("/login", response_model=TokenResponse)
def login(data: UsuarioLogin):
    user = get_user_by_email(data.email)
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not user.get("activo", True):
        raise HTTPException(status_code=403, detail="Cuenta desactivada")

    token = create_token({
        "usuario_id": user["usuario_id"],
        "email": user["email"],
        "nombre": user["nombre"],
        "rol": user["rol"],
    })
    return TokenResponse(
        access_token=token,
        rol=user["rol"],
        nombre=user["nombre"],
        usuario_id=user["usuario_id"],
    )
