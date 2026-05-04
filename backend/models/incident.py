from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

class IncidenteCreate(BaseModel):
    ciudad: str
    zona: str
    categoria: str
    descripcion: str
    direccion: str
    latitud: float
    longitud: float
    prioridad: str
    usuario: str
    url_evidencia: Optional[str] = None
    entidad_asignada: Optional[str] = None

class IncidenteUpdate(BaseModel):
    estado: Optional[str] = None
    prioridad: Optional[str] = None
    entidad_asignada: Optional[str] = None
    url_evidencia: Optional[str] = None

class IncidenteResponse(BaseModel):
    CiudadZona: str
    FechaID: str
    categoria: str
    descripcion: str
    direccion: str
    latitud: float
    longitud: float
    prioridad: str
    estado: str
    fecha_creacion: str
    usuario: str
    url_evidencia: Optional[str] = None
    entidad_asignada: Optional[str] = None

def build_keys(ciudad: str, zona: str, incident_id: str = None, fecha: str = None):
    pk = f"{ciudad}#{zona}"
    now = fecha or datetime.utcnow().isoformat()
    uid = incident_id or str(uuid.uuid4())
    sk = f"{now}#{uid}"
    return pk, sk, uid