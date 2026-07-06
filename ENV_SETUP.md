# TratoYa — Configuración de entorno y SSO

Guía de las variables de entorno necesarias para producción, con foco en el
**login social (SSO)** con Google (obligatorio) y Apple (opcional).

> El flujo SSO ya está implementado en el código (backend `tratoya-backend/src/routes/auth.js`
> y frontend `tratoya-frontend/src/pages/Auth.jsx` + panel admin). Solo falta
> **configurar las credenciales externas** y las variables de entorno.

---

## 1. Google SSO (obligatorio)

### 1.1 Qué crear en Google Cloud Console

1. Entra a <https://console.cloud.google.com> y crea o selecciona un proyecto.
2. **APIs y servicios → Pantalla de consentimiento de OAuth**
   - Tipo de usuario: **External**.
   - Completa nombre de la app (TratoYa), correo de soporte y dominio.
   - **Publica** la app (estado "In production") para permitir cualquier cuenta Google.
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**
   - Tipo de aplicación: **Aplicación web**.
   - **Orígenes de JavaScript autorizados:**
     - `https://tratoya.com`
     - `http://localhost:5173` (solo para desarrollo)
   - **URIs de redirección autorizados:**
     - `https://api.tratoya.com/api/auth/oauth/google/callback`
     - `http://localhost:4000/api/auth/oauth/google/callback` (solo desarrollo)
4. Copia el **Client ID** y el **Client Secret**.

### 1.2 Variables de entorno (backend — Vercel proyecto `tratoya-backend`)

```
API_PUBLIC_URL=https://api.tratoya.com
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
GOOGLE_REDIRECT_URI=https://api.tratoya.com/api/auth/oauth/google/callback
FRONTEND_URL=https://tratoya.com
```

> `GOOGLE_REDIRECT_URI` debe coincidir **exactamente** con el URI registrado en Google,
> incluido el esquema (`https`), el host y la ruta. Si no coincide, Google devuelve
> `redirect_uri_mismatch`.

---

## 2. Apple SSO (opcional — se puede activar después del lanzamiento)

Deja estas variables vacías si aún no lo usas; el backend responde `501` y el botón
simplemente no completa el login. Para activarlo necesitas una cuenta de Apple Developer:

```
APPLE_CLIENT_ID=com.tratoya.web        # Services ID
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_REDIRECT_URI=https://api.tratoya.com/api/auth/oauth/apple/callback
```

---

## 3. Control de acceso admin (SSO + roles)

El rol admin **nunca** se otorga automáticamente a quien entra por Google. Un usuario
social nuevo se crea con `rol='user'`. El acceso admin se controla por dos vías seguras:

1. **Rol en base de datos** (`users.rol` ∈ `admin` / `superadmin`) — fuente principal.
2. **Allowlist por variable de entorno** `ADMIN_EMAILS` — bootstrap seguro:

```
ADMIN_EMAILS=jmorenoz1010@gmail.com,otro-admin@tratoya.com
```

- Al iniciar sesión (por Google **o** por email/contraseña), si el email está en
  `ADMIN_EMAILS` y el usuario aún no es admin, se **promueve** a `rol='admin'`.
- La regla **solo promueve, nunca degrada**: un admin creado en base de datos no se
  ve afectado si su email no está en la lista.
- Déjala vacía si prefieres controlar el rol exclusivamente desde la base de datos.

### Cómo funciona el panel admin con SSO

El panel admin (`/operaciones-ty-7q4m9`) tiene su propia sesión (`ty_admin_token_v2`).
Se integró con SSO sin romper el login por contraseña existente:

- **Botón "Continuar con Google"** en la pantalla de login del panel: inicia el flujo
  OAuth y, al volver, si el usuario es admin, entra directo al panel.
- **Bootstrap de sesión:** si ya iniciaste sesión en TratoYa (por Google o normal) y
  tu usuario es admin, el panel **adopta** esa sesión automáticamente al abrirlo.
- La autorización real la impone el **backend**: `adminRouter` exige rol `admin`/`superadmin`
  en cada endpoint `/api/admin/*`. El check del frontend es solo UX.

---

## 4. Otras variables críticas de producción

| Variable | Para qué | Obligatoria hoy |
|---|---|---|
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Firma de tokens (64+ chars aleatorios) | **Sí** |
| `JWT_ADMIN_EXPIRES_IN` | Expiración de sesión admin (ej. `12h`) | Recomendada |
| `DATABASE_URL` | Postgres (Neon/Railway) con `?sslmode=require` | **Sí** |
| `REDIS_URL` | Rate limiting compartido entre instancias serverless | Recomendada |
| `CORS_ALLOWED_ORIGINS` | Orígenes permitidos además de tratoya.com | Recomendada |
| `SMTP_*` / `EMAIL_FROM` | Correos transaccionales (Brevo) | **Sí** |
| `WA_PHONE_NUMBER_ID` / `WA_ACCESS_TOKEN` / `WA_USE_TEMPLATES` | WhatsApp (template `tratoya_estado_trato` aprobado en Meta) | Para notificaciones |
| `EPAYCO_CUSTOMER_ID` / `EPAYCO_P_KEY` | Validación de firma del webhook de pagos | **Sí si cobras online** |
| `R2_*` | Almacenamiento de comprobantes/KYC en Cloudflare R2 | Para adjuntos |
| `ADMIN_CANCEL_DEAL_CODE` | Código para que admins no-superadmin cancelen tratos | Recomendada |

Ver `tratoya-backend/.env.example` para la lista completa con comentarios.

---

## 5. Cómo probar

**Login normal (usuario):** en `https://tratoya.com` → "Crear cuenta" o "Iniciar sesión"
con email/contraseña.

**Login SSO (usuario):** botón "Google" en la pantalla de login → autoriza → vuelves
logueado a la app.

**Login admin (contraseña):** entra a `https://tratoya.com/operaciones-ty-7q4m9` con un
email cuyo `rol` sea `admin`/`superadmin`.

**Login admin (SSO):** en esa misma pantalla, "Continuar con Google" con un email que
esté en `ADMIN_EMAILS` (o que ya tenga rol admin en la base de datos).

**Verificar que un usuario normal NO entra al admin:** loguéate con Google con una
cuenta cualquiera y abre `/operaciones-ty-7q4m9`; el panel muestra el login y cualquier
llamada a `/api/admin/*` responde `403`.
