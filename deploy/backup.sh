#!/usr/bin/env bash
# Respaldo diario de la base. La contabilidad de un negocio real no puede
# depender de un solo disco.
#
#   sudo cp deploy/backup.sh /usr/local/bin/petrona-backup
#   sudo chmod +x /usr/local/bin/petrona-backup
#   sudo crontab -e   ->   15 3 * * * /usr/local/bin/petrona-backup
set -euo pipefail

DESTINO=/home/petrona/backups
RETENCION_DIAS=30
FECHA=$(date +%Y%m%d_%H%M%S)

mkdir -p "$DESTINO"
pg_dump -U petrona -h localhost petrona | gzip > "$DESTINO/petrona_$FECHA.sql.gz"

# Un backup que vive en la misma maquina que la base no es un backup: si se
# pierde el servidor se pierden los dos. Descomentar despues de configurar
# rclone (`rclone config`) contra Drive, Backblaze o lo que uses.
# rclone copy "$DESTINO/petrona_$FECHA.sql.gz" remoto:petrona-backups/

find "$DESTINO" -name 'petrona_*.sql.gz' -mtime +$RETENCION_DIAS -delete

echo "backup OK: petrona_$FECHA.sql.gz ($(du -h "$DESTINO/petrona_$FECHA.sql.gz" | cut -f1))"
