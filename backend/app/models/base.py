from sqlalchemy import BigInteger, Integer
from sqlalchemy.orm import DeclarativeBase

# BigInteger autoincremental también en SQLite (tests)
BigPK = BigInteger().with_variant(Integer, "sqlite")


class Base(DeclarativeBase):
    pass


class Estado:
    BORRADOR = "BORRADOR"
    EMITIDO = "EMITIDO"
    APROBADO = "APROBADO"
    FACTURADO = "FACTURADO"
    INGRESADO = "INGRESADO_CERRADO"
    ANULADO = "ANULADO"
