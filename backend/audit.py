import uuid
from datetime import datetime
from db.dynamo import get_table


def log_audit(
    usuario_id: str,
    usuario_nombre: str,
    accion: str,
    entidad_id: str,
    detalle: dict = {},
):
    """Registra una entrada de auditoría en la tabla AuditLog."""
    try:
        tabla = get_table("AuditLog")
        tabla.put_item(
            Item={
                "audit_id": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat(),
                "usuario_id": usuario_id,
                "usuario_nombre": usuario_nombre,
                "accion": accion,
                "entidad_id": entidad_id,
                "detalle": detalle,
            }
        )
    except Exception as e:
        # No interrumpir el flujo principal si el audit falla
        print(f"⚠️ Fallo al registrar auditoría: {e}")
