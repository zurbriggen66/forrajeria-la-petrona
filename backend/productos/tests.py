"""
Prueba de aislamiento multi-tenant: un usuario del comercio A no debe poder
leer ni escribir datos del comercio B a través de la API, aunque conozca el id.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import Comercio, Perfil, UsuarioComercio
from ventas.models import Venta, VentaItem
from .models import AjustePrecio, Combo, ComboItem, Producto, ProductoUniversal

User = get_user_model()


class AislamientoMultiTenantTests(APITestCase):
    def setUp(self):
        self.comercio_a = Comercio.objects.create(nombre="Comercio A (test)")
        self.comercio_b = Comercio.objects.create(nombre="Comercio B (test)")

        self.user_a = User.objects.create_user(username="user_a", password="testpass123")
        UsuarioComercio.objects.create(user=self.user_a, comercio=self.comercio_a, rol="Dueño")

        self.user_b = User.objects.create_user(username="user_b", password="testpass123")
        UsuarioComercio.objects.create(user=self.user_b, comercio=self.comercio_b, rol="Dueño")

        self.producto_a = Producto.objects.create(
            comercio=self.comercio_a, nombre="Producto de A", precio_venta=100
        )
        self.producto_b = Producto.objects.create(
            comercio=self.comercio_b, nombre="Producto de B", precio_venta=200
        )

    def _login(self, username):
        self.client.force_authenticate(user=User.objects.get(username=username))

    def test_listado_solo_muestra_productos_del_propio_comercio(self):
        self._login("user_a")
        response = self.client.get("/api/productos/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [p["id"] for p in response.data["results"]]
        self.assertIn(str(self.producto_a.id), ids)
        self.assertNotIn(str(self.producto_b.id), ids)

    def test_no_puede_leer_detalle_de_otro_comercio(self):
        self._login("user_a")
        response = self.client.get(f"/api/productos/{self.producto_b.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_no_puede_escribir_en_producto_de_otro_comercio(self):
        self._login("user_a")
        response = self.client.patch(
            f"/api/productos/{self.producto_b.id}/", {"nombre": "hackeado"}
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.producto_b.refresh_from_db()
        self.assertEqual(self.producto_b.nombre, "Producto de B")

    def test_comercio_se_asigna_en_servidor_no_por_el_cliente(self):
        """Aunque el body intente mandar un comercio distinto, se ignora: el
        servidor siempre usa el comercio resuelto de UsuarioComercio."""
        self._login("user_a")
        response = self.client.post(
            "/api/productos/",
            {"nombre": "Nuevo", "precio_venta": "50", "comercio": str(self.comercio_b.id)},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        creado = Producto.objects.get(id=response.data["id"])
        self.assertEqual(creado.comercio_id, self.comercio_a.id)

    def test_usuario_sin_comercio_no_puede_operar(self):
        User.objects.create_user(username="user_c", password="testpass123")
        self._login("user_c")
        response = self.client.get("/api/productos/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AltaProductoAutocompletadoTests(APITestCase):
    """Alta de producto con autocompletado por código de barras (Fase 1)."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        ProductoUniversal.objects.create(
            codigo_barras="7791234000012", nombre="Coca-Cola 1.5L", categoria="Bebidas", marca="Coca-Cola",
        )

    def test_busca_por_codigo_de_barras_exacto(self):
        response = self.client.get("/api/productos-universal/?codigo_barras=7791234000012")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["nombre"], "Coca-Cola 1.5L")

    def test_codigo_inexistente_no_rompe_devuelve_vacio(self):
        response = self.client.get("/api/productos-universal/?codigo_barras=0000000000000")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 0)

    def test_alta_de_producto_real(self):
        response = self.client.post("/api/productos/", {
            "codigo_barras": "7791234000012",
            "nombre": "Coca-Cola 1.5L",
            "categoria": "Bebidas",
            "precio_costo": "800",
            "precio_venta": "1200",
            "stock": "50",
            "stock_minimo": "5",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        producto = Producto.objects.get(id=response.data["id"])
        self.assertEqual(producto.comercio_id, self.comercio.id)
        self.assertEqual(response.data["margen_pct"], round((1200 - 800) / 1200 * 100, 2))


class AjustePrecioMasivoTests(APITestCase):
    """Aumento masivo de precios + historial (Fase 1, criterio de aceptación)."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.otro_comercio = Comercio.objects.create(nombre="Otro comercio (test)")

        self.user = User.objects.create_user(username="dueno", password="testpass123")
        Perfil.objects.create(user=self.user, comercio=self.comercio, nombre_completo="Dueño Test", rol="Dueño")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        self.bebida = Producto.objects.create(
            comercio=self.comercio, nombre="Gaseosa", categoria="Bebidas", precio_venta=Decimal("100.00"),
        )
        self.almacen = Producto.objects.create(
            comercio=self.comercio, nombre="Fideos", categoria="Almacén", precio_venta=Decimal("200.00"),
        )
        self.producto_otro_comercio = Producto.objects.create(
            comercio=self.otro_comercio, nombre="Ajeno", categoria="Bebidas", precio_venta=Decimal("100.00"),
        )

    def test_aplica_porcentaje_solo_a_la_categoria_filtrada(self):
        response = self.client.post("/api/ajustes-precios/", {
            "descripcion": "Aumento bebidas",
            "tipo": "porcentaje",
            "valor": "10",
            "categoria": "Bebidas",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["cant_productos"], 1)

        self.bebida.refresh_from_db()
        self.almacen.refresh_from_db()
        self.assertEqual(self.bebida.precio_venta, Decimal("110.00"))
        self.assertEqual(self.almacen.precio_venta, Decimal("200.00"), "no debía tocar otra categoría")

    def test_no_afecta_productos_de_otro_comercio(self):
        self.client.post("/api/ajustes-precios/", {
            "tipo": "porcentaje", "valor": "50", "categoria": "Bebidas",
        })
        self.producto_otro_comercio.refresh_from_db()
        self.assertEqual(self.producto_otro_comercio.precio_venta, Decimal("100.00"))

    def test_queda_registrado_en_el_historial(self):
        self.client.post("/api/ajustes-precios/", {
            "descripcion": "Aumento general", "tipo": "monto", "valor": "15",
        })
        self.assertEqual(AjustePrecio.objects.filter(comercio=self.comercio).count(), 1)
        response = self.client.get("/api/ajustes-precios/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["descripcion"], "Aumento general")
        self.assertEqual(response.data["results"][0]["cant_productos"], 2)


class ComboTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        self.p1 = Producto.objects.create(comercio=self.comercio, nombre="Pan", precio_venta=500)
        self.p2 = Producto.objects.create(comercio=self.comercio, nombre="Jamón", precio_venta=1500)

    def test_crea_combo_con_items_anidados(self):
        response = self.client.post("/api/combos/", {
            "nombre": "Combo sandwich",
            "precio": "1800",
            "items": [
                {"producto": str(self.p1.id), "cantidad": "2"},
                {"producto": str(self.p2.id), "cantidad": "1"},
            ],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        combo = Combo.objects.get(id=response.data["id"])
        self.assertEqual(combo.items.count(), 2)
        self.assertEqual(combo.comercio_id, self.comercio.id)


class EliminarProductoTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

    def test_borra_de_verdad_un_producto_sin_historial(self):
        producto = Producto.objects.create(comercio=self.comercio, nombre="Sin ventas", precio_venta=100)
        response = self.client.delete(f"/api/productos/{producto.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Producto.objects.filter(id=producto.id).exists())

    def test_desactiva_en_vez_de_borrar_un_producto_con_ventas(self):
        producto = Producto.objects.create(comercio=self.comercio, nombre="Con ventas", precio_venta=100)
        venta = Venta.objects.create(comercio=self.comercio, total=100)
        VentaItem.objects.create(venta=venta, producto=producto, cantidad=1, precio_unitario=100, subtotal=100)

        response = self.client.delete(f"/api/productos/{producto.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        producto.refresh_from_db()
        self.assertFalse(producto.activo)
        # El ticket viejo sigue apuntando al producto (no se pierde el nombre).
        venta_item = VentaItem.objects.get(venta=venta)
        self.assertEqual(venta_item.producto_id, producto.id)

    def test_desactiva_en_vez_de_borrar_un_producto_en_un_combo(self):
        producto = Producto.objects.create(comercio=self.comercio, nombre="En combo", precio_venta=100)
        combo = Combo.objects.create(comercio=self.comercio, nombre="Combo", precio=100)
        ComboItem.objects.create(combo=combo, producto=producto, cantidad=1)

        response = self.client.delete(f"/api/productos/{producto.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        producto.refresh_from_db()
        self.assertFalse(producto.activo)
        self.assertEqual(combo.items.count(), 1)


class CostoPorEnvaseCerradoTests(APITestCase):
    """Cargar el costo de la bolsa entera no puede romper el guardado.

    El costo se guarda por unidad suelta, así que cargarlo por envase divide:
    una bolsa de 15 kg a $36.874 son $2.458,2667/kg. Esa división da periódico
    y el formulario mandaba el float crudo (2458.266666666667, 16 dígitos), que
    el serializer rechazaba entero por max_digits=14 — el dueño no podía
    guardar el producto y el error no decía qué campo era.
    """

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

    def _crear(self, precio_costo):
        return self.client.post("/api/productos/", {
            "nombre": "Bolsa Estampa Razas Chicas X15kg",
            "codigo_barras": "0369",
            "precio_costo": precio_costo,
            "precio_venta": "3700",
            "stock": "135",
            "venta_por_peso": True,
            "unidad_medida": "kg",
            "bolsa_kg": "15",
            "precio_bolsa": "49100",
            "stock_en_bolsas": True,
        }, format="json")

    def test_acepta_el_costo_por_kg_de_una_bolsa_que_no_divide_exacto(self):
        # 36874 / 15, ya redondeado por el formulario a los decimales del campo.
        response = self._crear("2458.2667")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        producto = Producto.objects.get(id=response.data["id"])
        self.assertEqual(producto.precio_costo, Decimal("2458.2667"))

        # Y al reabrir la ficha el costo de la bolsa tiene que volver a leerse
        # como los $36.874 que el dueño tipeó, no $36.874,05.
        costo_bolsa = producto.precio_costo * producto.bolsa_kg
        self.assertEqual(round(costo_bolsa, 2), Decimal("36874.00"))

    def test_rechaza_el_float_crudo_sin_redondear(self):
        """Fija el síntoma original: si el formulario vuelve a mandar el
        periódico entero, esto se pone en rojo."""
        response = self._crear("2458.266666666667")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("precio_costo", response.data)


class AjustePrecioSeleccionadoTests(APITestCase):
    """Aumentos eligiendo producto por producto en la galería, con un valor
    general y overrides individuales."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.otro = Comercio.objects.create(nombre="Otro comercio (test)")
        self.user = User.objects.create_user(username="dueno-sel", password="testpass123")
        Perfil.objects.create(user=self.user, comercio=self.comercio, nombre_completo="Dueño", rol="Dueño")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        def producto(nombre, precio, **extra):
            return Producto.objects.create(
                comercio=self.comercio, nombre=nombre, categoria="Alimento",
                precio_venta=Decimal(precio), **extra,
            )

        self.a = producto("Balanceado A", "1000.00")
        self.b = producto("Balanceado B", "2000.00")
        self.c = producto("Balanceado C", "3000.00")
        self.ajeno = Producto.objects.create(
            comercio=self.otro, nombre="Ajeno", categoria="Alimento", precio_venta=Decimal("1000.00"),
        )

    def _aplicar(self, payload):
        return self.client.post("/api/ajustes-precios/", payload, format="json")

    def _precio(self, producto):
        producto.refresh_from_db()
        return producto.precio_venta

    def test_solo_toca_los_elegidos_aunque_compartan_categoria(self):
        response = self._aplicar({
            "tipo": "porcentaje", "valor": "10", "categoria": "Alimento",
            "productos": [{"producto": str(self.a.id)}, {"producto": str(self.c.id)}],
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["cant_productos"], 2)
        self.assertEqual(self._precio(self.a), Decimal("1100.00"))
        self.assertEqual(self._precio(self.c), Decimal("3300.00"))
        # B está en la misma categoría pero no se eligió: no se toca.
        self.assertEqual(self._precio(self.b), Decimal("2000.00"))

    def test_valor_individual_le_gana_al_general(self):
        response = self._aplicar({
            "tipo": "porcentaje", "valor": "10",
            "productos": [
                {"producto": str(self.a.id)},                    # va con el 10%
                {"producto": str(self.b.id), "valor": "25"},     # el suyo
                {"producto": str(self.c.id), "valor": "0"},      # 0 = no lo toques
            ],
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(self._precio(self.a), Decimal("1100.00"))
        self.assertEqual(self._precio(self.b), Decimal("2500.00"))
        # Un 0 individual es un valor válido, no un "vacío" que caiga al general.
        self.assertEqual(self._precio(self.c), Decimal("3000.00"))

    def test_descuento_es_un_valor_negativo(self):
        self._aplicar({"tipo": "porcentaje", "valor": "-20", "productos": [{"producto": str(self.a.id)}]})
        self.assertEqual(self._precio(self.a), Decimal("800.00"))

    def test_un_descuento_grande_no_deja_el_precio_en_negativo(self):
        self._aplicar({"tipo": "monto", "valor": "-5000", "productos": [{"producto": str(self.a.id)}]})
        self.assertEqual(self._precio(self.a), Decimal("0.00"))

    def test_rechaza_un_producto_de_otro_comercio(self):
        """Sin esto el aumento se aplicaba a menos productos de los elegidos y
        el dueño creía que había salido completo."""
        response = self._aplicar({
            "tipo": "porcentaje", "valor": "10",
            "productos": [{"producto": str(self.a.id)}, {"producto": str(self.ajeno.id)}],
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self._precio(self.a), Decimal("1000.00"))
        self.assertEqual(self._precio(self.ajeno), Decimal("1000.00"))

    def test_rechaza_productos_repetidos(self):
        response = self._aplicar({
            "tipo": "porcentaje", "valor": "10",
            "productos": [{"producto": str(self.a.id)}, {"producto": str(self.a.id)}],
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_el_historial_guarda_que_fue_una_seleccion_manual(self):
        self._aplicar({
            "tipo": "porcentaje", "valor": "10", "categoria": "Alimento",
            "productos": [{"producto": str(self.a.id)}, {"producto": str(self.b.id), "valor": "25"}],
        })
        ajuste = AjustePrecio.objects.latest("created_at")
        self.assertEqual(len(ajuste.filtro["productos"]), 2)
        self.assertEqual(ajuste.filtro["valores_individuales"], {str(self.b.id): "25.00"})

    def test_sin_seleccion_sigue_andando_el_filtro_de_siempre(self):
        response = self._aplicar({"tipo": "porcentaje", "valor": "10", "categoria": "Alimento"})
        self.assertEqual(response.data["cant_productos"], 3)
        self.assertEqual(self._precio(self.b), Decimal("2200.00"))

    def test_la_galeria_recibe_la_foto_del_producto(self):
        self.a.imagen_url = "https://ejemplo.test/balanceado.jpg"
        self.a.save(update_fields=["imagen_url"])
        response = self.client.get(f"/api/productos/{self.a.id}/")
        self.assertEqual(response.data["imagen_url"], "https://ejemplo.test/balanceado.jpg")


class ComboArmadoTests(APITestCase):
    """Los números que el armador de packs necesita: cuánto costaría suelto,
    cuánto se le regala al cliente, el margen y cuántos packs entran en el
    stock de hoy."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno-packs", password="testpass123")
        Perfil.objects.create(user=self.user, comercio=self.comercio, nombre_completo="Dueño", rol="Dueño")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        # "10 balanceados por 100.000": suelto son $115.000 (10 × 11.500).
        self.balanceado = Producto.objects.create(
            comercio=self.comercio, nombre="Balanceado", precio_venta=Decimal("11500.00"),
            precio_costo=Decimal("8000.0000"), stock=Decimal("25"),
        )
        # "100 huevos por 20.000": suelto son $25.000 (100 × 250).
        self.huevo = Producto.objects.create(
            comercio=self.comercio, nombre="Huevo", precio_venta=Decimal("250.00"),
            precio_costo=Decimal("150.0000"), stock=Decimal("450"),
        )

    def _crear(self, nombre, precio, items):
        return self.client.post("/api/combos/", {
            "nombre": nombre, "descripcion": "", "precio": precio, "items": items,
        }, format="json")

    def test_diez_balanceados_por_cien_mil(self):
        response = self._crear("10 balanceados", "100000.00", [
            {"producto": str(self.balanceado.id), "cantidad": "10"},
        ])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        d = response.data
        self.assertEqual(Decimal(d["precio_suelto"]), Decimal("115000.00"))
        self.assertEqual(Decimal(d["costo"]), Decimal("80000.00"))
        # Le regala 15.000 sobre 115.000 = 13.04%
        self.assertEqual(d["descuento_pct"], 13.04)
        # Margen sobre el precio del pack: (100.000 - 80.000) / 100.000
        self.assertEqual(d["margen_pct"], 20.0)
        # 25 de stock / 10 por pack = 2 packs enteros.
        self.assertEqual(d["armables"], 2)

    def test_cien_huevos_por_veinte_mil(self):
        d = self._crear("100 huevos", "20000.00", [
            {"producto": str(self.huevo.id), "cantidad": "100"},
        ]).data
        self.assertEqual(Decimal(d["precio_suelto"]), Decimal("25000.00"))
        self.assertEqual(d["descuento_pct"], 20.0)
        self.assertEqual(d["armables"], 4)

    def test_armables_lo_decide_el_componente_mas_escaso(self):
        """Con 25 balanceados y 450 huevos, un pack de 10 balanceados + 12
        huevos sale 2 veces: sobran huevos pero no balanceado."""
        d = self._crear("Combo granja", "120000.00", [
            {"producto": str(self.balanceado.id), "cantidad": "10"},
            {"producto": str(self.huevo.id), "cantidad": "12"},
        ]).data
        self.assertEqual(d["armables"], 2)

    def test_sin_stock_de_un_componente_no_se_arma_ninguno(self):
        self.balanceado.stock = Decimal("3")
        self.balanceado.save(update_fields=["stock"])
        d = self._crear("10 balanceados", "100000.00", [
            {"producto": str(self.balanceado.id), "cantidad": "10"},
        ]).data
        self.assertEqual(d["armables"], 0)

    def test_un_pack_mas_caro_que_suelto_da_descuento_negativo(self):
        """No se bloquea —el dueño manda— pero tiene que poder verlo: es casi
        siempre un error de carga."""
        d = self._crear("Mal cargado", "130000.00", [
            {"producto": str(self.balanceado.id), "cantidad": "10"},
        ]).data
        self.assertLess(d["descuento_pct"], 0)

    def test_editar_un_pack_reemplaza_sus_productos(self):
        combo_id = self._crear("Pack", "50000.00", [
            {"producto": str(self.balanceado.id), "cantidad": "5"},
        ]).data["id"]
        response = self.client.put(f"/api/combos/{combo_id}/", {
            "nombre": "Pack corregido", "descripcion": "", "precio": "20000.00",
            "items": [{"producto": str(self.huevo.id), "cantidad": "100"}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["nombre"], "Pack corregido")
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["producto_nombre"], "Huevo")
        self.assertEqual(response.data["armables"], 4)

    def test_el_item_trae_precio_costo_y_stock_del_componente(self):
        """El formulario de edición no tiene los Producto completos: los saca
        de acá."""
        item = self._crear("Pack", "50000.00", [
            {"producto": str(self.balanceado.id), "cantidad": "5"},
        ]).data["items"][0]
        self.assertEqual(Decimal(item["producto_precio_venta"]), Decimal("11500.00"))
        self.assertEqual(Decimal(item["producto_precio_costo"]), Decimal("8000.0000"))
        self.assertEqual(Decimal(item["producto_stock"]), Decimal("25.000"))
