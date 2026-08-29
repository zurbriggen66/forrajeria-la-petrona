"""Catálogo de módulos que el Dueño puede habilitar o deshabilitar por empleado.

`clave` es la ruta del frontend (router/navigation.ts), así que la misma lista
sirve para filtrar el menú y para cortar las requests en el servidor: no hay dos
listas que se puedan desincronizar.

`prefijos` son las rutas de la API que pertenecen SÓLO a ese módulo. Varios
módulos comparten endpoints con el POS —vender necesita leer productos, clientes
y cuentas de pago—, así que esos endpoints no se listan en ningún lado: apagar
"Productos" saca la pantalla de productos del menú, pero el buscador del POS
sigue funcionando. Lo que se corta en el servidor es lo exclusivo del módulo,
que es justo lo sensible (contabilidad, estadísticas, compras, la verdad del
negocio).
"""

# Inicio y Config no entran: sin Inicio el empleado entra a una pantalla vacía,
# y en Config lo único que ve un empleado es su propia cuenta y contraseña.
MODULOS = [
    {"clave": "/pos", "label": "Venta (POS)", "prefijos": []},
    {"clave": "/ventas", "label": "Historial de ventas", "prefijos": []},
    {"clave": "/presupuestos", "label": "Presupuestos", "prefijos": ["/api/presupuestos/"]},
    {"clave": "/repartos", "label": "Repartos", "prefijos": ["/api/repartos/"]},
    {"clave": "/clientes", "label": "Clientes", "prefijos": ["/api/crm/"]},
    {"clave": "/productos", "label": "Productos", "prefijos": [
        "/api/combos/", "/api/listas-precios/", "/api/ajustes-precios/",
        "/api/categorias-productos/", "/api/subcategorias-productos/",
        "/api/productos-universal/",
    ]},
    {"clave": "/stock", "label": "Stock", "prefijos": [
        "/api/inventario/depositos/", "/api/inventario/stock-deposito/",
        "/api/inventario/resumen/",
    ]},
    {"clave": "/inventario/ranking", "label": "Ranking de rentabilidad",
     "prefijos": ["/api/inventario/ranking-rentabilidad/"]},
    {"clave": "/etiquetas", "label": "Etiquetas", "prefijos": []},
    {"clave": "/proveedores", "label": "Proveedores", "prefijos": ["/api/proveedores/"]},
    {"clave": "/compras", "label": "Compras y gastos", "prefijos": [
        "/api/compras/", "/api/gastos/", "/api/pedidos/",
    ]},
    {"clave": "/caja", "label": "Caja", "prefijos": ["/api/caja/movimientos/"]},
    {"clave": "/estadisticas", "label": "Estadísticas", "prefijos": [
        "/api/estadisticas/panel/", "/api/estadisticas/rankings/",
        "/api/estadisticas/rentabilidad/",
    ]},
    {"clave": "/contabilidad", "label": "Contabilidad", "prefijos": ["/api/estadisticas/contabilidad/"]},
    {"clave": "/verdad-del-negocio", "label": "Verdad del Negocio",
     "prefijos": ["/api/estadisticas/verdad-del-negocio/"]},
    {"clave": "/empleados", "label": "Empleados y turnos", "prefijos": ["/api/empleados-turnos/"]},
    # Sin prefijos propios: la API de sucursales ya es sólo para el Dueño
    # (IsDueño), acá sólo se saca del menú.
    {"clave": "/sucursales", "label": "Sucursales", "prefijos": []},
    {"clave": "/asistente", "label": "Asistente", "prefijos": ["/api/asistente/"]},
]

CLAVES = {m["clave"] for m in MODULOS}


def modulo_de_ruta(path):
    """Clave del módulo dueño de esta ruta de API, o None si no es exclusiva
    de ninguno (endpoints compartidos con el POS, /auth/, /admin/)."""
    for modulo in MODULOS:
        for prefijo in modulo["prefijos"]:
            if path.startswith(prefijo):
                return modulo["clave"]
    return None
