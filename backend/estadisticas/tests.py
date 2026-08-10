"""
Panel de Estadísticas y Verdad del Negocio (Fase 4): los KPIs tienen que
cuadrar exactamente con las ventas registradas, y los filtros tienen que
filtrar de verdad.
"""
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from caja.models import CajaSesion
from core.models import Comercio, Perfil, UsuarioComercio
from finanzas.models import Gasto
from productos.models import Producto
from proveedores.models import Proveedor
from ventas.models import Venta, VentaItem

User = get_user_model()


class EstadisticasTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        self.caja_sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        self.proveedor = Proveedor.objects.create(comercio=self.comercio, nombre="Distribuidora Sur")
        self.gaseosa = Producto.objects.create(
            comercio=self.comercio, nombre="Gaseosa", categoria="Bebidas", proveedor=self.proveedor,
            precio_costo=Decimal("100"), precio_venta=Decimal("200"), stock=Decimal("100"),
        )
        self.queso = Producto.objects.create(
            comercio=self.comercio, nombre="Queso", categoria="Lácteos",
            precio_costo=Decimal("500"), precio_venta=Decimal("800"), stock=Decimal("100"),
        )

    def _vender(self, producto, cantidad="1"):
        response = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(producto.id), "cantidad": cantidad}],
        }, format="json")
        assert response.status_code == 201, response.data
        return Venta.objects.get(id=response.data["id"])

    def test_resumen_cuadra_con_las_ventas_registradas(self):
        self._vender(self.gaseosa, "2")   # 400
        self._vender(self.queso, "1")     # 800
        anulada = self._vender(self.gaseosa, "1")  # 200, se anula
        self.client.post(f"/api/ventas/{anulada.id}/anular/", {"motivo": "x"}, format="json")

        Gasto.objects.create(comercio=self.comercio, categoria="Insumos", monto=Decimal("150"), fecha=timezone.now().date())

        response = self.client.get("/api/estadisticas/resumen/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Decimal(response.data["ingresos"]), Decimal("1200.00"), "no debe contar la venta anulada")
        self.assertEqual(response.data["cantidad_ventas"], 2)
        self.assertEqual(Decimal(response.data["egresos"]), Decimal("150.00"))
        self.assertEqual(Decimal(response.data["balance"]), Decimal("1050.00"))
        self.assertEqual(Decimal(response.data["ticket_promedio"]), Decimal("600.00"))
        # margen: (400-200)+(800-500) = 500 sobre 1200 de ingresos = 41.67%
        self.assertAlmostEqual(response.data["margen_pct"], 500 / 1200 * 100, places=2)

    def test_resumen_filtra_por_categoria(self):
        self._vender(self.gaseosa, "1")
        self._vender(self.queso, "1")

        response = self.client.get("/api/estadisticas/resumen/?categoria=Bebidas")
        self.assertEqual(Decimal(response.data["ingresos"]), Decimal("200.00"))
        self.assertEqual(response.data["cantidad_ventas"], 1)

    def test_resumen_filtra_por_rango_de_fechas(self):
        venta_vieja = self._vender(self.gaseosa, "1")
        Venta.objects.filter(id=venta_vieja.id).update(created_at=timezone.now() - timedelta(days=10))
        self._vender(self.queso, "1")

        hoy = timezone.now().date().isoformat()
        response = self.client.get(f"/api/estadisticas/resumen/?fecha_desde={hoy}&fecha_hasta={hoy}")
        self.assertEqual(response.data["cantidad_ventas"], 1)
        self.assertEqual(Decimal(response.data["ingresos"]), Decimal("800.00"))

    def test_resumen_filtra_por_vendedor(self):
        otro_user = User.objects.create_user(username="otro", password="testpass123")
        UsuarioComercio.objects.create(user=otro_user, comercio=self.comercio, rol="Cajero")
        perfil_otro = Perfil.objects.filter(user=otro_user).first() or Perfil.objects.create(user=otro_user, comercio=self.comercio)

        self._vender(self.gaseosa, "1")  # vendedor = self.user
        self.client.force_authenticate(user=otro_user)
        self._vender(self.queso, "1")  # vendedor = otro_user
        self.client.force_authenticate(user=self.user)

        response = self.client.get(f"/api/estadisticas/resumen/?vendedor={perfil_otro.id}")
        self.assertEqual(response.data["cantidad_ventas"], 1)
        self.assertEqual(Decimal(response.data["ingresos"]), Decimal("800.00"))

    def test_rankings_top_productos_y_vendedores(self):
        self._vender(self.gaseosa, "5")  # 1000
        self._vender(self.queso, "1")    # 800

        response = self.client.get("/api/estadisticas/rankings/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["top_productos"][0]["nombre"], "Gaseosa")
        self.assertEqual(Decimal(response.data["top_productos"][0]["ingresos"]), Decimal("1000.00"))
        self.assertEqual(response.data["top_vendedores"][0]["cantidad_ventas"], 2)

    def test_rentabilidad_real_por_producto(self):
        self._vender(self.gaseosa, "2")  # ingresos 400, costo 200 -> 50%

        response = self.client.get("/api/estadisticas/rentabilidad/")
        fila = next(f for f in response.data if f["nombre"] == "Gaseosa")
        self.assertEqual(Decimal(fila["ingresos"]), Decimal("400.00"))
        self.assertEqual(Decimal(fila["costo"]), Decimal("200.00"))
        self.assertAlmostEqual(fila["margen_pct"], 50.0, places=2)

    def test_verdad_del_negocio_por_categoria_y_proveedor(self):
        self._vender(self.gaseosa, "1")  # Bebidas / Distribuidora Sur
        self._vender(self.queso, "1")    # Lácteos / sin proveedor

        response = self.client.get("/api/estadisticas/verdad-del-negocio/")
        self.assertEqual(response.status_code, 200, response.data)
        categorias = {f["categoria"] for f in response.data["por_categoria"]}
        self.assertEqual(categorias, {"Bebidas", "Lácteos"})
        proveedores = {f["nombre"] for f in response.data["por_proveedor"]}
        self.assertIn("Distribuidora Sur", proveedores)
        self.assertIn("Sin proveedor", proveedores)

    def test_verdad_del_negocio_comparativa_de_periodo(self):
        hoy = timezone.now().date()
        venta_actual = self._vender(self.gaseosa, "1")  # 200
        venta_anterior = self._vender(self.queso, "1")  # 800
        Venta.objects.filter(id=venta_anterior.id).update(created_at=timezone.now() - timedelta(days=4))

        response = self.client.get(
            f"/api/estadisticas/verdad-del-negocio/?fecha_desde={(hoy - timedelta(days=2)).isoformat()}&fecha_hasta={hoy.isoformat()}"
        )
        self.assertEqual(response.status_code, 200, response.data)
        comparativa = response.data["comparativa"]
        self.assertEqual(Decimal(comparativa["periodo_actual"]["ingresos"]), Decimal("200.00"))
        self.assertEqual(Decimal(comparativa["periodo_anterior"]["ingresos"]), Decimal("800.00"))
        self.assertAlmostEqual(comparativa["variacion_ingresos_pct"], (200 - 800) / 800 * 100, places=2)

    def test_aislamiento_multi_tenant(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        otro_producto = Producto.objects.create(
            comercio=otro_comercio, nombre="Ajeno", precio_costo=Decimal("10"),
            precio_venta=Decimal("20"), stock=Decimal("10"),
        )
        VentaItem.objects.create(
            venta=Venta.objects.create(comercio=otro_comercio, total=Decimal("20")),
            producto=otro_producto, cantidad=1, precio_unitario=Decimal("20"),
            costo_unitario=Decimal("10"), subtotal=Decimal("20"),
        )

        response = self.client.get("/api/estadisticas/resumen/")
        self.assertEqual(response.data["cantidad_ventas"], 0)
