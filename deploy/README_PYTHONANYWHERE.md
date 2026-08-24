# Despliegue — PythonAnywhere (ignaciozurbriggen)

Alternativa a `deploy/README.md` (pensado para un VPS con nginx). Acá no hay
nginx: PythonAnywhere sirve la app WSGI directo y los estáticos por mapeos
propios. El bot de WhatsApp queda **apagado** — el refactor para que corra
en este entorno todavía no está terminado.

Dominio de ejemplo: `ignaciozurbriggen.pythonanywhere.com`. Reemplazalo si
usás un dominio propio.

---

## 0. Probar la instalación ANTES de avanzar

`pyafipws` se instala desde GitHub y compila. En el VPS eso lo resuelven los
paquetes `-dev` de apt (`build-essential`, `libxml2-dev`, `libxslt1-dev`),
pero en PythonAnywhere no hay `sudo` para instalarlos si faltan. Probalo
primero, antes de perder tiempo con el resto:

```bash
mkvirtualenv --python=python3.12 petrona-venv
pip install -r ~/app/backend/requirements.txt
```

(`ls /usr/bin/python3.1*` para ver qué versiones hay si 3.12 no está —
Django 6.1 exige 3.12+.)

**Si `pyafipws` falla al compilar:** no bloquea el resto. Sacá esa línea de
`requirements.txt` en el servidor (`pip install -r requirements.txt` sin
ella) y avisame — hay que hacer perezoso el import de `pyafipws` en
`fiscal/afip.py` (hoy es top-level, así que sin el paquete instalado toda la
app deja de arrancar por culpa de un módulo que ni siquiera se usa todavía,
Fase 7 sigue en pausa). Es un cambio de 2 líneas si hace falta.

## 1. Código

Consola Bash de PythonAnywhere:

```bash
cd ~
git clone https://github.com/zurbriggen66/forrajeria-la-petrona.git app
cd app
git checkout deploy-prep   # o la rama/PR final que se mergee a main
```

Repo privado: si el `clone` pide usuario/contraseña, usá un Personal Access
Token de GitHub como contraseña (Settings → Developer settings → Tokens).

## 2. Base de datos

Pestaña **Databases** → creá la Postgres del plan pago, anotá host, puerto,
usuario y contraseña que te da PA (algo como
`ignaciozurbriggen-XXXX.postgres.pythonanywhere-services.com:PUERTO`).

## 3. `backend/.env`

```bash
cd ~/app/backend
cp .env.example .env
```

Editalo (`nano .env`) con:

```
SECRET_KEY=<generar: python -c "import secrets;print(secrets.token_urlsafe(50))">
DEBUG=False
ALLOWED_HOSTS=ignaciozurbriggen.pythonanywhere.com
CSRF_TRUSTED_ORIGINS=https://ignaciozurbriggen.pythonanywhere.com
DATABASE_URL=postgres://usuario:password@host:puerto/nombre_db
ANTHROPIC_API_KEY=          # opcional, vacío = asistente apagado
```

No pongas `WHATSAPP_BOT_URL` (dejalo vacío/ausente) — el bot no anda todavía
acá, y así el resto del sistema funciona sin depender de él.

## 4. Migrar y cargar los datos

```bash
workon petrona-venv     # si no está activo
python manage.py migrate
python manage.py collectstatic --noinput

python manage.py loaddata ../deploy/seed.json
```

Verificá los conteos antes de seguir (deben dar 8.069 ventas / 93 anuladas,
6.482 productos, 179 clientes, 21 proveedores — mismo chequeo que en el
runbook del VPS):

```bash
python manage.py shell -c "
from ventas.models import Venta; from productos.models import Producto
from clientes.models import Cliente
print('ventas', Venta.objects.count(), '| anuladas', Venta.objects.filter(anulada=True).count())
print('productos', Producto.objects.count(), '| clientes', Cliente.objects.count())
"
```

Después borrá `deploy/seed.json` del servidor (`rm ../deploy/seed.json`) —
tiene datos personales reales y ya cumplió su función. La base de Postgres
pasa a ser la fuente de verdad.

## 5. Frontend

PA no trae Node moderno por apt y no hay `sudo` para instalarlo — se instala
en tu home con `nvm` (una sola vez):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
```

Build:

```bash
cd ~/app/frontend
npm ci
VITE_API_URL= npm run build
```

`VITE_API_URL` vacío a propósito: front y API salen del mismo origen acá
(no hay CORS que configurar), así que las llamadas van a `/api/...`
relativo. Si algún día servís el frontend desde otro dominio, hay que
volver a buildear con el `VITE_API_URL` correspondiente — se hornea en
tiempo de build, igual que en el runbook del VPS.

## 6. Configurar la Web app

Pestaña **Web** → **Add a new web app** → **Manual configuration** → la
versión de Python que usaste en el paso 0.

**Code:**
- Source code: `/home/ignaciozurbriggen/app/backend`
- Working directory: `/home/ignaciozurbriggen/app/backend`
- Virtualenv: `/home/ignaciozurbriggen/.virtualenvs/petrona-venv`

**WSGI configuration file** (abrí el link, reemplazá todo el contenido):

```python
import sys
import os

path = '/home/ignaciozurbriggen/app/backend'
if path not in sys.path:
    sys.path.insert(0, path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

**Static files** (tabla de la misma pestaña Web):

| URL | Directory |
|---|---|
| `/static/` | `/home/ignaciozurbriggen/app/backend/staticfiles` |
| `/assets/` | `/home/ignaciozurbriggen/app/frontend/dist/assets` |
| `/favicon.svg` | `/home/ignaciozurbriggen/app/frontend/dist/favicon.svg` |
| `/icons.svg` | `/home/ignaciozurbriggen/app/frontend/dist/icons.svg` |

Todo lo que no matchee esas rutas (ni `/api/`, ni `/admin/`) lo maneja
Django: `config/urls.py` tiene un catch-all que devuelve
`frontend/dist/index.html`, el mismo trabajo que hacía `try_files` en
nginx — así `/pos` o `/clientes` andan al recargar la página.

**Force HTTPS**: activalo (checkbox al final de la pestaña Web).

Click **Reload**.

## Verificación

- [ ] `https://ignaciozurbriggen.pythonanywhere.com` carga el SPA y el login funciona
- [ ] Recargar la página en `/clientes` o `/pos` (F5) no da 404
- [ ] `/admin/` con estilos, sin 403 de CSRF
- [ ] Los conteos del paso 4 coinciden
- [ ] El POS cobra una venta de prueba
- [ ] `python manage.py test` pasa contra la Postgres de PA (242 tests + los nuevos de `config`)

## Actualizar después

```bash
cd ~/app && git pull
workon petrona-venv
pip install -r backend/requirements.txt
cd backend && python manage.py migrate && python manage.py collectstatic --noinput
cd ../frontend && VITE_API_URL= npm run build
```

Después, pestaña Web → **Reload**.
