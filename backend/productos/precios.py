"""Cómo se cotiza un ítem: suelto o en presentación cerrada.

"Suelto" es por unidad_medida (kg de balanceado, metros de soga, tornillos de a
uno) y la presentación cerrada es la bolsa/rollo/caja entera a su propio precio.

Vive acá y no dentro de ventas/ porque Ventas y Repartos tienen que cobrar
exactamente lo mismo por lo mismo — si la regla se duplica, tarde o temprano
un reparto sale a otro precio que el mostrador.
"""
from rest_framework.exceptions import ValidationError


def resolver_precio_item(producto, cantidad, es_bolsa):
    """Devuelve (precio_unitario, costo_unitario, kg_reales) para un ítem.

    `cantidad` se interpreta como cantidad de presentaciones cerradas cuando
    `es_bolsa`, y como unidades sueltas (kg, metros, tornillos) si no.
    `kg_reales` es lo que hay que descontar del stock, que siempre se guarda en
    unidad_medida.
    """
    if es_bolsa:
        if not (producto.venta_por_peso and producto.bolsa_kg and producto.precio_bolsa):
            raise ValidationError({
                "items": f'"{producto.nombre}" no tiene precio por presentación cerrada configurado.'
            })
        return producto.precio_bolsa, producto.precio_costo * producto.bolsa_kg, cantidad * producto.bolsa_kg

    precio_unitario = (
        producto.precio_oferta
        if producto.oferta_activa and producto.precio_oferta
        else producto.precio_venta
    )
    return precio_unitario, producto.precio_costo, cantidad
