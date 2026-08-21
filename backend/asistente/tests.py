"""Tests del asistente.

No llaman a la API de Claude: lo que importa acá es que las herramientas sólo
vean la sucursal activa y que una acción propuesta no toque la base hasta que
una persona la confirme. Esa parte es todo código nuestro.
"""
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from caja.models import CajaSesion, CuentaPago
from clientes.models import Cliente
from core.models import Comercio, UsuarioComercio
from productos.models import Producto
from ventas.models import Venta

from . import herramientas
from .models import AccionPendiente, UsoAsistente

User = get_user_model()


class HerramientasTests(APITestCase):
    """Las consultas nunca pueden cruzar de sucursal."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Forrajería A")
        self.otro = Comercio.objects.create(nombre="Forrajería B")

        self.balanceado = Producto.objects.create(
            comercio=self.comercio, nombre="Balanceado perro", precio_venta=Decimal("2000"),
            precio_costo=Decimal("1000"), stock=Decimal("100"), stock_minimo=Decimal("10"),
            venta_por_peso=True, unidad_medida="kg", bolsa_kg=20, precio_bolsa=Decimal("30000"),
        )
        Producto.objects.create(
            comercio=self.otro, nombre="Balanceado gato", precio_venta=Decimal("999"), stock=5,
        )

    def test_buscar_producto_no_ve_los_de_otra_sucursal(self):
        resultado = herramientas.buscar_producto(self.comercio, "Balanceado")
        nombres = [p["nombre"] for p in resultado["productos"]]
        self.assertIn("Balanceado perro", nombres)
        self.assertNotIn("Balanceado gato", nombres)

    def test_saldo_de_cliente_no_ve_los_de_otra_sucursal(self):
        Cliente.objects.create(comercio=self.otro, nombre="Juan Ajeno", saldo_actual=Decimal("5000"))
        self.assertEqual(herramientas.saldo_de_cliente(self.comercio, "Juan")["encontrados"], 0)

    def test_resumen_de_ventas_solo_cuenta_la_sucursal_activa(self):
        Venta.objects.create(comercio=self.comercio, total=Decimal("1000"))
        Venta.objects.create(comercio=self.otro, total=Decimal("99999"))
        resumen = herramientas.resumen_ventas(self.comercio)
        self.assertEqual(Decimal(resumen["ingresos_totales"]), Decimal("1000"))
        self.assertEqual(resumen["cantidad_de_ventas"], 1)

    def test_resumen_ignora_las_ventas_anuladas(self):
        Venta.objects.create(comercio=self.comercio, total=Decimal("1000"))
        Venta.objects.create(comercio=self.comercio, total=Decimal("500"), anulada=True)
        self.assertEqual(
            Decimal(herramientas.resumen_ventas(self.comercio)["ingresos_totales"]), Decimal("1000")
        )

    def test_productos_bajos_detecta_el_que_esta_bajo_el_minimo(self):
        Producto.objects.create(
            comercio=self.comercio, nombre="Alpiste", precio_venta=800,
            stock=Decimal("2"), stock_minimo=Decimal("10"),
        )
        nombres = [p["nombre"] for p in herramientas.productos_sin_stock_o_bajos(self.comercio)["productos"]]
        self.assertIn("Alpiste", nombres)
        self.assertNotIn("Balanceado perro", nombres)


class AccionesPendientesTests(APITestCase):
    """El asistente propone; ejecuta una persona."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Forrajería (test)", asistente_consultas_diarias=10)
        self.user = User.objects.create_user(username="dueno_ia", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        self.caja = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")
        CuentaPago.objects.create(comercio=self.comercio, nombre="Efectivo", tipo="efectivo")
        self.producto = Producto.objects.create(
            comercio=self.comercio, nombre="Balanceado perro", precio_venta=Decimal("2000"),
            precio_costo=Decimal("1000"), stock=Decimal("100"), venta_por_peso=True,
            unidad_medida="kg", bolsa_kg=20, precio_bolsa=Decimal("30000"),
        )

    def _consultar(self, respuesta_falsa):
        """Corre /consultar/ con el bucle de Claude mockeado."""
        with patch("asistente.views.conversar", side_effect=respuesta_falsa):
            return self.client.post("/api/asistente/consultar/", {"mensaje": "hola"}, format="json")

    def test_proponer_una_venta_no_crea_la_venta_ni_toca_el_stock(self):
        def falso(comercio, historial, on_proponer):
            texto = on_proponer("venta", {
                "items": [{"producto_id": str(self.producto.id), "cantidad": "2", "es_bolsa": True}]
            })
            return ("Preparé la venta, confirmala.", historial, {})

        response = self._consultar(falso)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIsNotNone(response.data["accion_pendiente"])

        # Nada se escribió todavía.
        self.assertEqual(Venta.objects.count(), 0)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, Decimal("100.000"))
        self.assertEqual(AccionPendiente.objects.get().estado, "pendiente")

    def test_confirmar_la_venta_la_registra_por_el_camino_del_pos(self):
        def falso(comercio, historial, on_proponer):
            on_proponer("venta", {
                "items": [{"producto_id": str(self.producto.id), "cantidad": "2", "es_bolsa": True}]
            })
            return ("listo", historial, {})

        accion_id = self._consultar(falso).data["accion_pendiente"]["id"]
        response = self.client.post(
            "/api/asistente/confirmar/", {"accion": accion_id, "confirmar": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        venta = Venta.objects.get()
        # 2 bolsas x $30.000, precio del catálogo (no uno inventado por el modelo).
        self.assertEqual(venta.total, Decimal("60000.00"))
        self.assertEqual(venta.origen, "asistente")
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, Decimal("60.000"), "descuenta 2 bolsas de 20kg")

    def test_cancelar_no_ejecuta_nada(self):
        def falso(comercio, historial, on_proponer):
            on_proponer("venta", {"items": [{"producto_id": str(self.producto.id), "cantidad": "1"}]})
            return ("listo", historial, {})

        accion_id = self._consultar(falso).data["accion_pendiente"]["id"]
        response = self.client.post(
            "/api/asistente/confirmar/", {"accion": accion_id, "confirmar": False}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Venta.objects.count(), 0)
        self.assertEqual(AccionPendiente.objects.get().estado, "cancelada")

    def test_no_se_puede_confirmar_dos_veces(self):
        def falso(comercio, historial, on_proponer):
            on_proponer("venta", {"items": [{"producto_id": str(self.producto.id), "cantidad": "1"}]})
            return ("listo", historial, {})

        accion_id = self._consultar(falso).data["accion_pendiente"]["id"]
        self.client.post("/api/asistente/confirmar/", {"accion": accion_id}, format="json")
        segunda = self.client.post("/api/asistente/confirmar/", {"accion": accion_id}, format="json")
        self.assertEqual(segunda.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Venta.objects.count(), 1, "no se duplica la venta")

    def test_una_propuesta_sin_stock_se_rechaza_al_proponer(self):
        """Mejor avisar antes de que la persona confirme algo que va a fallar."""
        capturado = {}

        def falso(comercio, historial, on_proponer):
            capturado["resultado"] = on_proponer("venta", {
                "items": [{"producto_id": str(self.producto.id), "cantidad": "999"}]
            })
            return ("no hay stock", historial, {})

        self._consultar(falso)
        self.assertIn("stock", capturado["resultado"].lower())
        self.assertEqual(AccionPendiente.objects.count(), 0)

    def test_no_se_puede_confirmar_una_accion_de_otra_sucursal(self):
        otro = Comercio.objects.create(nombre="Otra sucursal")
        ajena = AccionPendiente.objects.create(
            comercio=otro, usuario=self.user, tipo="venta", resumen="x", datos={"items": []},
        )
        response = self.client.post("/api/asistente/confirmar/", {"accion": str(ajena.id)}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_alta_de_producto_confirmada_lo_crea(self):
        def falso(comercio, historial, on_proponer):
            on_proponer("alta_producto", {
                "nombre": "Maíz partido", "precio_venta": "1500", "stock": "50",
                "venta_por_peso": True,
            })
            return ("listo", historial, {})

        accion_id = self._consultar(falso).data["accion_pendiente"]["id"]
        response = self.client.post("/api/asistente/confirmar/", {"accion": accion_id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        producto = Producto.objects.get(nombre="Maíz partido")
        self.assertEqual(producto.comercio_id, self.comercio.id)
        self.assertEqual(producto.precio_venta, Decimal("1500.00"))
        self.assertEqual(producto.unidad_medida, "kg")

    def test_sin_api_key_el_asistente_avisa_y_no_rompe(self):
        from .claude import AsistenteNoConfigurado

        with patch("asistente.views.conversar", side_effect=AsistenteNoConfigurado("falta la key")):
            response = self.client.post("/api/asistente/consultar/", {"mensaje": "hola"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("falta la key", response.data["detail"])

    def test_requiere_estar_autenticado(self):
        self.client.force_authenticate(user=None)
        response = self.client.post("/api/asistente/consultar/", {"mensaje": "hola"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class _Bloque:
    """Imita un content block de la respuesta de la API."""

    def __init__(self, type, text=None, name=None, input=None, id=None):
        self.type = type
        self.text = text
        self.name = name
        self.input = input or {}
        self.id = id


class _Respuesta:
    def __init__(self, content, stop_reason="end_turn"):
        self.content = content
        self.stop_reason = stop_reason


class _ClienteFalso:
    """Devuelve respuestas preparadas de a una, guardando lo que se le mandó."""

    def __init__(self, respuestas):
        self._respuestas = list(respuestas)
        self.llamadas = []
        self.messages = self

    def create(self, **kwargs):
        self.llamadas.append(kwargs)
        return self._respuestas.pop(0)


class BucleDeConversacionTests(APITestCase):
    """Prueba el bucle de herramientas sin llamar a la API de Claude."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Forrajería (test)")
        Producto.objects.create(
            comercio=self.comercio, nombre="Balanceado perro", precio_venta=Decimal("2000"), stock=50,
        )

    def _conversar(self, respuestas, on_proponer=None):
        from .claude import conversar

        cliente = _ClienteFalso(respuestas)
        # _cliente ahora devuelve (cliente, modelo): el modelo puede ser el
        # del comercio o el del servidor.
        with patch("asistente.claude._cliente", return_value=(cliente, "claude-opus-5")):
            texto, historial, uso = conversar(
                self.comercio,
                [{"role": "user", "content": "hola"}],
                on_proponer or (lambda tipo, datos: "{}"),
            )
        return texto, historial, cliente

    def test_responde_directo_cuando_no_usa_herramientas(self):
        texto, _, cliente = self._conversar([_Respuesta([_Bloque("text", text="Hola, ¿en qué te ayudo?")])])
        self.assertEqual(texto, "Hola, ¿en qué te ayudo?")
        self.assertEqual(len(cliente.llamadas), 1)

    def test_ejecuta_la_herramienta_y_vuelve_con_el_resultado(self):
        respuestas = [
            _Respuesta([_Bloque("tool_use", name="buscar_producto", input={"texto": "Balanceado"}, id="t1")],
                       stop_reason="tool_use"),
            _Respuesta([_Bloque("text", text="Tenés Balanceado perro a $2.000 el kilo.")]),
        ]
        texto, historial, cliente = self._conversar(respuestas)
        self.assertIn("Balanceado perro", texto)
        self.assertEqual(len(cliente.llamadas), 2)

        # El resultado de la herramienta viajó de vuelta con datos reales.
        resultado = historial[-2]["content"][0]
        self.assertEqual(resultado["type"], "tool_result")
        self.assertIn("Balanceado perro", resultado["content"])

    def test_una_herramienta_que_falla_no_corta_la_conversacion(self):
        respuestas = [
            _Respuesta([_Bloque("tool_use", name="no_existe_esta", input={}, id="t1")], stop_reason="tool_use"),
            _Respuesta([_Bloque("text", text="No pude consultar eso.")]),
        ]
        texto, historial, _ = self._conversar(respuestas)
        self.assertEqual(texto, "No pude consultar eso.")
        self.assertIn("error", historial[-2]["content"][0]["content"])

    def test_argumentos_invalidos_se_devuelven_como_error_no_como_excepcion(self):
        respuestas = [
            # buscar_producto necesita `texto`; el modelo manda otra cosa.
            _Respuesta([_Bloque("tool_use", name="buscar_producto", input={"query": "x"}, id="t1")],
                       stop_reason="tool_use"),
            _Respuesta([_Bloque("text", text="Me faltó un dato.")]),
        ]
        texto, historial, _ = self._conversar(respuestas)
        self.assertEqual(texto, "Me faltó un dato.")
        self.assertIn("inválidos", historial[-2]["content"][0]["content"])

    def test_las_acciones_de_escritura_pasan_por_on_proponer(self):
        llamadas = []

        def on_proponer(tipo, datos):
            llamadas.append((tipo, datos))
            return '{"estado": "pendiente"}'

        respuestas = [
            _Respuesta([_Bloque("tool_use", name="proponer_venta",
                                input={"items": [{"producto_id": "x", "cantidad": "1"}]}, id="t1")],
                       stop_reason="tool_use"),
            _Respuesta([_Bloque("text", text="Preparé la venta.")]),
        ]
        self._conversar(respuestas, on_proponer)
        self.assertEqual(len(llamadas), 1)
        self.assertEqual(llamadas[0][0], "venta")

    def test_corta_al_llegar_al_tope_de_iteraciones(self):
        """Un modelo en loop no puede llamar herramientas para siempre."""
        from .claude import MAX_ITERACIONES

        eterna = [
            _Respuesta([_Bloque("tool_use", name="estado_de_caja", input={}, id=f"t{i}")], stop_reason="tool_use")
            for i in range(MAX_ITERACIONES + 5)
        ]
        texto, _, cliente = self._conversar(eterna)
        self.assertEqual(len(cliente.llamadas), MAX_ITERACIONES)
        self.assertIn("enredé", texto)

    def test_una_negativa_del_modelo_se_responde_sin_romper(self):
        texto, _, _ = self._conversar([_Respuesta([], stop_reason="refusal")])
        self.assertIn("No puedo responder eso", texto)

    def test_manda_el_prompt_de_sistema_cacheado_y_las_herramientas(self):
        _, _, cliente = self._conversar([_Respuesta([_Bloque("text", text="ok")])])
        enviado = cliente.llamadas[0]
        self.assertEqual(enviado["system"][0]["cache_control"], {"type": "ephemeral"})
        self.assertIn("Forrajería (test)", enviado["system"][0]["text"])
        nombres = {t["name"] for t in enviado["tools"]}
        self.assertIn("resumen_ventas", nombres)
        self.assertIn("proponer_venta", nombres)


class CuotaTests(APITestCase):
    """El límite diario es lo que hace que el costo sea acotable por sucursal."""

    def setUp(self):
        self.comercio = Comercio.objects.create(
            nombre="Forrajería (test)", asistente_consultas_diarias=3
        )
        self.user = User.objects.create_user(username="dueno_cuota", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

    def _consultar(self):
        def falso(comercio, historial, on_proponer):
            return ("ok", historial, {"entrada": 1500, "cacheados": 1300, "salida": 600})

        with patch("asistente.views.conversar", side_effect=falso):
            return self.client.post("/api/asistente/consultar/", {"mensaje": "hola"}, format="json")

    def test_corta_al_llegar_al_limite_diario(self):
        for numero in range(3):
            self.assertEqual(self._consultar().status_code, status.HTTP_200_OK, f"consulta {numero + 1}")

        cuarta = self._consultar()
        self.assertEqual(cuarta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("3 consultas de hoy", cuarta.data["detail"])

    def test_no_llama_a_la_api_cuando_no_hay_cupo(self):
        """Lo importante del límite: una consulta bloqueada no se paga."""
        for _ in range(3):
            self._consultar()

        with patch("asistente.views.conversar") as mock_conversar:
            respuesta = self.client.post("/api/asistente/consultar/", {"mensaje": "hola"}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        mock_conversar.assert_not_called()

    def test_una_sucursal_sin_habilitar_no_puede_consultar(self):
        self.comercio.asistente_consultas_diarias = 0
        self.comercio.save(update_fields=["asistente_consultas_diarias"])
        respuesta = self._consultar()
        self.assertEqual(respuesta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("no está habilitado", respuesta.data["detail"])

    def test_el_cupo_es_por_sucursal(self):
        otra = Comercio.objects.create(nombre="Sucursal Sur", asistente_consultas_diarias=3)
        UsuarioComercio.objects.create(user=self.user, comercio=otra, rol="Dueño")

        def falso(comercio, historial, on_proponer):
            return ("ok", historial, {})

        def consultar_en(comercio):
            # Con dos sucursales hay que decir en cuál se opera; sin el header
            # el backend rechaza el pedido y el test no probaría nada.
            with patch("asistente.views.conversar", side_effect=falso):
                return self.client.post(
                    "/api/asistente/consultar/", {"mensaje": "hola"},
                    format="json", HTTP_X_COMERCIO_ID=str(comercio.id),
                )

        for numero in range(3):
            self.assertEqual(
                consultar_en(self.comercio).status_code, status.HTTP_200_OK, f"consulta {numero + 1}"
            )
        self.assertEqual(
            consultar_en(self.comercio).status_code, status.HTTP_429_TOO_MANY_REQUESTS,
            "la primera sucursal ya agotó su cupo",
        )

        # La otra arranca con su cupo entero: el límite no se comparte.
        self.assertEqual(consultar_en(otra).status_code, status.HTTP_200_OK)
        self.assertEqual(UsoAsistente.objects.get(comercio=otra).consultas, 1)

    def test_acumula_los_tokens_para_poder_costear(self):
        self._consultar()
        self._consultar()
        uso = UsoAsistente.objects.get(comercio=self.comercio)
        self.assertEqual(uso.consultas, 2)
        self.assertEqual(uso.tokens_entrada, 3000)
        self.assertEqual(uso.tokens_cacheados, 2600)
        self.assertEqual(uso.tokens_salida, 1200)

    def test_calcula_el_costo_separando_lo_cacheado(self):
        """Lo leído de caché sale ~10x más barato: si no se separa, el costo
        estimado queda inflado y la cotización sale mal."""
        from .cuota import costo_usd

        self._consultar()
        uso = UsoAsistente.objects.get(comercio=self.comercio)
        costo = costo_usd(uso, "claude-opus-5")
        # 1500 entrada x $5 + 1300 cacheados x $0,50 + 600 salida x $25, por millón
        esperado = Decimal("1500") / 1000000 * Decimal("5") \
            + Decimal("1300") / 1000000 * Decimal("0.5") \
            + Decimal("600") / 1000000 * Decimal("25")
        self.assertEqual(costo, esperado.quantize(Decimal("0.0001")))

    def test_endpoint_de_uso_informa_cupo_y_gasto(self):
        self._consultar()
        respuesta = self.client.get("/api/asistente/uso/")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data["limite_diario"], 3)
        self.assertEqual(respuesta.data["usadas_hoy"], 1)
        self.assertEqual(respuesta.data["restantes_hoy"], 2)
        self.assertTrue(respuesta.data["habilitado"])
        self.assertGreater(Decimal(respuesta.data["costo_periodo_usd"]), 0)


class _Uso:
    def __init__(self, entrada=0, salida=0, cache_read=0, cache_write=0):
        self.input_tokens = entrada
        self.output_tokens = salida
        self.cache_read_input_tokens = cache_read
        self.cache_creation_input_tokens = cache_write


class ConteoDeTokensTests(APITestCase):
    """Los tokens se acumulan en TODAS las vueltas del bucle.

    Con respuestas falsas sin `usage` este camino no se ejercita, y así se
    coló un bug: la variable del for de herramientas pisaba el acumulador y
    la segunda vuelta reventaba. Acá las respuestas traen `usage`, como la
    API real.
    """

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Forrajería (test)")
        Producto.objects.create(
            comercio=self.comercio, nombre="Balanceado perro", precio_venta=Decimal("2000"), stock=50,
        )

    def _conversar(self, respuestas):
        from .claude import conversar

        cliente = _ClienteFalso(respuestas)
        with patch("asistente.claude._cliente", return_value=(cliente, "claude-opus-5")):
            return conversar(
                self.comercio, [{"role": "user", "content": "hola"}], lambda t, d: "{}"
            )

    def test_suma_los_tokens_de_las_dos_vueltas(self):
        r1 = _Respuesta(
            [_Bloque("tool_use", name="buscar_producto", input={"texto": "Balanceado"}, id="t1")],
            stop_reason="tool_use",
        )
        r1.usage = _Uso(entrada=500, salida=80, cache_read=1300)
        r2 = _Respuesta([_Bloque("text", text="Tenés Balanceado perro.")])
        r2.usage = _Uso(entrada=900, salida=150, cache_read=1300)

        _texto, _historial, uso = self._conversar([r1, r2])
        self.assertEqual(uso["entrada"], 1400, "suma las dos vueltas, no sólo la última")
        self.assertEqual(uso["salida"], 230)
        self.assertEqual(uso["cacheados"], 2600)

    def test_cuenta_la_escritura_de_cache_como_entrada_plena(self):
        r = _Respuesta([_Bloque("text", text="ok")])
        r.usage = _Uso(entrada=100, salida=50, cache_write=1300)
        _t, _h, uso = self._conversar([r])
        self.assertEqual(uso["entrada"], 1400, "escribir la caché se paga a precio pleno")
        self.assertEqual(uso["cacheados"], 0)


class CredencialesTests(APITestCase):
    """Cada comercio puede facturar con su propia cuenta de Anthropic."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Forrajería (test)")

    def test_sin_key_propia_usa_la_del_servidor(self):
        from .claude import credenciales

        with self.settings(ANTHROPIC_API_KEY="sk-del-servidor", ASISTENTE_MODELO="claude-opus-5"):
            key, modelo, origen = credenciales(self.comercio)
        self.assertEqual(key, "sk-del-servidor")
        self.assertEqual(origen, "servidor")
        self.assertEqual(modelo, "claude-opus-5")

    def test_con_key_propia_factura_el_comercio_y_elige_modelo(self):
        from .claude import credenciales
        from .claves import cifrar

        self.comercio.asistente_api_key_cifrada = cifrar("sk-del-cliente")
        self.comercio.asistente_modelo = "claude-sonnet-5"
        self.comercio.save()

        with self.settings(ANTHROPIC_API_KEY="sk-del-servidor", ASISTENTE_MODELO="claude-opus-5"):
            key, modelo, origen = credenciales(self.comercio)
        self.assertEqual(key, "sk-del-cliente", "no usa la del servidor")
        self.assertEqual(origen, "comercio")
        self.assertEqual(modelo, "claude-sonnet-5")

    def test_la_key_se_guarda_cifrada_no_en_texto_plano(self):
        from .claves import cifrar, descifrar

        guardada = cifrar("sk-ant-secreta-12345")
        self.assertNotIn("sk-ant-secreta-12345", guardada)
        self.assertEqual(descifrar(guardada), "sk-ant-secreta-12345")

    def test_una_key_ilegible_no_rompe_el_sistema(self):
        """Si rotan SECRET_KEY, la key vieja no se puede descifrar: el
        asistente cae a la del servidor en vez de tirar el sistema abajo."""
        from .claude import credenciales

        self.comercio.asistente_api_key_cifrada = "esto-no-es-un-token-valido"
        self.comercio.save()
        with self.settings(ANTHROPIC_API_KEY="sk-del-servidor"):
            key, _modelo, origen = credenciales(self.comercio)
        self.assertEqual(key, "sk-del-servidor")
        self.assertEqual(origen, "servidor")


class CuentaEndpointTests(APITestCase):
    """La API key del cliente entra, pero no sale."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Forrajería (test)")
        self.dueno = User.objects.create_user(username="dueno_cuenta", password="testpass123")
        UsuarioComercio.objects.create(user=self.dueno, comercio=self.comercio, rol="Dueño")
        from core.models import Perfil
        Perfil.objects.create(user=self.dueno, comercio=self.comercio, nombre_completo="Dueño", rol="Dueño")
        self.client.force_authenticate(user=self.dueno)

    def test_carga_la_key_y_nunca_la_devuelve(self):
        respuesta = self.client.post(
            "/api/asistente/cuenta/",
            {"api_key": "sk-ant-super-secreta-9999", "modelo": "claude-sonnet-5"},
            format="json",
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK, respuesta.data)
        self.assertTrue(respuesta.data["tiene_key_propia"])
        self.assertEqual(respuesta.data["factura"], "comercio")
        self.assertEqual(respuesta.data["modelo"], "claude-sonnet-5")

        # La key no aparece por ningún lado en la respuesta.
        self.assertNotIn("sk-ant-super-secreta-9999", str(respuesta.data))
        self.assertEqual(respuesta.data["key_enmascarada"], "…9999")

        # Ni siquiera guardada en claro en la base.
        self.comercio.refresh_from_db()
        self.assertNotIn("sk-ant-super-secreta-9999", self.comercio.asistente_api_key_cifrada)

    def test_borrar_la_key_vuelve_a_la_cuenta_del_servidor(self):
        self.client.post("/api/asistente/cuenta/", {"api_key": "sk-ant-propia"}, format="json")
        respuesta = self.client.post("/api/asistente/cuenta/", {"api_key": ""}, format="json")
        self.assertFalse(respuesta.data["tiene_key_propia"])
        self.assertEqual(respuesta.data["factura"], "servidor")

    def test_rechaza_algo_que_no_parece_una_api_key(self):
        respuesta = self.client.post("/api/asistente/cuenta/", {"api_key": "mi-contraseña"}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("sk-", str(respuesta.data))

    def test_un_cajero_no_puede_tocar_la_cuenta(self):
        from core.models import Perfil

        cajero = User.objects.create_user(username="cajero_x", password="testpass123")
        UsuarioComercio.objects.create(user=cajero, comercio=self.comercio, rol="Cajero")
        Perfil.objects.create(user=cajero, comercio=self.comercio, nombre_completo="Cajero", rol="Cajero")
        self.client.force_authenticate(user=cajero)

        self.assertEqual(
            self.client.post("/api/asistente/cuenta/", {"api_key": "sk-x"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
