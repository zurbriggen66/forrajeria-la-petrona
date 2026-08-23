# Despliegue — Forrajería La Petrona

Todo corre en **una sola máquina**: nginx, gunicorn, PostgreSQL y el bot de
WhatsApp. El SPA y la API salen del mismo origen, así que no hay CORS ni
contenido mixto que configurar.

Reemplazá `TU_SUBDOMINIO` por el que registres en DuckDNS y `IP_DEL_VPS` por la
IP que te dé Hetzner.

---

## 1. Crear el servidor

Hetzner Cloud → **CX22** (2 vCPU, 4 GB, 40 GB), **Ubuntu 24.04**, datacenter
**Ashburn** (el más cercano a Argentina, ~120 ms).

Subí tu clave SSH al crear el servidor. Si no tenés uno: `ssh-keygen -t ed25519`.

## 2. Usuario y firewall

```bash
ssh root@IP_DEL_VPS

adduser --disabled-password --gecos "" petrona
usermod -aG sudo petrona
rsync --archive --chown=petrona:petrona ~/.ssh /home/petrona

ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

Quedan cerrados a propósito **3001** (bot), **5432** (Postgres) y **8000**
(gunicorn): los tres hablan sólo por loopback.

Deshabilitá el login por contraseña en `/etc/ssh/sshd_config`
(`PasswordAuthentication no`) y `systemctl restart ssh`.

## 3. Paquetes

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-venv python3-dev postgresql nginx git \
  build-essential libxml2-dev libxslt1-dev certbot python3-certbot-nginx

# Node 22 — el de apt es muy viejo para Baileys 6.7
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

`build-essential` y los `-dev` son para **pyafipws**, que se instala desde una
URL de git y compila.

Verificá que Postgres sea **16+** (Django 6.1 exige 15+): `psql --version`.

## 4. DuckDNS + HTTPS

Registrá el subdominio en https://duckdns.org apuntando a `IP_DEL_VPS`.
El certificado se saca en el paso 9, después de configurar nginx.

## 5. Código

```bash
su - petrona
git clone https://github.com/TU_USUARIO/TU_REPO.git app
cd app

python3 -m venv venv
./venv/bin/pip install -r backend/requirements.txt

cd whatsapp-bot && npm ci && cd ..
cd frontend && npm ci && cd ..
```

## 6. Base de datos

```bash
sudo -u postgres createuser --pwprompt petrona
sudo -u postgres createdb -O petrona petrona
```

`backend/.env` en el servidor (usá `backend/.env.example` como guía):

```
SECRET_KEY=<generar: python -c "import secrets;print(secrets.token_urlsafe(50))">
DEBUG=False
ALLOWED_HOSTS=TU_SUBDOMINIO.duckdns.org
CSRF_TRUSTED_ORIGINS=https://TU_SUBDOMINIO.duckdns.org
DATABASE_URL=postgres://petrona:<password>@localhost:5432/petrona
WHATSAPP_BOT_URL=http://127.0.0.1:3001
WHATSAPP_BOT_API_KEY=<generar otra clave larga>
ANTHROPIC_API_KEY=<tu key, o vacío para apagar el asistente>
```

`whatsapp-bot/.env`: `PORT=3001` y el **mismo** `API_KEY` que
`WHATSAPP_BOT_API_KEY`.

```bash
cd backend
../venv/bin/python manage.py migrate
../venv/bin/python manage.py collectstatic --noinput
```

## 7. Cargar los datos (una sola vez)

**En tu máquina:**

```bash
cd backend
PYTHONUTF8=1 python manage.py dumpdata --natural-foreign --natural-primary \
  -e contenttypes -e auth.Permission -e admin.logentry -e sessions \
  --indent 2 -o seed.json

scp seed.json petrona@IP_DEL_VPS:~/app/backend/
scp fiscal_certs/laspetrona-pos.{crt,key,csr} petrona@IP_DEL_VPS:~/app/backend/fiscal_certs/
```

`PYTHONUTF8=1` **no es opcional en Windows**: sin eso `dumpdata -o` escribe el
archivo en cp1252 y el `loaddata` del servidor muere con
`UnicodeDecodeError: 'utf-8' codec can't decode byte 0xed` en la primera tilde
("Forrajería", "Gómez"). Verificalo antes de subirlo:

