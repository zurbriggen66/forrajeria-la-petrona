"""Conversación con Claude: arma el prompt, corre el bucle de herramientas.

Se usa un bucle manual y no el tool runner del SDK a propósito: el runner está
en beta, y acá hace falta cortar el bucle apenas el modelo propone una acción
que escribe (para que la confirme una persona) y poner un techo duro de
iteraciones, que es lo que acota el costo de una consulta.
"""
import json
import logging

from django.conf import settings
from django.utils import timezone

from .claves import descifrar
from .herramientas import ESQUEMAS, LECTURA

logger = logging.getLogger(__name__)

# Techo de vueltas del bucle. Una consulta normal usa 1-3; el tope existe para
# que un modelo que se quede en loop no dispare la factura.
MAX_ITERACIONES = 8

INSTRUCCIONES = """Sos el asistente de {nombre_comercio}, una forrajería en Argentina.

Ayudás al dueño y a los empleados a consultar cómo va el negocio y a preparar
tareas simples. Hablás en español rioplatense (voseo), directo y breve — como
alguien que atiende el mostrador, no como un manual.

Cómo trabajás:
- Para cualquier dato del negocio usá las herramientas. Nunca inventes números:
  si una herramienta no te da el dato, decí que no lo tenés.
- Los montos van en pesos argentinos, con formato $ 1.234,56.
- Cuando algo es una cantidad de kilos, aclaralo (ej. "3,5 kg"), y cuando es una
  bolsa cerrada, decí cuántos kilos tiene.
- Respondé con el número concreto primero y el detalle después. Nada de
  párrafos largos.

Sobre las acciones que modifican datos (cargar un producto, hacer una venta):
- Vos NO las ejecutás. Las preparás con proponer_alta_de_producto o
  proponer_venta, y las confirma una persona desde la pantalla.
- Antes de proponer una venta, buscá cada producto con buscar_producto para
  usar su id real y su precio real.
- Si te falta un dato obligatorio, preguntalo. No lo completes por tu cuenta.
- Después de proponer, decí en una línea qué preparaste y que falta confirmar.

Hoy es {hoy}."""


class AsistenteNoConfigurado(Exception):
    """Falta la API key: el asistente queda apagado, el resto del sistema no."""


def credenciales(comercio):
    """Con qué cuenta y con qué modelo consulta este comercio.

    Si el comercio cargó su propia API key, el consumo lo factura él
    directamente a Anthropic y elige su modelo. Si no, cae a la cuenta del
    servidor — que es la de quien administra el sistema y paga por todos.
    """
    propia = descifrar(comercio.asistente_api_key_cifrada)
    if propia:
        return propia, (comercio.asistente_modelo or settings.ASISTENTE_MODELO), "comercio"
    return getattr(settings, "ANTHROPIC_API_KEY", ""), settings.ASISTENTE_MODELO, "servidor"


def _cliente(comercio):
    api_key, modelo, _origen = credenciales(comercio)
    if not api_key:
        raise AsistenteNoConfigurado(
            "El asistente no está configurado: falta cargar la API key de Anthropic "
            "(en Config, o en el .env del servidor)."
        )
    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover - depende del entorno
        raise AsistenteNoConfigurado(
            "Falta instalar la librería 'anthropic' en el servidor (pip install anthropic)."
        ) from exc
    return anthropic.Anthropic(api_key=api_key), modelo


def _sistema(comercio):
    return INSTRUCCIONES.format(
        nombre_comercio=comercio.nombre,
        hoy=timezone.localtime(timezone.now()).strftime("%d/%m/%Y"),
    )


def _sumar_uso(acumulado, respuesta):
    """Acumula los tokens de cada vuelta del bucle. Una consulta puede dar
    varias llamadas a la API y todas se pagan, así que el consumo real es la
    suma, no el de la última."""
    uso = getattr(respuesta, "usage", None)
    if uso is None:
        return
    acumulado["entrada"] += getattr(uso, "input_tokens", 0) or 0
    acumulado["salida"] += getattr(uso, "output_tokens", 0) or 0
    # Lo leído de caché se cobra ~10 veces más barato: se cuenta aparte para
    # que el costo estimado no quede inflado.
    acumulado["cacheados"] += getattr(uso, "cache_read_input_tokens", 0) or 0
    acumulado["entrada"] += getattr(uso, "cache_creation_input_tokens", 0) or 0


