# TratoYA — Guía de despliegue a producción

## Stack recomendado (mejor costo-beneficio)

| Servicio | Proveedor | Costo/mes | Propósito |
|---|---|---|---|
| Frontend | **Vercel** | Gratis | React app, CDN global, HTTPS automático |
| Backend | **Railway** | ~$5 | Node.js API, auto-deploy desde GitHub |
| Base de datos | **Neon** | Gratis / $19 | PostgreSQL managed, backups PITR incluidos |
| Redis | **Upstash** | Gratis | Cache y sesiones, serverless |
| Dominio | **Namecheap** | ~$12/año | `tratoya.co` (~$10) o `tratoya.com` (~$12) |
| Monitoreo | **Sentry** | Gratis | Alertas de errores en tiempo real |
| **Total** | | **~$5–24/mes** | Escalable hasta miles de usuarios |

---

## Paso 1 — Subir el código a GitHub

1. Ir a [github.com/new](https://github.com/new) y crear un repositorio privado llamado `tratoya`
2. En la carpeta `C:\Users\jdavo\tratoya`, ejecutar:

```bash
git remote add origin https://github.com/TU_USUARIO/tratoya.git
git branch -M main
git push -u origin main
```

> El `.gitignore` ya protege `.env`, claves JWT, y `node_modules`.

---

## Paso 2 — Base de datos en Neon (PostgreSQL)

**Por qué Neon:** backups automáticos con point-in-time recovery (PITR), ramificaciones para pruebas, plan gratuito generoso.

1. Ir a [neon.tech](https://neon.tech) → crear cuenta → **New Project** → nombre: `tratoya`
2. Copiar la **Connection string** (formato `postgresql://user:pass@host/neon?sslmode=require`)
3. Guardarla, se necesita en los pasos siguientes

**Backups en Neon:**
- Plan gratuito: 7 días de historial de PITR (restaurar a cualquier punto en los últimos 7 días)
- Plan Launch ($19/mo): 30 días de historial + ramas de base de datos para staging

Para hacer un backup manual adicional:
```bash
# Desde tu máquina local o desde Railway
export DATABASE_URL="postgresql://..."
bash tratoya-backend/scripts/backup.sh
```

Los backups se guardan en `tratoya-backend/backups/` comprimidos con gzip.

---

## Paso 3 — Redis en Upstash

1. Ir a [upstash.com](https://upstash.com) → crear cuenta → **Create Database**
2. Tipo: **Redis**, región: **us-east-1** (o la más cercana a tu backend)
3. Copiar la URL de conexión Node.js (formato `rediss://default:TOKEN@host.upstash.io:6379`)

---

## Paso 4 — Backend en Railway

1. Ir a [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Seleccionar el repositorio `tratoya`
3. Railway detectará el `Procfile` automáticamente
4. En **Settings → Root Directory** escribir: `tratoya-backend`
5. En **Variables** agregar todas las del `.env.example`:

```
NODE_ENV=production
DATABASE_URL=postgresql://...   ← de Neon
REDIS_URL=rediss://...          ← de Upstash
JWT_SECRET=...                  ← genera con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_REFRESH_SECRET=...          ← genera otro diferente
FRONTEND_URL=https://tratoya.vercel.app   ← ajustar después del paso 5
EPAYCO_P_CUST_ID=...
EPAYCO_P_KEY=...
EPAYCO_PUBLIC_KEY=...
EPAYCO_TEST=false
ADMIN_EMAIL=admin@tratoya.co
ADMIN_PASSWORD=...              ← contraseña segura
ADMIN_RESET_ON_BOOT=false
DB_SYNC=false
DB_SSL=true
PAYMENTS_REAL_ENABLED=true
BETA_ALLOW_SANDBOX_PAYMENTS=false
```

6. Hacer clic en **Deploy** → Railway le asignará una URL como `https://tratoya-backend.up.railway.app`
7. Verificar: `https://tratoya-backend.up.railway.app/health` debe devolver `{"status":"ok",...}`

---

## Paso 5 — Frontend en Vercel

1. Ir a [vercel.com](https://vercel.com) → **New Project** → importar repositorio `tratoya`
2. En **Root Directory** escribir: `tratoya-frontend`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. En **Environment Variables** agregar:

```
VITE_API_URL=https://tratoya-backend.up.railway.app/api
```

6. Hacer clic en **Deploy** → Vercel asignará `https://tratoya.vercel.app`

**Actualizar FRONTEND_URL en Railway:**
- Volver a Railway → Variables → cambiar `FRONTEND_URL` a `https://tratoya.vercel.app`
- Railway reinicia automáticamente

---

## Paso 6 — Dominio personalizado

### Comprar dominio
- [namecheap.com](https://namecheap.com) → buscar `tratoya.co` (~$10/año) o `tratoya.com` (~$12/año)

### Conectar a Vercel (frontend)
1. Vercel → Settings → Domains → agregar `tratoya.co` y `www.tratoya.co`
2. En Namecheap → DNS → agregar los registros que Vercel indica (normalmente un `CNAME`)
3. HTTPS se activa automáticamente en minutos

### Conectar subdominio al backend (opcional)
1. En Namecheap → DNS → agregar `CNAME api → tratoya-backend.up.railway.app`
2. En Railway → Settings → Domains → agregar `api.tratoya.co`
3. Actualizar `VITE_API_URL` en Vercel a `https://api.tratoya.co/api`

---

## Paso 7 — CI/CD automático (GitHub Actions)

El archivo `.github/workflows/deploy.yml` ya está listo. Solo necesita 3 secrets en GitHub:

1. Ir a GitHub → Settings → Secrets → Actions → **New repository secret**
2. Agregar:

| Secret | Cómo obtenerlo |
|---|---|
| `RAILWAY_TOKEN` | Railway → Account Settings → Tokens → New Token |
| `VERCEL_TOKEN` | Vercel → Settings → Tokens → Create Token |
| `VERCEL_ORG_ID` | Vercel → Settings → General → Team ID |
| `VERCEL_PROJECT_ID` | Vercel → tu proyecto → Settings → Project ID |
| `VITE_API_URL` | `https://api.tratoya.co/api` o la URL de Railway |

Desde ahora: cada `git push` a `main` despliega automáticamente backend y frontend.

---

## Paso 8 — Webhooks de ePayco

En el panel de ePayco configurar la URL de confirmación:
```
https://api.tratoya.co/api/webhooks/epayco
```
O si no tienes dominio aún:
```
https://tratoya-backend.up.railway.app/api/webhooks/epayco
```

---

## Monitoreo y alertas

### Sentry (errores en tiempo real)
1. Ir a [sentry.io](https://sentry.io) → New Project → Node.js
2. Copiar el DSN y agregar `SENTRY_DSN=...` en Railway
3. Sentry te enviará alertas por email cuando haya un error en producción

### Railway health checks
Railway ya está configurado con `healthcheckPath: /health` en `railway.json`. Si el health check falla 5 veces, Railway reinicia el servicio automáticamente.

---

## Backups manuales adicionales

```bash
# Desde cualquier terminal con psql instalado:
export DATABASE_URL="postgresql://..."
bash tratoya-backend/scripts/backup.sh

# Los backups quedan en tratoya-backend/backups/
# Se guardan comprimidos (gzip) y se eliminan automáticamente después de 30 días
```

Para restaurar:
```bash
bash tratoya-backend/scripts/restore.sh backups/tratoya_20260101_030000.sql.gz
```

---

## Checklist antes de ir a producción

- [ ] `NODE_ENV=production` en Railway
- [ ] `DB_SYNC=false` en Railway (tablas no se alteran automáticamente)
- [ ] `EPAYCO_TEST=false` y `PAYMENTS_REAL_ENABLED=true`
- [ ] `BETA_ALLOW_SANDBOX_PAYMENTS=false`
- [ ] `ADMIN_RESET_ON_BOOT=false`
- [ ] JWT secrets generados con `crypto.randomBytes(64)` (no usar los de ejemplo)
- [ ] Contraseña de admin cambiada
- [ ] Health check funcionando: `/health`
- [ ] Webhook de ePayco apuntando a la URL de producción
- [ ] HTTPS activo en dominio (Vercel lo hace automático)
- [ ] Sentry DSN configurado para alertas de errores

---

## Escalabilidad futura

Cuando la plataforma crezca y necesites más capacidad:
- **Railway Pro** ($20/mo): más RAM, sin límite de horas, SLA 99.9%
- **Neon Launch** ($19/mo): 30 días PITR, ramas de BD, más almacenamiento
- **Upstash Pro** ($10/mo): más comandos Redis/día, replicación
- **Cloudflare** (gratis): CDN + protección DDoS frente a Vercel

El código ya está preparado para escalar: conexión pool configurada, Redis opcional sin crash, SSE para tiempo real.
