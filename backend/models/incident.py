from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
import uuid


# ─── Incidentes ────────────────────────────────────────────────────────────────

class EstadoHistorial(BaseModel):
    estado: str
    fecha: str
    usuario_id: str
    usuario_nombre: str
    observacion: Optional[str] = ""


class MultimediaItem(BaseModel):
    url: str
    tipo: str = "imagen"
    fecha: str
    usuario_id: str


class IncidenteCreate(BaseModel):
    ciudad: str
    zona: str
    categoria: str
    descripcion: str
    direccion: str
    latitud: float
    longitud: float
    prioridad: str
    usuario_id: Optional[str] = "anonimo"
    usuario_nombre: str
    multimedia: Optional[List[MultimediaItem]] = Field(default_factory=list, max_items=3)
    entidad_asignada: Optional[str] = None


class IncidenteUpdate(BaseModel):
    estado: Optional[str] = None
    prioridad: Optional[str] = None
    entidad_asignada: Optional[str] = None
    url_evidencia: Optional[str] = None
    observacion: Optional[str] = None


class CambioEstadoRequest(BaseModel):
    nuevo_estado: str
    observacion: Optional[str] = ""
    ciudad_zona: Optional[str] = None
    fecha_id: Optional[str] = None


class ConfirmacionRequest(BaseModel):
    usuario_id: str
    usuario_nombre: str


class EvidenciaRequest(BaseModel):
    url: str
    tipo: str = "imagen"
    usuario_id: str


class MergeRequest(BaseModel):
    incidente_origen_id: str   # el que se absorbe
    incidente_destino_id: str  # el que queda
    operador_id: str
    observacion: Optional[str] = ""


# ─── Usuarios ──────────────────────────────────────────────────────────────────

ROLES_VALIDOS = {"ciudadano", "operador", "supervisor", "admin"}

class UsuarioRegister(BaseModel):
    nombre: str
    email: str
    password: str
    telefono: str
    direccion: str
    rol: str = "ciudadano"


class UsuarioLogin(BaseModel):
    email: str
    password: str


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[bool] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    nombre: str
    usuario_id: str


# ─── Audit ─────────────────────────────────────────────────────────────────────

class AuditEntry(BaseModel):
    usuario_id: str
    usuario_nombre: str
    accion: str   # creacion | edicion | cambio_estado | eliminacion | asignacion | validacion | fusion
    entidad_id: str
    detalle: dict = {}


# ─── Helpers ───────────────────────────────────────────────────────────────────

def build_keys(ciudad: str, zona: str, incident_id: str = None, fecha: str = None):
    pk = f"{ciudad}#{zona}"
    now = fecha or datetime.utcnow().isoformat()
    uid = incident_id or str(uuid.uuid4())
    sk = f"{now}#{uid}"
    return pk, sk, uid