# Despliegue TratoYA

## GitHub

Este proyecto debe subirse desde `C:\Users\jdavo\tratoya`, no desde `C:\Users\jdavo`.

Archivos protegidos por `.gitignore`:

- `tratoya-backend/.env`
- `tratoya-backend/JWT SECRET.txt`
- `tratoya-frontend/.env`
- `node_modules/`
- `dist/`

## Vercel frontend

Proyecto recomendado:

- Root directory: `tratoya-frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=/api` si el backend queda bajo el mismo dominio/proxy.

## Backend publico

Para pruebas con amigos, el backend debe estar publico. Opciones recomendadas:

- Render o Railway para `tratoya-backend`.
- Neon, Supabase o Railway PostgreSQL para la base de datos.

Variables necesarias:

```env
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://tu-dominio.vercel.app
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
WOMPI_BASE_URL=https://sandbox.wompi.co/v1
WOMPI_PUBLIC_KEY=...
WOMPI_PRIVATE_KEY=...
WOMPI_INTEGRITY_KEY=...
WOMPI_EVENTS_SECRET=...
```

## Nota importante

Si solo se despliega el frontend en Vercel, la pagina abre, pero login, registro, tratos, chat y pagos no funcionaran hasta conectar un backend publico.
