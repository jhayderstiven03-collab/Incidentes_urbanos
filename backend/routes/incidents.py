from fastapi import APIRouter, HTTPException
from models.incident import IncidenteCreate, IncidenteUpdate, build_keys
from db.dynamo import get_table
from datetime import datetime
import uuid
from boto3.dynamodb.conditions import Key, Attr

router = APIRouter(prefix="/incidents", tags=["Incidentes"])


@router.post("/", status_code=201)
def crear_incidente(data: IncidenteCreate):
    tabla = get_table()
    pk, sk, uid = build_keys(data.ciudad, data.zona)

    item = {
        "CiudadZona":       pk,
        "FechaID":          sk,
        "incidente_id":     uid,
        "categoria":        data.categoria,
        "descripcion":      data.descripcion,
        "direccion":        data.direccion,
        "latitud":          str(data.latitud),
        "longitud":         str(data.longitud),
        "prioridad":        data.prioridad,
        "estado":           "pendiente",
        "fecha_creacion":   datetime.utcnow().isoformat(),
        "usuario":          data.usuario,
        "url_evidencia":    data.url_evidencia or "",
        "entidad_asignada": data.entidad_asignada or "",
    }

    tabla.put_item(Item=item)
    return {"mensaje": "Incidente creado", "id": uid, "CiudadZona": pk, "FechaID": sk}


@router.get("/")
def listar_incidentes():
    tabla = get_table()
    result = tabla.scan()
    return result.get("Items", [])


@router.get("/categoria/{categoria}")
def listar_por_categoria(categoria: str):
    tabla = get_table()
    result = tabla.scan(FilterExpression=Attr("categoria").eq(categoria))
    return result.get("Items", [])


@router.get("/estado/{estado}")
def listar_por_estado(estado: str):
    tabla = get_table()
    result = tabla.scan(FilterExpression=Attr("estado").eq(estado))
    return result.get("Items", [])


@router.get("/{ciudad}/{zona}")
def listar_por_zona(ciudad: str, zona: str):
    tabla = get_table()
    pk = f"{ciudad}#{zona}"
    result = tabla.query(KeyConditionExpression=Key("CiudadZona").eq(pk))
    return result.get("Items", [])


@router.put("/{ciudad_zona}/{fecha_id}")
def actualizar_incidente(ciudad_zona: str, fecha_id: str, data: IncidenteUpdate):
    tabla = get_table()

    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
    names = {f"#{k}": k for k in updates}
    values = {f":{k}": v for k, v in updates.items()}

    tabla.update_item(
        Key={"CiudadZona": ciudad_zona, "FechaID": fecha_id},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )
    return {"mensaje": "Incidente actualizado"}


@router.delete("/{ciudad_zona}/{fecha_id}")
def eliminar_incidente(ciudad_zona: str, fecha_id: str):
    tabla = get_table()
    tabla.delete_item(Key={"CiudadZona": ciudad_zona, "FechaID": fecha_id})
    return {"mensaje": "Incidente eliminado"}