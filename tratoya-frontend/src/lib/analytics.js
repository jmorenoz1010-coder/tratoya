/* Analytics (GA4) — se activa solo si VITE_GA_ID está definido en el
   entorno (p. ej. G-XXXXXXXXXX en las env vars de Vercel). Sin ID es
   un no-op, así que es seguro en desarrollo. */
const GA_ID = import.meta.env.VITE_GA_ID;

export function initAnalytics() {
  if (!GA_ID || window.gtag) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { anonymize_ip: true });
}

export function track(event, params = {}) {
  if (typeof window.gtag === "function") window.gtag("event", event, params);
}
