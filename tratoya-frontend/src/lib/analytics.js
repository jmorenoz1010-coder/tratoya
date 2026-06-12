/* Analytics — se activa solo si las env vars están definidas:
   - VITE_GA_ID         (GA4, p. ej. G-XXXXXXXXXX)
   - VITE_META_PIXEL_ID (Meta Pixel, p. ej. 1234567890)
   Sin IDs es un no-op, así que es seguro en desarrollo. */
const GA_ID = import.meta.env.VITE_GA_ID;
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID;

// Eventos propios → evento estándar de Meta (mejor optimización de campañas)
const META_EVENT_MAP = {
  sign_up: "CompleteRegistration",
};

export function initAnalytics() {
  if (GA_ID && !window.gtag) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { anonymize_ip: true });
  }

  if (PIXEL_ID && !window.fbq) {
    const fbq = function fbqShim(...args) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
    window.fbq("init", PIXEL_ID);
    window.fbq("track", "PageView");
  }
}

export function track(event, params = {}) {
  if (typeof window.gtag === "function") window.gtag("event", event, params);
  if (typeof window.fbq === "function") {
    const metaEvent = META_EVENT_MAP[event];
    if (metaEvent) window.fbq("track", metaEvent, params);
    else window.fbq("trackCustom", event, params);
  }
}
