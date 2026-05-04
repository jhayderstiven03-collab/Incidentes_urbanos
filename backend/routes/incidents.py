import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from boto3.dynamodb.conditions import Key, Attr

from db.dynamo import get_table
from models.incident import (
    IncidenteCreate, CambioEstadoRequest, ConfirmacionRequest,
    EvidenciaRequest, build_keys
)
from auth import get_current_user, require_role
from audit import log_audit

router = APIRouter(prefix="/incidents", tags=["Incidentes"])

RADIO_DUPLICADO_KM = 0.02  # 20 metros
ESTADOS_VALIDOS = {
    "reportado", "validado", "en_revision",
    "en_proceso", "resuelto", "cerrado", "rechazado"
}
TRANSICIONES = {
    "reportado":    {"validado", "rechazado"},
    "validado":     {"en_revision", "rechazado"},
    "en_revision":  {"en_proceso", "rechazado"},
    "en_proceso":   {"resuelto"},
    "resuelto":     {"cerrado"},
    "cerrado":      set(),
    "rechazado":    set(),
}


# ─── Utilidades ────────────────────────────────────────────────────────────────

def _haversine(lat1, lng1, lat2, lng2) -> float:
    """Distancia en km entre dos coordenadas."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def _buscar_duplicados(lat: float, lng: float, categoria: str) -> list:
    """Busca incidentes similares dentro del radio configurado."""
    tabla = get_table()
    result = tabla.query(
        IndexName="GSI-categoria",
        KeyConditionExpression=Key("categoria").eq(categoria),
        FilterExpression=Attr("estado").is_in(
            ["reportado", "validado", "en_revision", "en_proceso"]
        ),
    )
    duplicados = []
    for item in result.get("Items", []):
        try:
            ilat = float(item.get("latitud", 0))
            ilng = float(item.get("longitud", 0))
            dist = _haversine(lat, lng, ilat, ilng)
            if dist <= RADIO_DUPLICADO_KM:
                duplicados.append({**item, "_distancia_km": round(dist, 4)})
        except Exception:
            continue
    return duplicados


def _get_incidente_by_id(incidente_id: str) -> Optional[dict]:
    """Busca un incidente por su UUID (GSI)."""
    tabla = get_table()
    result = tabla.query(
        IndexName="GSI-incidente-id",
        KeyConditionExpression=Key("incidente_id").eq(incidente_id),
    )
    items = result.get("Items", [])
    return items[0] if items else None


# ─── Endpoints Ciudadano ───────────────────────────────────────────────────────

@router.post("/check-duplicates")
def verificar_duplicados(lat: float, lng: float, categoria: str):
    """Verifica duplicados antes de crear un reporte."""
    return {"duplicados": _buscar_duplicados(lat, lng, categoria)}


ENTIDADES_MAP = {
    "alumbrado": "CENS Grupo EPM",
    "vias": "Alcaldía de Pamplona",
    "residuos": "EMPOPAMPLONA S.A. E.S.P.",
    "seguridad": "organismos de servicio públicos",
    "infraestructura": "Alcaldía de Pamplona",
}

@router.post("/", status_code=201)
def crear_incidente(
    data: IncidenteCreate,
    current_user=Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Debes iniciar sesión para reportar un incidente")

    duplicados = _buscar_duplicados(data.latitud, data.longitud, data.categoria)
    if duplicados:
        return {
            "duplicados_encontrados": True,
            "duplicados": duplicados,
            "mensaje": "Se encontraron incidentes similares cercanos. ¿Deseas confirmar uno de ellos?",
        }

    tabla = get_table()
    pk, sk, uid = build_keys(data.ciudad, data.zona)
    usuario_id = current_user["usuario_id"]
    usuario_nombre = current_user["nombre"]

    entidad_auto = ENTIDADES_MAP.get(data.categoria, "")
    entidad_final = data.entidad_asignada or entidad_auto

    estado_inicial = "reportado"
    now = datetime.utcnow().isoformat()

    item = {
        "CiudadZona":         pk,
        "FechaID":            sk,
        "incidente_id":       uid,
        "categoria":          data.categoria,
        "descripcion":        data.descripcion,
        "direccion":          data.direccion,
        "latitud":            str(data.latitud),
        "longitud":           str(data.longitud),
        "prioridad":          data.prioridad,
        "estado":             estado_inicial,
        "fecha_creacion":     now,
        "usuario_id":         usuario_id,
        "usuario":            usuario_nombre,
        "entidad_asignada":   entidad_final,
        "confirmaciones":     0,
        "confirmado_por":     [],
        "multimedia":         [m.dict() for m in data.multimedia[:3]] if data.multimedia else [],
        "incidentes_relacionados": [],
        "historial_estados":  [
            {
                "estado": estado_inicial,
                "fecha": now,
                "usuario_id": usuario_id,
                "usuario_nombre": usuario_nombre,
                "observacion": "Incidente reportado por ciudadano.",
            }
        ],
    }
    tabla.put_item(Item=item)

    log_audit(
        usuario_id=usuario_id,
        usuario_nombre=usuario_nombre,
        accion="creacion",
        entidad_id=uid,
        detalle={"categoria": data.categoria, "estado": estado_inicial},
    )
    return {
        "duplicados_encontrados": False,
        "mensaje": "Incidente creado",
        "id": uid,
        "CiudadZona": pk,
        "FechaID": sk,
    }


@router.post("/{incidente_id}/confirm")
def confirmar_incidente(
    incidente_id: str,
    data: ConfirmacionRequest,
    current_user=Depends(get_current_user),
):
    item = _get_incidente_by_id(incidente_id)
    if not item:
        raise HTTPException(404, "Incidente no encontrado")

    confirmados = item.get("confirmado_por", [])
    if data.usuario_id in confirmados:
        raise HTTPException(400, "Ya confirmaste este incidente")

    tabla = get_table()
    confirmados.append(data.usuario_id)
    tabla.update_item(
        Key={"CiudadZona": item["CiudadZona"], "FechaID": item["FechaID"]},
        UpdateExpression="SET confirmaciones = confirmaciones + :uno, confirmado_por = :lista",
        ExpressionAttributeValues={":uno": 1, ":lista": confirmados},
    )

    log_audit(
        usuario_id=data.usuario_id,
        usuario_nombre=data.usuario_nombre,
        accion="confirmacion",
        entidad_id=incidente_id,
    )
    return {"mensaje": "Confirmación registrada", "confirmaciones": len(confirmados)}


@router.post("/{incidente_id}/evidence")
def agregar_evidencia(
    incidente_id: str,
    data: EvidenciaRequest,
    current_user=Depends(get_current_user),
):
    item = _get_incidente_by_id(incidente_id)
    if not item:
        raise HTTPException(404, "Incidente no encontrado")

    multimedia = item.get("multimedia", [])
    nueva = {
        "url": data.url,
        "tipo": data.tipo,
        "fecha": datetime.utcnow().isoformat(),
        "usuario_id": data.usuario_id,
    }
    multimedia.append(nueva)

    tabla = get_table()
    tabla.update_item(
        Key={"CiudadZona": item["CiudadZona"], "FechaID": item["FechaID"]},
        UpdateExpression="SET multimedia = :m",
        ExpressionAttributeValues={":m": multimedia},
    )

    log_audit(
        usuario_id=data.usuario_id,
        usuario_nombre=current_user.get("nombre", "usuario") if current_user else "anonimo",
        accion="evidencia",
        entidad_id=incidente_id,
        detalle={"tipo": data.tipo},
    )
    return {"mensaje": "Evidencia agregada", "total_multimedia": len(multimedia)}


@router.get("/")
def listar_incidentes(
    estado: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
):
    tabla = get_table()
    if estado:
        result = tabla.query(
            IndexName="GSI-estado",
            KeyConditionExpression=Key("estado").eq(estado),
        )
    elif categoria:
        result = tabla.query(
            IndexName="GSI-categoria",
            KeyConditionExpression=Key("categoria").eq(categoria),
        )
    else:
        result = tabla.scan()
    return result.get("Items", [])


@router.get("/{incidente_id}")
def obtener_incidente(incidente_id: str):
    item = _get_incidente_by_id(incidente_id)
    if not item:
        raise HTTPException(404, "Incidente no encontrado")
    return item


@router.get("/{incidente_id}/history")
def historial_incidente(incidente_id: str):
    item = _get_incidente_by_id(incidente_id)
    if not item:
        raise HTTPException(404, "Incidente no encontrado")
    return {
        "incidente_id": incidente_id,
        "estado_actual": item.get("estado"),
        "historial": item.get("historial_estados", []),
    }


# ─── Endpoints Operadores+ ─────────────────────────────────────────────────────

@router.put("/{incidente_id}/status")
def cambiar_estado(
    incidente_id: str,
    data: CambioEstadoRequest,
    current_user=Depends(require_role("operador", "supervisor", "admin")),
):
    if data.ciudad_zona and data.fecha_id:
        pk, sk = data.ciudad_zona, data.fecha_id
        tabla = get_table()
        res = tabla.get_item(Key={"CiudadZona": pk, "FechaID": sk})
        item = res.get("Item")
    else:
        item = _get_incidente_by_id(incidente_id)

    if not item:
        raise HTTPException(404, "Incidente no encontrado")

    pk, sk = item["CiudadZona"], item["FechaID"]
    estado_actual = item.get("estado", "reportado")
    nuevo_estado = data.nuevo_estado

    if nuevo_estado not in ESTADOS_VALIDOS:
        raise HTTPException(400, f"Estado inválido: {nuevo_estado}")

    if current_user["rol"] not in ("supervisor", "admin"):
        if nuevo_estado not in TRANSICIONES.get(estado_actual, set()):
            raise HTTPException(400, f"Transición no permitida: {estado_actual} -> {nuevo_estado}")

    now = datetime.utcnow().isoformat()
    historial = item.get("historial_estados", [])
    historial.append({
        "estado": nuevo_estado,
        "fecha": now,
        "usuario_id": current_user["usuario_id"],
        "usuario_nombre": current_user["nombre"],
        "observacion": data.observacion or "",
    })

    tabla = get_table()
    tabla.update_item(
        Key={"CiudadZona": pk, "FechaID": sk},
        UpdateExpression="SET #e = :e, historial_estados = :h",
        ExpressionAttributeNames={"#e": "estado"},
        ExpressionAttributeValues={":e": nuevo_estado, ":h": historial},
    )

    log_audit(
        usuario_id=current_user["usuario_id"],
        usuario_nombre=current_user["nombre"],
        accion="cambio_estado",
        entidad_id=incidente_id,
        detalle={"de": estado_actual, "a": nuevo_estado},
    )
    return {"mensaje": "Estado actualizado"}


@router.delete("/{incidente_id}")
def eliminar_incidente(
    incidente_id: str,
    ciudad_zona: Optional[str] = Query(None),
    fecha_id: Optional[str] = Query(None),
    current_user=Depends(require_role("supervisor", "admin")),
):
    if ciudad_zona and fecha_id:
        pk, sk = ciudad_zona, fecha_id
    else:
        item = _get_incidente_by_id(incidente_id)
        if not item:
            raise HTTPException(404, "Incidente no encontrado")
        pk, sk = item["CiudadZona"], item["FechaID"]

    tabla = get_table()
    tabla.delete_item(Key={"CiudadZona": pk, "FechaID": sk})

    log_audit(
        usuario_id=current_user["usuario_id"],
        usuario_nombre=current_user["nombre"],
        accion="eliminacion",
        entidad_id=incidente_id,
    )
    return {"mensaje": "Incidente eliminado"}