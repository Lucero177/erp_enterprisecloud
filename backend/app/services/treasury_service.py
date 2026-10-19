from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import CuentaPorCobrar, CuentaPorPagar, MovimientoCaja, Usuario
from app.services import audit_service
from app.services.pricing import D, q2


def registrar_pago(db: Session, user: Usuario, cuenta, kind: str, monto, forma_pago_id, concepto) -> MovimientoCaja:
    """kind = 'cxc' (cobro, ingreso a caja) | 'cxp' (pago, egreso de caja)."""
    if cuenta.estado in ("PAGADO", "ANULADO"):
        raise HTTPException(409, f"La cuenta está {cuenta.estado}")
    m = q2(monto)
    if m <= 0:
        raise HTTPException(422, "El monto debe ser mayor a cero")
    if m > D(cuenta.saldo):
        raise HTTPException(422, f"El monto excede el saldo pendiente ({cuenta.saldo})")
    cuenta.saldo = D(cuenta.saldo) - m
    cuenta.estado = "PAGADO" if cuenta.saldo == 0 else "PARCIAL"
    if kind == "cxc":
        mov = MovimientoCaja(tipo="INGRESO", monto=m, moneda_id=cuenta.venta.moneda_id, forma_pago_id=forma_pago_id,
                             cxc_id=cuenta.id, usuario_id=user.id,
                             concepto=concepto or f"Cobro {cuenta.venta.numero_ov}")
    else:
        mov = MovimientoCaja(tipo="EGRESO", monto=m, moneda_id=cuenta.compra.moneda_id, forma_pago_id=forma_pago_id,
                             cxp_id=cuenta.id, usuario_id=user.id,
                             concepto=concepto or f"Pago {cuenta.compra.numero_oc}")
    db.add(mov)
    audit_service.log(db, user.id, "PAGO" if kind == "cxp" else "COBRO", "tesoreria", f"{kind}:{cuenta.id}",
                      detalle={"monto": float(m), "saldo": float(cuenta.saldo)})
    return mov
