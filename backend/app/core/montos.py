"""Contrato monetario de la aplicacion.

El catalogo aceptaba publicar hasta NUMERIC(12,2), pero el carrito y las ordenes
guardaban NUMERIC(10,2). Un precio de cien millones o mas hacia estallar el
INSERT y la API devolvia 500 de PostgreSQL, no un mensaje. La migracion
`a1c4f7e9b2d3` unifico los tipos; este modulo pone el mismo limite en la API,
para que un monto fuera de rango se rechace ANTES de escribir y con un 4xx que
se entiende.

  precio unitario y snapshots   NUMERIC(12,2)   hasta 9.999.999.999,99
  totales, subtotales y envio   NUMERIC(14,2)   hasta 999.999.999.999,99
  montos de pago                NUMERIC(14,2)

Los limites de aca y los de la migracion tienen que moverse juntos.
"""
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException

# NUMERIC(12,2): doce digitos en total, dos decimales.
PRECIO_UNITARIO_MAXIMO = Decimal("9999999999.99")
# NUMERIC(14,2).
TOTAL_MAXIMO = Decimal("999999999999.99")


def _a_decimal(valor) -> Decimal:
    try:
        return Decimal(str(valor))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Importe inválido")


def formatear(monto) -> str:
    """Formato argentino: punto para miles, coma para decimales."""
    entero, _, decimales = f"{_a_decimal(monto):.2f}".partition(".")
    negativo = entero.startswith("-")
    entero = entero.lstrip("-")
    grupos = []
    while len(entero) > 3:
        grupos.insert(0, entero[-3:])
        entero = entero[:-3]
    grupos.insert(0, entero)
    return f"{'-' if negativo else ''}{'.'.join(grupos)},{decimales}"


# Envío sin cargo. Existe como Decimal para que nadie escriba 0.0 y arrastre
# un float dentro de una suma monetaria.
SIN_CARGO = Decimal("0")


def importe_de_linea(precio, cantidad: int) -> Decimal:
    """Precio unitario por cantidad, siempre en Decimal.

    No redondea, y no hace falta: un NUMERIC(12,2) multiplicado por un entero
    da como mucho dos decimales, y sumar dos decimales sigue dando dos. Si
    alguna vez hiciera falta una politica de redondeo, se decide aca y en
    ningun otro lado.

    Existe para que la multiplicacion monetaria se escriba UNA vez. Cada
    `float(precio) * cantidad` suelto era una oportunidad de perder centavos:
    99 por 9.999.999.999,97 da 989.999.999.997,03 exacto y 989.999.999.997,0299
    en binario.
    """
    return _a_decimal(precio) * cantidad


def validar_precio_unitario(precio, que: str = "El precio") -> Decimal:
    """Un precio publicable tiene que entrar en NUMERIC(12,2)."""
    valor = _a_decimal(precio)
    if valor > PRECIO_UNITARIO_MAXIMO:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{que} de ${formatear(valor)} supera el máximo admitido de "
                f"${formatear(PRECIO_UNITARIO_MAXIMO)}"
            ),
        )
    return valor


def validar_total(total, que: str = "El total") -> Decimal:
    """Un total calculado tiene que entrar en NUMERIC(14,2).

    Se llama SIEMPRE antes del commit: si no entra, no se escribe nada.
    """
    valor = _a_decimal(total)
    if valor > TOTAL_MAXIMO:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{que} de ${formatear(valor)} supera el máximo admitido de "
                f"${formatear(TOTAL_MAXIMO)}. Reducí la cantidad o dividí la compra."
            ),
        )
    return valor
