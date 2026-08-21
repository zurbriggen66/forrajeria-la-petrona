from rest_framework.pagination import PageNumberPagination


class PaginacionEstandar(PageNumberPagination):
    """Paginación que respeta `?page_size=`.

    Sin `page_size_query_param`, DRF ignora el parámetro y devuelve siempre
    PAGE_SIZE — el POS pedía 500 productos y recibía 50 en silencio, así que
    el catálogo quedaba cortado en el producto 50 (alfabético) y el resto era
    imposible de encontrar desde el buscador. El tope evita que un `page_size`
    enorme se traiga la tabla entera.
    """

    page_size_query_param = "page_size"
    max_page_size = 500
