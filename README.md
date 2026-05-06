# TratoYA

Beta funcional de TratoYA: plataforma de tratos seguros con custodia, pagos sandbox, chat, disputas, reputacion, KYC y panel administrativo.

## Estructura

- `tratoya-frontend/`: app React + Vite.
- `tratoya-backend/`: API Express + PostgreSQL + Sequelize.

## Desarrollo local

Backend:

```bash
cd tratoya-backend
npm install
npm run dev
```

Frontend:

```bash
cd tratoya-frontend
npm install
npm run dev -- --host 0.0.0.0
```

URLs locales:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Variables de entorno

No subir `.env` al repositorio. Usa `tratoya-backend/.env.example` como plantilla.

Para produccion se necesita:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL`
- llaves sandbox/produccion de Wompi cuando aplique

## Estado beta

El frontend puede desplegarse en Vercel, pero para que login, tratos, chat y pagos funcionen publicamente tambien debe existir un backend publico con PostgreSQL publico.
