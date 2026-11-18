import { defineConfig } from 'vite';

// Dirección pública del sitio para las etiquetas Open Graph (WhatsApp exige URL absoluta).
// 1) SITE_URL si se define (p. ej. https://cayetanavillas.com)
// 2) En Vercel: dominio de producción, o la URL fija de la rama en vistas previas
function siteUrl() {
  const e = process.env;
  if (e.SITE_URL) return e.SITE_URL.replace(/\/$/, '');
  const host = e.VERCEL_ENV === 'production'
    ? e.VERCEL_PROJECT_PRODUCTION_URL || e.VERCEL_URL
    : e.VERCEL_BRANCH_URL || e.VERCEL_URL;
  return host ? `https://${host}` : 'https://cayetanavillas.com';
}

export default defineConfig({
  base: './',
  plugins: [{
    name: 'site-url',
    transformIndexHtml: { order: 'pre', handler: html => html.replaceAll('%SITE_URL%', siteUrl()) },
  }],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
