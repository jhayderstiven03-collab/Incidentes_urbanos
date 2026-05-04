from fastapi import APIRouter
from db.dynamo import get_table
from collections import Counter

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/zones")
def get_zones_analytics():
    tabla = get_table()
    result = tabla.scan()
    items = result.get("Items", [])
    
    # CiudadZona is "Ciudad#Zona"
    zones = [item.get("CiudadZona", "Unknown#Unknown") for item in items]
    return Counter(zones)

@router.get("/categories")
def get_categories_analytics():
    tabla = get_table()
    result = tabla.scan()
    items = result.get("Items", [])
    
    categories = [item.get("categoria", "Otros") for item in items]
    return Counter(categories)

@router.get("/priorities")
def get_priorities_analytics():
    tabla = get_table()
    result = tabla.scan()
    items = result.get("Items", [])
    
    priorities = [item.get("prioridad", "baja") for item in items]
    return Counter(priorities)

@router.get("/summary")
def get_summary_analytics():
    tabla = get_table()
    result = tabla.scan()
    items = result.get("Items", [])
    
    total = len(items)
    pending = len([i for i in items if i.get("estado") == "pendiente"])
    solved = len([i for i in items if i.get("estado") == "resuelto"])
    
    return {
        "total": total,
        "pending": pending,
        "solved": solved,
        "categories": Counter([i.get("categoria") for i in items]),
        "priorities": Counter([i.get("prioridad") for i in items]),
        "zones": Counter([i.get("CiudadZona") for i in items])
    }
