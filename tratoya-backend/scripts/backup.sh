#!/usr/bin/env bash
# ============================================================
# backup.sh — Respaldo de base de datos TratoYA
#
# USO:
#   export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
#   bash scripts/backup.sh
#
# Para programar (cron cada día a las 3 AM UTC):
#   0 3 * * * DATABASE_URL="..." bash /ruta/backup.sh >> /var/log/tratoya-backup.log 2>&1
# ============================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_FILE="${BACKUP_DIR}/tratoya_${TIMESTAMP}.sql.gz"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ ERROR: DATABASE_URL no está definida"
  exit 1
fi

echo "🗄️  Iniciando respaldo: $(date)"
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > "$BACKUP_FILE"
echo "✅ Respaldo completado: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# Eliminar backups más viejos que KEEP_DAYS días
find "$BACKUP_DIR" -name "tratoya_*.sql.gz" -mtime +"$KEEP_DAYS" -delete
echo "🧹 Backups antiguos (>${KEEP_DAYS} días) eliminados"
echo "📦 Backups actuales:"
ls -lh "$BACKUP_DIR"/tratoya_*.sql.gz 2>/dev/null || echo "  (ninguno)"
