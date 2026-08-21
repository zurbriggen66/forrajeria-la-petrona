"""Cómo se cotiza un ítem de un producto: suelto (por kg) o en bolsa cerrada.

Vive acá y no dentro de ventas/ porque Ventas y Repartos tienen que cobrar
exactamente lo mismo por lo mismo — si la regla se duplica, tarde o temprano
un reparto sale a otro precio que el mostrador.
"""
from rest_framework.exceptions import ValidationError


def resolver_precio_item(producto, cantidad, es_bolsa):
    """Devuelve (precio_unitario, costo_unitario, kg_reales) para un ítem.

    `cantidad` se interpreta como cantidad de bolsas cuando `es_bolsa`, y como
    kg/unidades sueltas si no. `kg_reales` es lo que hay que descontar del
    stock (que siempre se guarda en kg para productos a granel).
    """
    if es_bolsa:
        if not (producto.venta_por_peso and producto.bolsa_kg and producto.precio_bolsa):
            raise ValidationError({
                "items": f'"{producto.nombre}" no tiene precio por bolsa configurado.'
            })
        return producto.precio_bolsa, producto.precio_costo * producto.bolsa_kg, cantidad * producto.bolsa_kg

    precio_unitario = (
        producto.precio_oferta
        if producto.oferta_activa and producto.precio_oferta
        else producto.precio_venta
    )
    return precio_unitario, producto.precio_costo, cantidad