def conversar(comercio, mensajes, on_proponer):
    """Corre la conversación hasta que el modelo termina de responder.

    `mensajes` es el historial en formato de la API (se manda entero: la API
    no guarda estado). `on_proponer(tipo, datos)` se llama cuando el modelo
    propone una acción que escribe; tiene que devolver el texto que se le
    manda de vuelta como resultado de esa herramienta.

    Devuelve (texto_de_respuesta, historial_actualizado, tokens_consumidos).
    """
    cliente, modelo = _cliente(comercio)
    sistema = _sistema(comercio)
    historial = list(mensajes)
    uso = {"entrada": 0, "salida": 0, "cacheados": 0}

    for _ in range(MAX_ITERACIONES):
        respuesta = cliente.messages.create(
            model=modelo,
            # Es un techo, no un objetivo: no se paga por no usarlo. Holgado a
            # propósito porque el razonamiento del modelo también cuenta acá —
            # con un tope corto, una respuesta se corta por la mitad.
            max_tokens=16000,
            # El prompt de sistema y las herramientas son idénticos en cada
            # consulta: cachearlos evita pagarlos de nuevo cada vez.
            system=[{"type": "text", "text": sistema, "cache_control": {"type": "ephemeral"}}],
            tools=ESQUEMAS,
            output_config={"effort": settings.ASISTENTE_EFFORT},
            messages=historial,
        )

        _sumar_uso(uso, respuesta)

        if respuesta.stop_reason == "refusal":
            return ("No puedo responder eso. Probá preguntándomelo de otra forma.", historial, uso)

        if respuesta.stop_reason == "max_tokens":
            # Se cortó a mitad de camino: seguir el bucle con una respuesta
            # incompleta puede dejar un tool_use trunco, así que se corta acá.
            texto = "".join(b.text for b in respuesta.content if b.type == "text")
            return (
                (texto.strip() + "\n\n(La respuesta quedó cortada. Pedímelo por partes.)").strip(),
                historial,
                uso,
            )

        historial.append({"role": "assistant", "content": respuesta.content})

        usos = [b for b in respuesta.content if b.type == "tool_use"]
        if not usos:
            texto = "".join(b.text for b in respuesta.content if b.type == "text")
            return (texto.strip() or "No tengo una respuesta para eso.", historial, uso)

        resultados = []
        # OJO con el nombre: `uso` es el acumulador de tokens de toda la
        # conversación. Usarlo también como variable del for lo pisaba, y en la
        # segunda vuelta _sumar_uso recibía un bloque en vez del diccionario.
        for llamada in usos:
            resultados.append({
                "type": "tool_result",
                "tool_use_id": llamada.id,
                "content": _ejecutar(comercio, llamada.name, llamada.input, on_proponer),
            })
        historial.append({"role": "user", "content": resultados})

    return (
        "Me enredé buscando la respuesta. Probá preguntármelo más simple o en partes.",
        historial,
        uso,
    )


def _ejecutar(comercio, nombre, argumentos, on_proponer):
    """Corre una herramienta y devuelve su resultado como texto JSON."""
    try:
        if nombre == "proponer_alta_de_producto":
            return on_proponer("alta_producto", argumentos)
        if nombre == "proponer_venta":
            return on_proponer("venta", argumentos)

        funcion = LECTURA.get(nombre)
        if funcion is None:
            return json.dumps({"error": f"No existe la herramienta {nombre}."}, ensure_ascii=False)
        return json.dumps(funcion(comercio, **argumentos), ensure_ascii=False)
    except TypeError as exc:
        # El modelo mandó argumentos que no encajan con la función.
        return json.dumps({"error": f"Argumentos inválidos: {exc}"}, ensure_ascii=False)
    except Exception:
        # Un error de una herramienta no puede tumbar la conversación entera:
        # se le informa al modelo para que lo diga y siga.
        logger.exception("Error ejecutando la herramienta %s del asistente", nombre)
        return json.dumps(
            {"error": "La consulta falló en el servidor. Avisale al usuario que no pudiste obtener ese dato."},
            ensure_ascii=False,
        )
