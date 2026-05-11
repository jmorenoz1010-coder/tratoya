#!/usr/bin/env bash
# ============================================================
# restore.sh — Restaurar base de datos TratoYA desde un backup
#
# USO:
#   export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
#   bash scripts/restore.sh backups/tratoya_20260101_030000.sql.gz
# ============================================================

set -euo pipefail

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "USO: $0 <archivo_backup.sql.gz>"
  echo "Backups disponibles:"
  ls -1t backups/tratoya_*.sql.gz 2>/dev/null || echo "  (ninguno)"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "❌ Archivo no encontrado: $BACKUP_FILE"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ ERROR: DATABASE_URL no está definida"
  exit 1
fi

echo "⚠️  ADVERTENCIA: Esto sobrescribirá la base de datos actual."
read -p "¿Continuar? (escribe 'si' para confirmar): " CONFIRM
if [[ "$CONFIRM" != "si" ]]; then
  echo "Cancelado."
  exit 0
fi

echo "🔄 Restaurando desde: $BACKUP_FILE"
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
echo "✅ Restauración completada"