```bash
python -c "open('seed.json','rb').read().decode('utf-8'); print('utf-8 OK')"
```

Las exclusiones evitan choques de IDs de content types contra una base nueva.
Los certificados de ARCA **no están en git** (correcto), por eso van por SCP.

**En el servidor:**

```bash
cd ~/app/backend
chmod 600 fiscal_certs/*.key
../venv/bin/python manage.py loaddata seed.json
```

Comprobá que los conteos coincidan antes de dar la migración por buena:

```bash
../venv/bin/python manage.py shell -c "
from ventas.models import Venta; from productos.models import Producto
from clientes.models import Cliente
print('ventas', Venta.objects.count(), '| anuladas', Venta.objects.filter(anulada=True).count())
print('productos', Producto.objects.count(), '| clientes', Cliente.objects.count())
"
```

Esperado: **8.069** ventas (93 anuladas), **6.482** productos, **179** clientes,
**21** proveedores. El ciclo completo ya se probó localmente contra una base
vacía: 21.905 objetos cargados, sin errores.

Después borrá `seed.json` **de los dos lados** — es un volcado con datos
personales de clientes reales.

Desde acá la base del servidor es la fuente de verdad; la local deja de serlo.

## 8. Frontend

```bash
cd ~/app/frontend
VITE_API_URL=https://TU_SUBDOMINIO.duckdns.org npm run build
```

`VITE_API_URL` se **hornea en tiempo de build**: si algún día cambiás el
dominio, hay que volver a buildear.

## 9. Servicios

```bash
cd ~/app
sudo cp deploy/gunicorn.service deploy/whatsapp-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn whatsapp-bot

sudo cp deploy/nginx.conf /etc/nginx/sites-available/petrona
sudo sed -i 's/TU_SUBDOMINIO/<tu subdominio real>/' /etc/nginx/sites-available/petrona
sudo ln -sf /etc/nginx/sites-available/petrona /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d TU_SUBDOMINIO.duckdns.org
```

Certbot reescribe el archivo agregando el bloque 443 y la redirección desde 80,
y deja la renovación automática configurada.

## 10. Backups

```bash
sudo cp deploy/backup.sh /usr/local/bin/petrona-backup
sudo chmod +x /usr/local/bin/petrona-backup
sudo crontab -e     # 15 3 * * * /usr/local/bin/petrona-backup
```

Configurá `rclone` y descomentá la línea de copia remota dentro del script. Un
backup que vive en la misma máquina que la base no es un backup.

**Probá una restauración** antes de darlo por hecho.

## 11. Vincular WhatsApp

Entrá a `https://TU_SUBDOMINIO.duckdns.org` → **Configuración → WhatsApp**.
Aparece el QR: escanealo desde el celular del negocio (WhatsApp → Dispositivos
vinculados). La sesión queda en `whatsapp-bot/auth/` y sobrevive los reinicios.

Para cambiar de celular, el botón **Desvincular** de esa misma pantalla.

---

## Verificación

- [ ] El SPA carga y el login funciona
- [ ] `/admin/` **con estilos** y sin 403 de CSRF
- [ ] Los conteos del paso 7 coinciden
- [ ] Estadísticas muestra $139.282.168,78 y 81 días con ventas
- [ ] El POS cobra una venta de prueba
- [ ] `curl http://IP_DEL_VPS:3001/status` desde afuera **falla** (bot no expuesto)
- [ ] `sudo systemctl restart whatsapp-bot` → vuelve **sin** pedir QR de nuevo
- [ ] `sudo reboot` → todo levanta solo
- [ ] `curl -I https://TU_SUBDOMINIO.duckdns.org/api/docs/` → **404**
- [ ] `../venv/bin/python manage.py test` pasa contra Postgres (242 tests)

## Actualizar después

```bash
cd ~/app && git pull
./venv/bin/pip install -r backend/requirements.txt
cd backend && ../venv/bin/python manage.py migrate && ../venv/bin/python manage.py collectstatic --noinput
cd ../frontend && VITE_API_URL=https://TU_SUBDOMINIO.duckdns.org npm run build
sudo systemctl restart gunicorn
```
