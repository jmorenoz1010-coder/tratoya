# TratoYA

Beta pública de TratoYA: plataforma colombiana de tratos seguros con custodia, pagos sandbox, chat, disputas, reputación, KYC y panel administrativo.

## URLs públicas

- Frontend: https://www.tratoya.com (`tratoya.com` redirige a `www`)
- API: https://api.tratoya.com (`GET /health` debe responder `{"status":"ok",...}`)
- Auth: https://www.tratoya.com/login y https://www.tratoya.com/register

El frontend en Vercel llama a `https://api.tratoya.com/api`. Login, tratos, chat y pagos dependen de ese backend y de PostgreSQL.

## Estructura

- `tratoya-frontend/`: app React + Vite.
- `tratoya-backend/`: API Express + PostgreSQL + Sequelize.
- `tratoya-app/`: app móvil React Native + Expo (fundación).

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

No subir `.env` al repositorio. Usa `tratoya-backend/.env.example` y `tratoya-frontend/.env.example` como plantilla. Guía de SSO: `ENV_SETUP.md`. Guía de hosting: `DEPLOYMENT.md`.

## Despliegue

Un push a `main` dispara GitHub Actions (`.github/workflows/deploy.yml`): verifica backend/frontend y despliega ambos proyectos a Vercel. `VITE_API_URL` de producción es `https://api.tratoya.com/api`.
