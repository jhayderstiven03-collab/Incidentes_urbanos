from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from boto3.dynamodb.conditions import Key

from db.dynamo import get_table
from models.incident import UsuarioUpdate, MergeRequest
from auth import require_role
from audit import log_audit

router = APIRouter(prefix="/admin", tags=["Administración"])


@router.get("/incidents")
def listar_todos(
    estado: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    prioridad: Optional[str] = Query(None),
    current_user=Depends(require_role("operador", "supervisor", "admin")),
):
    tabla = get_table()
    if estado:
        result = tabla.query(
            IndexName="GSI-estado",
            KeyConditionExpression=Key("estado").eq(estado),
        )
        items = result.get("Items", [])
    elif categoria:
        result = tabla.query(
            IndexName="GSI-categoria",
            KeyConditionExpression=Key("categoria").eq(categoria),
        )
        items = result.get("Items", [])
    else:
        items = tabla.scan().get("Items", [])

    # Filtro adicional por prioridad
    if prioridad:
        items = [i for i in items if i.get("prioridad") == prioridad]

    # Ordenar por fecha de creación descendente
    items.sort(key=lambda x: x.get("fecha_creacion", ""), reverse=True)
    return items


@router.post("/incidents/merge")
def fusionar_incidentes(
    data: MergeRequest,
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Fusiona el incidente_origen en incidente_destino."""
    from routes.incidents import _get_incidente_by_id

    origen = _get_incidente_by_id(data.incidente_origen_id)
    destino = _get_incidente_by_id(data.incidente_destino_id)

    if not origen or not destino:
        raise HTTPException(404, "Uno o ambos incidentes no encontrados")

    tabla = get_table()

    # Incrementar confirmaciones del destino
    conf_origen = int(origen.get("confirmaciones", 0))
    relacionados = destino.get("incidentes_relacionados", [])
    if data.incidente_origen_id not in relacionados:
        relacionados.append(data.incidente_origen_id)

    tabla.update_item(
        Key={"CiudadZona": destino["CiudadZona"], "FechaID": destino["FechaID"]},
        UpdateExpression=(
            "SET confirmaciones = confirmaciones + :c, "
            "incidentes_relacionados = :r"
        ),
        ExpressionAttributeValues={
            ":c": conf_origen + 1,
            ":r": relacionados,
        },
    )

    # Marcar el origen como rechazado/fusionado
    hist = origen.get("historial_estados", [])
    from datetime import datetime
    hist.append({
        "estado": "rechazado",
        "fecha": datetime.utcnow().isoformat(),
        "usuario_id": current_user["usuario_id"],
        "usuario_nombre": current_user["nombre"],
        "observacion": f"Fusionado con incidente {data.incidente_destino_id}. {data.observacion}",
    })
    tabla.update_item(
        Key={"CiudadZona": origen["CiudadZona"], "FechaID": origen["FechaID"]},
        UpdateExpression="SET #e = :e, historial_estados = :h",
        ExpressionAttributeNames={"#e": "estado"},
        ExpressionAttributeValues={":e": "rechazado", ":h": hist},
    )

    log_audit(
        usuario_id=current_user["usuario_id"],
        usuario_nombre=current_user["nombre"],
        accion="fusion",
        entidad_id=data.incidente_destino_id,
        detalle={"origen": data.incidente_origen_id, "observacion": data.observacion},
    )
    return {"mensaje": "Incidentes fusionados correctamente"}


class AssignRequest(BaseModel):
    entidad: str
    ciudad_zona: str
    fecha_id: str

@router.put("/incidents/{incidente_id}/assign")
def asignar_responsable(
    incidente_id: str,
    data: AssignRequest,
    current_user=Depends(require_role("operador", "supervisor", "admin")),
):
    entidad = data.entidad
    tabla = get_table()

    # Usar la clave primaria directamente en lugar del GSI
    res = tabla.get_item(Key={"CiudadZona": data.ciudad_zona, "FechaID": data.fecha_id})
    item = res.get("Item")
    if not item:
        raise HTTPException(404, "Incidente no encontrado")

    tabla.update_item(
        Key={"CiudadZona": data.ciudad_zona, "FechaID": data.fecha_id},
        UpdateExpression="SET entidad_asignada = :e",
        ExpressionAttributeValues={":e": entidad},
    )
    log_audit(
        usuario_id=current_user["usuario_id"],
        usuario_nombre=current_user["nombre"],
        accion="asignacion",
        entidad_id=incidente_id,
        detalle={"entidad": entidad},
    )
    return {"mensaje": f"Incidente asignado a '{entidad}'"}


# ─── Gestión de Usuarios ───────────────────────────────────────────────────────

@router.get("/users")
def listar_usuarios(
    current_user=Depends(require_role("admin")),
):
    tabla = get_table("Usuarios")
    items = tabla.scan().get("Items", [])
    # No exponer password_hash
    return [{k: v for k, v in u.items() if k != "password_hash"} for u in items]


@router.put("/users/{usuario_id}")
def actualizar_usuario(
    usuario_id: str,
    data: UsuarioUpdate,
    current_user=Depends(require_role("admin")),
):
    tabla = get_table("Usuarios")
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No hay campos para actualizar")

    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
    names = {f"#{k}": k for k in updates}
    values = {f":{k}": v for k, v in updates.items()}

    tabla.update_item(
        Key={"usuario_id": usuario_id},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )
    log_audit(
        usuario_id=current_user["usuario_id"],
        usuario_nombre=current_user["nombre"],
        accion="edicion_usuario",
        entidad_id=usuario_id,
        detalle=updates,
    )
    return {"mensaje": "Usuario actualizado"}


# ─── Auditoría ────────────────────────────────────────────────────────────────

@router.get("/audit")
def ver_auditoria(
    current_user=Depends(require_role("supervisor", "admin")),
    limit: int = Query(50, le=200),
):
    tabla = get_table("AuditLog")
    items = tabla.scan(Limit=limit).get("Items", [])
    items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return items
