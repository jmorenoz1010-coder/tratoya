
import { useState, useEffect, useCallback, useRef } from "react";
import TratoYaAdmin from "./Admin";

/* ════════════════════════════════════════════════════
   TRATOYA · BETA — Conectado al backend real
   Todos los formularios llaman la API real.
   No hay datos ficticios (mock data).
   ════════════════════════════════════════════════════ */

const API_URL = import.meta.env.VITE_API_URL || "/api";
const SESSION_KEYS = ["ty_token","ty_refresh","ty_user"];
const sessionStore = () => window.sessionStorage;
const clearLegacySession = () => SESSION_KEYS.forEach(k => localStorage.removeItem(k));

// ── API client ────────────────────────────────────────
const api = {
  _tok: () => sessionStore().getItem("ty_token"),
  async req(method, path, body = null, isForm = false) {
    const h = {};
    const tok = this._tok();
    if (tok) h["Authorization"] = `Bearer ${tok}`;
    if (!isForm) h["Content-Type"] = "application/json";
    let r;
    try {
      r = await fetch(`${API_URL}${path}`, {
        method, headers: h,
        body: body ? (isForm ? body : JSON.stringify(body)) : null,
      });
    } catch {
      throw new Error("No se pudo conectar con el servidor de TratoYA. Intenta de nuevo en unos segundos.");
    }
    const d = await r.json().catch(() => ({ success: false, message: "Error de conexión" }));
    if (!r.ok) {
      const err = new Error(d.message || `Error ${r.status}`);
      err.status = r.status;
      if (r.status === 401 && tok) {
        clearSession();
        setTimeout(() => { window.location.href = "/"; }, 250);
      }
      throw err;
    }
    return d;
  },
  get:    (p)       => api.req("GET",  p),
  post:   (p, b)    => api.req("POST", p, b),
  put:    (p, b)    => api.req("PUT",  p, b),
  upload: (p, f)    => api.req("POST", p, f, true),
};

const saveSession = (token, refresh, user) => {
  clearLegacySession();
  sessionStore().setItem("ty_token", token);
  sessionStore().setItem("ty_refresh", refresh || "");
  sessionStore().setItem("ty_user", JSON.stringify(user));
};
const clearSession = () => {
  SESSION_KEYS.forEach(k => sessionStore().removeItem(k));
  clearLegacySession();
};
const getSavedUser = () => { try { return JSON.parse(sessionStore().getItem("ty_user") || "null"); } catch { return null; } };

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const timeAgo = (d) => { if (!d) return ""; const diff = Date.now() - new Date(d); const m = Math.floor(diff/60000); if (m < 1) return "ahora"; if (m < 60) return `hace ${m}m`; const h = Math.floor(m/60); if (h < 24) return `hace ${h}h`; return `hace ${Math.floor(h/24)}d`; };
const MONTO_MINIMO_TRATO = 5000;
const calcularCostoEpaycoUI = (totalCobrado) => {
  const iva = 1.19;
  if (totalCobrado <= 60000) return Math.ceil(2200 * iva);
  return Math.ceil((totalCobrado * 0.0264 + 690) * iva);
};
const calcularComisionUI = (monto, quien = "comprador") => {
  let comisionTratoYa = 0;
  let label = "";
  if (monto > 0 && monto <= 50000) { comisionTratoYa = 1500; label = "Incl. impuestos"; }
  else if (monto <= 500000) { comisionTratoYa = Math.round(monto * 0.055); label = "5.5%"; }
  else if (monto <= 2000000) { comisionTratoYa = Math.round(monto * 0.045); label = "4.5%"; }
  else if (monto <= 10000000) { comisionTratoYa = Math.round(monto * 0.035); label = "3.5%"; }
  else if (monto <= 50000000) { comisionTratoYa = Math.round(monto * 0.029); label = "2.9%"; }
  else { comisionTratoYa = 0; label = "Negociable"; }
  let comision = comisionTratoYa;
  let costoEpayco = 0;
  for (let i = 0; i < 8; i += 1) {
    const buyerPart = quien === "comprador" ? comision : quien === "compartida" ? Math.ceil(comision / 2) : 0;
    const nextCostoEpayco = calcularCostoEpaycoUI(monto + buyerPart);
    const nextComision = comisionTratoYa + nextCostoEpayco;
    if (nextComision === comision) { costoEpayco = nextCostoEpayco; break; }
    comision = nextComision;
    costoEpayco = nextCostoEpayco;
  }
  const comprador = quien === "comprador" ? comision : quien === "compartida" ? Math.ceil(comision / 2) : 0;
  const vendedor = quien === "vendedor" ? comision : quien === "compartida" ? Math.floor(comision / 2) : 0;
  return { comision, comisionTratoYa, costoEpayco, label, totalPagar: monto + comprador, vendedorRecibe: monto - vendedor, compradorComision: comprador, vendedorComision: vendedor };
};
const loadEpaycoCheckout = () => new Promise((resolve, reject) => {
  if (window.ePayco?.checkout) return resolve(window.ePayco);
  const existing = document.querySelector('script[data-epayco-checkout="true"]');
  if (existing) {
    existing.addEventListener("load", () => resolve(window.ePayco), { once: true });
    existing.addEventListener("error", () => reject(new Error("No se pudo cargar el checkout de ePayco")), { once: true });
    return;
  }
  const script = document.createElement("script");
  script.src = "https://checkout.epayco.co/checkout.js";
  script.async = true;
  script.dataset.epaycoCheckout = "true";
  script.onload = () => window.ePayco?.checkout ? resolve(window.ePayco) : reject(new Error("Checkout de ePayco no disponible"));
  script.onerror = () => reject(new Error("No se pudo cargar el checkout de ePayco"));
  document.body.appendChild(script);
});
const openEpaycoCheckout = async (order) => {
  const ePayco = await loadEpaycoCheckout();
  const handler = ePayco.checkout.configure({
    key: order.publicKey,
    test: order.checkoutData?.test === true || order.checkoutData?.test === "true",
  });
  handler.open(order.checkoutData);
};
const EpaycoMark = ({ compact = false }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: compact ? 4 : 7, fontWeight: 800, letterSpacing: "-.4px" }}>
    <span style={{ color: "#111", fontStyle: "italic" }}>e</span><span style={{ color: "#f15a24", fontStyle: "italic" }}>Payco</span>
  </span>
);
const COMMISSION_PAYER_LABEL = {
  comprador: "La paga el comprador",
  vendedor: "La asume el vendedor",
  compartida: "50% comprador / 50% vendedor",
};
const CommissionBreakdown = ({ monto, quien = "comprador", showMinimum = false, note = "" }) => {
  if (!monto) return null;
  const calc = calcularComisionUI(monto, quien);
  return (
    <div className="commbox">
      {showMinimum && <div className="cr"><span>Monto mínimo permitido</span><span>{fmt(MONTO_MINIMO_TRATO)}</span></div>}
      <div className="cr"><span>Monto del trato</span><span>{fmt(monto)}</span></div>
      <div className="cr"><span>Comisión TratoYa ({calc.label})</span><span>{fmt(calc.comision)}</span></div>
      <div className="cr"><span>Quién paga la comisión</span><span>{COMMISSION_PAYER_LABEL[quien] || quien}</span></div>
      <div className="cr"><span>Comisión pagada por comprador</span><span>{fmt(calc.compradorComision)}</span></div>
      <div className="cr"><span>Comisión descontada al vendedor</span><span>{fmt(calc.vendedorComision)}</span></div>
      <div className="cr tot"><span>Total que paga comprador</span><span>{fmt(calc.totalPagar)}</span></div>
      <div className="cr tot"><span>Vendedor recibe</span><span>{fmt(calc.vendedorRecibe)}</span></div>
      {note && <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--s600)", lineHeight: 1.45 }}>{note}</div>}
    </div>
  );
};
function StarRating({ value, onChange, disabled = false }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="stars" onMouseLeave={() => setHover(0)}>
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          className={`star-btn ${active >= n ? "on" : ""}`}
          onMouseEnter={() => !disabled && setHover(n)}
          onFocus={() => !disabled && setHover(n)}
          onClick={() => !disabled && onChange?.(n)}
          disabled={disabled}
          aria-label={`${n} estrellas`}
        >★</button>
      ))}
    </div>
  );
}

const ESTADO = {
  borrador:               { l: "Borrador",          c: "bg" },
  activo:                 { l: "Activo",            c: "nb" },
  pago_pendiente:         { l: "Pago pendiente",    c: "or" },
  pago_retenido:          { l: "🔒 Pago en custodia de TratoYA", c: "nb" },
  en_entrega:             { l: "📦 En entrega",     c: "or" },
  pendiente_confirmacion: { l: "Por confirmar",     c: "or" },
  confirmado:             { l: "Por liberar",       c: "gn" },
  completado:             { l: "✅ Completado",     c: "gn" },
  disputado:              { l: "⚖️ En disputa",     c: "rd" },
  cancelado:              { l: "Cancelado",         c: "bg" },
  expirado:               { l: "Expirado",          c: "bg" },
};
const TIPO_ICO = { producto:"📦", servicio:"🛠️", reserva:"📅", vehiculo:"🚗", inmueble:"🏠", otro:"📋" };

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@600;700;800&display=swap');`;

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--n:#07192F;--n2:#0D2647;--n3:#1A3A5F;--g:#A8C400;--g2:#479818;--cr:#EAF2DC;--cr2:#F2F8E6;--s50:#F4F6F8;--s100:#E5E9EE;--s200:#CBD3DD;--s400:#9AA5B3;--s600:#6B7785;--s800:#3A4452;--or:#E07B00;--orb:#FFF3E0;--re:#D9534F;--reb:#FEECEC;--sh:0 2px 8px rgba(7,25,47,.1);--page-bg:#F4F6F8}
html{scroll-behavior:smooth}body{font-family:'Inter',sans-serif;background:var(--s50);color:var(--n);-webkit-font-smoothing:antialiased;line-height:1.55;letter-spacing:0}
h1,h2,h3,h4{font-family:'Manrope',sans-serif;line-height:1.15;color:var(--n)}
@keyframes fi{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes sp{to{transform:rotate(360deg)}}
@keyframes pi{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes celebrateIn{0%{opacity:0;transform:scale(.55)}18%{opacity:1;transform:scale(1.12)}34%{transform:scale(1)}72%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.18)}}
.fi{animation:fi .35s ease both}.fi2{animation:fi .35s .08s ease both}.fi3{animation:fi .35s .16s ease both}.popi{animation:pi .3s cubic-bezier(.34,1.56,.64,1) both}
.spin{width:20px;height:20px;border:2.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:sp .7s linear infinite;display:inline-block;flex-shrink:0}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-family:'Inter',sans-serif;font-weight:600;font-size:14px;border:none;cursor:pointer;transition:all .18s;border-radius:10px;padding:0 20px;height:42px;white-space:nowrap}
.btn:active{transform:scale(.97)}.btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
.bp{background:var(--g);color:var(--n);box-shadow:0 4px 14px rgba(168,196,0,.35)}.bp:hover:not(:disabled){background:#B8D400;transform:translateY(-1px)}
.bn{background:var(--n);color:#fff}.bn:hover:not(:disabled){background:var(--n2);transform:translateY(-1px)}
.bo{background:transparent;color:var(--n);border:1.5px solid var(--s200)}.bo:hover:not(:disabled){border-color:var(--g);color:var(--g2);background:var(--cr2)}
.bg_{background:transparent;color:var(--s600);padding:0 12px}.bg_:hover:not(:disabled){background:var(--s100);color:var(--n)}
.bdd{background:var(--reb);color:var(--re)}.bdd:hover:not(:disabled){background:var(--re);color:#fff}
.blg{height:50px;font-size:15px;padding:0 28px;border-radius:12px}.bsm{height:32px;font-size:12px;padding:0 12px;border-radius:7px}

.inp{width:100%;height:44px;padding:0 14px;font-family:'Inter',sans-serif;font-size:14px;color:var(--n);background:#fff;border:1.5px solid var(--s200);border-radius:10px;outline:none;transition:border-color .18s,box-shadow .18s}
.inp:focus{border-color:var(--g);box-shadow:0 0 0 3px rgba(168,196,0,.15)}.inp::placeholder{color:var(--s400)}
textarea.inp{height:auto;padding:12px 14px;resize:vertical}select.inp{appearance:auto;cursor:pointer}
.fl{display:block;font-size:13px;font-weight:600;color:var(--s800);margin-bottom:6px}
.fg{margin-bottom:14px}.fh{font-size:11px;color:var(--s400);margin-top:3px}

.card{background:#fff;border-radius:14px;box-shadow:var(--sh);border:1px solid var(--s100)}

.bdg{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:10.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;white-space:nowrap}
.bdg.gn{background:var(--cr);color:var(--g2)}.bdg.nb{background:#E6EBF2;color:var(--n3)}.bdg.or{background:var(--orb);color:var(--or)}.bdg.rd{background:var(--reb);color:var(--re)}.bdg.bg{background:var(--s100);color:var(--s600)}

.table-wrap{overflow-x:auto;border-radius:12px;border:1px solid var(--s100)}
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{background:var(--n);color:#fff;padding:10px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:.6px;text-transform:uppercase}
thead th:first-child{border-radius:12px 0 0 0}thead th:last-child{border-radius:0 12px 0 0}
tbody td{padding:10px 14px;border-bottom:1px solid var(--s100);color:var(--s800)}
tbody tr:last-child td{border-bottom:none}tbody tr:hover td{background:var(--s50)}
.wrap-any{overflow-wrap:anywhere;word-break:break-word}
.courier-box{background:#F2F8E6;border:1.5px solid rgba(168,196,0,.45);border-radius:11px;padding:12px 14px;margin-top:13px}
.courier-box strong{display:block;font-size:13px;margin-bottom:5px;color:var(--g2)}
.chat-card{padding:13px;display:flex;flex-direction:column;height:420px}
.back-mini{width:34px!important;height:34px!important;padding:0!important;border-radius:9px!important;font-size:17px!important}

.sb{width:228px;min-height:100vh;background:var(--n);position:fixed;left:0;top:0;z-index:100;display:flex;flex-direction:column}
.sb-logo{padding:18px 16px 12px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:9px}
.sb-mk{width:32px;height:32px;background:var(--g);border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:'Manrope';font-weight:800;font-size:16px;color:var(--n);flex-shrink:0}
.sb-nav{flex:1;padding:8px 7px;overflow-y:auto}
.nav-lbl{font-size:9.5px;font-weight:700;color:rgba(255,255,255,.28);letter-spacing:1.2px;text-transform:uppercase;padding:9px 9px 4px}
.ni{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:500;color:rgba(255,255,255,.55);transition:all .15s;margin-bottom:1px;user-select:none}
.ni:hover{background:rgba(255,255,255,.07);color:#fff}.ni.act{background:rgba(168,196,0,.15);color:var(--g);font-weight:600}
.sb-usr{padding:11px 13px 14px;border-top:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:9px}

.main{margin-left:228px;min-height:100vh;background:var(--s50)}
.topbar{background:#fff;border-bottom:1px solid var(--s100);padding:0 22px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.topbar > span{color:var(--n)!important}

.page{padding:20px 22px;animation:fi .3s ease both}
.page-hd{color:var(--n)!important}
.page-sub{color:var(--s600)!important}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:18px}
.kpi{background:#fff;border-radius:13px;padding:15px 17px;border:1px solid var(--s100);transition:transform .2s,box-shadow .2s}
.kpi:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(7,25,47,.12)}

.tc{background:#fff;border-radius:12px;padding:13px 15px;border:1.5px solid var(--s100);display:flex;align-items:center;gap:13px;cursor:pointer;transition:all .18s}
.tc:hover{border-color:var(--g);box-shadow:0 4px 14px rgba(7,25,47,.1);transform:translateY(-1px)}

.commbox{background:var(--cr);border:1.5px dashed var(--g);border-radius:11px;padding:13px}
.cr{display:flex;justify-content:space-between;font-size:13px;padding:2px 0}
.cr.tot{font-weight:700;font-size:14px;padding-top:8px;border-top:1.5px solid var(--g);margin-top:6px}
.cr.tot span:last-child{color:var(--g2)}

.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}

.pt{display:flex;gap:3px;background:var(--s100);padding:3px;border-radius:9px}
.pt-i{padding:5px 13px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;color:var(--s600)}
.pt-i.act{background:#fff;color:var(--n);box-shadow:var(--sh)}

.tl-item{display:flex;gap:13px;padding-bottom:16px;position:relative}
.tl-item::before{content:'';position:absolute;left:13px;top:28px;bottom:0;width:2px;background:var(--s100)}
.tl-item:last-child::before{display:none}
.td_{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;position:relative;z-index:1}
.td-d{background:var(--g);color:var(--n)}.td-a{background:var(--n);color:var(--g);border:2px solid var(--g)}.td-p{background:#fff;border:2px solid var(--s200);color:var(--s400)}

.wz{display:flex;align-items:center;margin-bottom:22px}
.wz-c{width:27px;height:27px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;border:2px solid var(--s200);color:var(--s400);background:#fff;transition:all .2s}
.wz-c.d{background:var(--g);border-color:var(--g);color:var(--n)}.wz-c.a{background:var(--n);border-color:var(--n);color:var(--g)}
.wz-l{font-size:11.5px;font-weight:600;color:var(--s400);white-space:nowrap}.wz-l.a{color:var(--n)}
.wz-ln{flex:1;height:2px;background:var(--s100);margin:0 6px;transition:background .2s}.wz-ln.d{background:var(--g)}

.toast{position:fixed;top:18px;right:18px;z-index:9999;background:var(--n);color:#fff;padding:11px 18px;border-radius:11px;font-size:13.5px;font-weight:600;box-shadow:0 8px 28px rgba(7,25,47,.2);display:flex;align-items:center;gap:9px;animation:pi .3s ease both;max-width:340px}
.toast.success{background:var(--g2)}.toast.error{background:var(--re)}
.float-note{position:fixed;right:18px;bottom:22px;z-index:9998;background:#fff;border:1px solid var(--s100);border-left:5px solid var(--g);box-shadow:0 16px 42px rgba(7,25,47,.22);border-radius:16px;padding:13px 14px;display:flex;align-items:center;gap:12px;max-width:360px;cursor:pointer;animation:pi .28s cubic-bezier(.34,1.56,.64,1) both}
.float-note-ico{width:42px;height:42px;border-radius:50%;background:var(--cr);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.float-note-title{font-family:'Manrope';font-weight:800;font-size:13.5px;color:var(--n);margin-bottom:2px}
.float-note-body{font-size:12.5px;color:var(--s600);line-height:1.35}
.celebrate-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;pointer-events:none;background:rgba(7,25,47,.08);backdrop-filter:blur(2px)}
.celebrate-card{font-family:'Manrope';font-size:clamp(36px,8vw,82px);font-weight:900;letter-spacing:0;text-align:center;color:var(--n);text-transform:uppercase;animation:celebrateIn 2.5s cubic-bezier(.22,1,.36,1) both;text-shadow:0 14px 34px rgba(7,25,47,.22)}
.celebrate-card span{color:var(--g2)}
.celebrate-sub{font-family:'Inter';font-size:clamp(13px,2.2vw,18px);font-weight:800;color:var(--g2);margin-top:10px;text-transform:none}
.stars{display:flex;gap:5px;align-items:center}
.star-btn{border:0;background:transparent;padding:0;font-size:30px;line-height:1;cursor:pointer;color:#CBD5E1;transform:scale(1);transition:transform .14s ease,color .14s ease,text-shadow .14s ease}
.star-btn.on{color:var(--g);text-shadow:0 8px 18px rgba(168,196,0,.28)}
.star-btn:hover{transform:scale(1.18) rotate(-3deg)}
.review-card{background:#fff;border:1px solid var(--s100);border-radius:13px;padding:15px;box-shadow:var(--sh)}

.uz{border:2px dashed var(--s200);border-radius:11px;padding:22px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s}
.uz:hover{border-color:var(--g);background:var(--cr2)}

.av{border-radius:50%;background:var(--n);display:flex;align-items:center;justify-content:center;font-family:'Manrope';font-weight:800;color:var(--g);flex-shrink:0}

.empty{text-align:center;padding:48px 0;color:var(--s400)}
.empty-ico{font-size:44px;margin-bottom:10px}
.empty-t{font-weight:700;font-size:15px;color:var(--s600);margin-bottom:5px}
.empty-d{font-size:13px}
.logo-row{display:flex;align-items:center;gap:10px;min-width:0}

/* Landing */
.land{min-height:100vh;background:#fff}
.lnav{position:sticky;top:0;z-index:100;background:var(--n);backdrop-filter:blur(12px);padding:0 44px;height:66px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);box-shadow:0 1px 12px rgba(7,25,47,.12)}
.hero{background:linear-gradient(180deg,#FFFFFF 0%,#F7FAEE 100%);padding:86px 44px 74px;position:relative;overflow:hidden;border-bottom:1px solid var(--s100)}
.hero::before{content:'';position:absolute;top:-35%;right:-18%;width:58%;height:120%;background:radial-gradient(ellipse,rgba(168,196,0,.16) 0%,transparent 65%);pointer-events:none;z-index:0}
.hero > *{position:relative;z-index:1}
.hbdg{display:inline-flex;align-items:center;gap:7px;background:var(--cr);border:1px solid rgba(168,196,0,.35);padding:4px 13px;border-radius:20px;font-size:11.5px;font-weight:700;color:var(--g2);margin-bottom:18px}
.hero h1{font-size:50px;font-weight:800;color:var(--n);line-height:1.08;margin-bottom:16px;max-width:760px}
.hero h1 span{color:var(--g2)}.hero p{font-size:17px;color:var(--s600);line-height:1.6;max-width:460px;margin-bottom:30px}
.htrust{display:flex;gap:20px;margin-top:40px;flex-wrap:wrap}
.htrust-i{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--s600);font-weight:500}
.htrust-i::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--g)}
.sbar{background:var(--n);padding:36px 44px}
.sgrid{display:grid;grid-template-columns:repeat(4,1fr)}
.si{text-align:center;padding:18px;border-right:1px solid rgba(255,255,255,.07)}
.si:last-child{border-right:none}
.snum{font-family:'Manrope';font-size:36px;font-weight:800;color:var(--g);line-height:1;margin-bottom:5px}
.slbl{font-size:13px;color:rgba(255,255,255,.45)}
.sec{padding:56px 44px}
.stag{display:inline-block;background:var(--cr);color:var(--g2);font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:10px;text-transform:uppercase;margin-bottom:9px}
.sh{font-size:34px;font-weight:800;margin-bottom:7px}.sh span{color:var(--g2)}
.sgrd{display:grid;grid-template-columns:repeat(5,1fr);gap:0;margin-top:40px;position:relative}
.sgrd::before{content:'';position:absolute;top:36px;left:46px;right:46px;height:2px;background:linear-gradient(to right,var(--g),var(--n));opacity:.14}
.sti{text-align:center;padding:0 9px}.stn{width:58px;height:58px;border-radius:15px;background:var(--n);display:flex;align-items:center;justify-content:center;font-family:'Manrope';font-size:21px;font-weight:800;color:var(--g);margin:0 auto 13px;position:relative;z-index:1}

/* Auth */
.auth-pg{min-height:100vh;display:grid;grid-template-columns:1fr 1fr}
.auth-l{background:linear-gradient(135deg,var(--n) 0%,#0D2647 100%);padding:42px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.auth-l::before{content:'';position:absolute;top:-30%;right:-20%;width:70%;height:70%;background:radial-gradient(circle,rgba(168,196,0,.12) 0%,transparent 60%)}
.auth-r{padding:42px;display:flex;align-items:center;justify-content:center;background:#fff}
.auth-w{width:100%;max-width:390px}

@media (max-width:1100px){
  .kpi-grid{grid-template-columns:repeat(2,1fr)}
  .sgrd{grid-template-columns:repeat(3,1fr);gap:26px 8px}
  .sgrd::before{display:none}
  [style*="grid-template-columns: 1fr 305px"],
  [style*="grid-template-columns: 1fr 290px"]{grid-template-columns:1fr!important}
}

@media (max-width:800px){
  body{font-size:14px}
  .sb{width:100%;min-height:0;height:74px;top:auto;bottom:0;left:0;right:0;z-index:120;display:block;border-top:1px solid rgba(255,255,255,.08)}
  .sb-logo,.sb-usr,.nav-lbl{display:none}
  .sb-nav{height:74px;display:flex;align-items:center;gap:4px;padding:7px 8px;overflow-x:auto;overflow-y:hidden}
  .ni{min-width:68px;flex:1;justify-content:center;flex-direction:column;gap:3px;padding:7px 5px;margin:0;font-size:10.5px;text-align:center;border-radius:12px}
  .ni span{font-size:17px!important}
  .main{margin-left:0;padding-bottom:82px}
  .topbar{height:54px;padding:0 14px}
  .topbar > span{font-size:14px!important;max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .page{padding:16px 14px}
  .card{border-radius:12px}
  .kpi-grid,.g2,.g3,.g4,.sgrid,.auth-pg{grid-template-columns:1fr!important}
  .g4{gap:8px}
  .table-wrap{border-radius:10px;margin-left:-2px;margin-right:-2px}
  table{min-width:680px}
  .btn{width:auto;min-height:42px}
  .blg{height:46px;font-size:14px;padding:0 18px}
  .toast{left:12px;right:12px;top:12px;max-width:none}
  .float-note{left:12px;right:12px;bottom:88px;max-width:none}
  .lnav{height:auto;min-height:62px;padding:10px 14px;gap:10px;align-items:center}
  .lnav .btn{height:36px;font-size:12px;padding:0 12px}
  .hero{padding:42px 18px 46px}
  .hero h1{font-size:36px;line-height:1.1}
  .hero p{font-size:15px;max-width:none}
  .htrust{gap:9px;margin-top:28px}
  .htrust-i{font-size:11px;flex:1 1 46%}
  .sbar{padding:22px 18px}.si{border-right:none;border-bottom:1px solid rgba(255,255,255,.07);padding:15px 10px}.si:last-child{border-bottom:none}
  .snum{font-size:28px}
  .sec{padding:36px 18px}
  .sh{font-size:27px}
  .sgrd{grid-template-columns:1fr!important;gap:18px;margin-top:24px}
  .sti{display:grid;grid-template-columns:58px 30px 1fr;align-items:center;text-align:left;gap:10px;padding:0}
  .stn{margin:0}
  .auth-l{display:none}
  .auth-r{padding:28px 18px;min-height:100vh}
  .chat-card{height:360px}
  .courier-box{font-size:13px}
  .qr-card{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;margin-left:auto!important;margin-right:auto!important;width:100%!important;max-width:260px!important}
  .auth-w{max-width:430px}
  [style*="max-width: 600px"],[style*="max-width: 760px"]{max-width:none!important}
  [style*="justify-content: space-between"]{gap:10px}
}

@media (max-width:520px){
  .lnav{flex-wrap:wrap}
  .lnav > div:last-child{width:100%;justify-content:space-between}
  .lnav > div:last-child .btn{flex:1}
  .hero h1{font-size:31px}
  .page h1{font-size:19px!important}
  .page h2{font-size:18px!important}
  .kpi-grid{gap:9px}
  .kpi{padding:13px}
  .tc{align-items:flex-start;padding:12px}
  .pt{width:100%;overflow-x:auto}
  .pt-i{flex:1;text-align:center;white-space:nowrap}
  .commbox{padding:12px}
  .cr{gap:12px}
  .cr span:last-child{text-align:right}
  .topbar .user-chip span{display:none}
  .chat-card{height:330px}
  .table-wrap{overflow-x:auto}
  .footer-links{display:none}
}
`;

// ─── Toast ────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, []);
  return <div className={`toast ${type}`}>{type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"} {message}</div>;
}
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts(t => {
      const clean = t.filter(x => x.message !== message || x.type !== type);
      return [...clean.slice(-2), { id, message, type }];
    });
  }, []);
  const remove = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);
  return { toasts, show, remove };
}

let notificationAudioCtx = null;
const getNotificationAudioContext = () => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!notificationAudioCtx || notificationAudioCtx.state === "closed") notificationAudioCtx = new Ctx();
  return notificationAudioCtx;
};
function unlockNotificationSound() {
  try {
    const ctx = getNotificationAudioContext();
    if (!ctx) return;
    const ready = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    ready.then(() => {
      if (ctx.state !== "running") return;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.00001, ctx.currentTime);
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(1, ctx.currentTime);
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.02);
    }).catch(() => {});
  } catch { /* sound is optional */ }
}
function notifyDeviceFeedback(kind = "bubble") {
  try {
    if (navigator.vibrate) navigator.vibrate(kind === "celebration" ? [45, 28, 45] : [35]);
  } catch { /* vibration is optional */ }
}
function playBubbleSound() {
  try {
    const ctx = getNotificationAudioContext();
    if (!ctx) return;
    const ready = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    ready.then(() => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime + 0.02;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      gain.connect(ctx.destination);
      [660, 880, 1180].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.075);
        osc.connect(gain);
        osc.start(now + i * 0.075);
        osc.stop(now + i * 0.075 + 0.16);
      });
    }).catch(() => {});
  } catch { /* sound is optional */ }
}
function playCelebrationSound() {
  try {
    const ctx = getNotificationAudioContext();
    if (!ctx) return;
    const ready = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    ready.then(() => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime + 0.02;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.12, now + 0.018);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
      master.connect(ctx.destination);
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 3 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.095);
        osc.connect(master);
        osc.start(now + i * 0.095);
        osc.stop(now + i * 0.095 + 0.22);
      });
    }).catch(() => {});
  } catch { /* sound is optional */ }
}

function FloatingNotification({ note, onOpen, onClose }) {
  if (!note) return null;
  return (
    <div className="float-note" onClick={onOpen}>
      <div className="float-note-ico">{note.icon || "💬"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="float-note-title">{note.titulo || "Nueva actividad"}</div>
        <div className="float-note-body">{note.cuerpo || "Toca para abrir el trato relacionado."}</div>
      </div>
      <button className="btn bg_ bsm" onClick={(e) => { e.stopPropagation(); onClose?.(); }}>×</button>
    </div>
  );
}
function CelebrationOverlay({ show }) {
  if (!show) return null;
  return (
    <div className="celebrate-overlay">
      <div className="celebrate-card">Trato <span>completado</span><div className="celebrate-sub">Pago liberado con éxito</div></div>
    </div>
  );
}

function isSupportNotification(evt) {
  const tipo = String(evt?.tipo || "");
  const metadata = evt?.datos?.metadata || {};
  return ["admin", "admin_masiva", "admin_trato", "soporte", "mensaje_soporte"].includes(tipo)
    || metadata.from_admin === true
    || metadata.sender_label === "Soporte - TratoYA";
}

// ─── Avatar ───────────────────────────────────────────
function Av({ name = "", size = 34 }) {
  const ini = (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return <div className="av" style={{ width: size, height: size, fontSize: size * 0.38 }}>{ini}</div>;
}

// ─── Sidebar ──────────────────────────────────────────
function Sidebar({ page, setPage, user, onLogout }) {
  const nav = [
    ["dashboard","🏠","Dashboard"],["tratos","📋","Mis Tratos"],["crear","➕","Crear trato"],
    ["pagos","💳","Pagos"],["disputas","⚖️","Disputas"],["reputacion","⭐","Reputación"],
  ];
  const bot = [["perfil","👤","Perfil"]];
  const nom = user ? `${user.nombre} ${user.apellido}` : "";
  return (
    <aside className="sb">
      <div className="sb-logo">
        <div className="sb-mk">T</div>
        <span style={{ fontFamily: "Manrope", fontSize: 18, fontWeight: 800, color: "#fff" }}>Trato<span style={{ color: "var(--g)" }}>Ya</span></span>
        <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, color: "var(--g)", background: "rgba(168,196,0,.15)", padding: "2px 6px", borderRadius: 6 }}>BETA</span>
      </div>
      <nav className="sb-nav">
        <div className="nav-lbl">Principal</div>
        {nav.map(([id, ic, l]) => <div key={id} className={`ni ${page === id ? "act" : ""}`} onClick={() => setPage(id)}><span style={{ fontSize: 15 }}>{ic}</span> {l}</div>)}
        <div className="nav-lbl" style={{ marginTop: 8 }}>Perfil</div>
        {bot.map(([id, ic, l]) => <div key={id} className={`ni ${page === id ? "act" : ""}`} onClick={() => setPage(id)}><span style={{ fontSize: 15 }}>{ic}</span> {l}</div>)}
        <div className="ni" onClick={onLogout} style={{ marginTop: 6 }}><span style={{ fontSize: 15 }}>🚪</span> Cerrar sesión</div>
      </nav>
      <div className="sb-usr">
        <Av name={nom} />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nom || "Usuario"}</div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.35)" }}>{user?.kyc_nivel !== "ninguno" ? "✓ Verificado" : "⚠ Sin verificar"}</div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ title, user, page, setPage }) {
  const nom = `${user?.nombre || ""} ${user?.apellido || ""}`.trim();
  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        {page !== "dashboard" && <button className="btn bg_ back-mini" onClick={() => setPage("dashboard")} title="Volver">←</button>}
        <span style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
      </div>
      <div className="user-chip" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 11px", background: "var(--s50)", borderRadius: 9, border: "1px solid var(--s100)" }}>
        <Av name={nom} size={26} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{user?.nombre || "—"}</span>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────
function Dashboard({ setPage, setTratoId, user, toast, setUser }) {
  const [tratos, setTratos] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState(user);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [t, n, me] = await Promise.all([
        api.get("/tratos?limit=6"),
        api.get("/users/notifications"),
        api.get("/auth/me"),
      ]);
      setTratos(t.data || []);
      setNotifs((n.data || []).slice(0, 5));
      if (me.data) { setUserStats(me.data); setUser?.(me.data); }
    } catch (e) {
      if (!silent) toast(e?.message || "Error cargando dashboard", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const t = setInterval(() => loadDashboard(true), 5000);
    return () => clearInterval(t);
  }, [loadDashboard]);

  const activos = tratos.filter(t => !["completado","cancelado","expirado"].includes(t.estado));
  const protegido = activos.filter(t => t.estado === "pago_retenido").reduce((s, t) => s + parseFloat(t.monto || 0), 0);
  const completados = tratos.filter(t => t.estado === "completado").length || userStats?.tratos_exitosos || 0;

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 2 }}>Hola, {userStats?.nombre || user?.nombre} 👋</h1>
          <p className="page-sub" style={{ fontSize: 13 }}>Resumen de tu cuenta · actualiza cada 5s</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn bo bsm" onClick={() => loadDashboard()} title="Actualizar">↻</button>
          <button className="btn bp blg" onClick={() => setPage("crear")}>➕ Nuevo trato</button>
        </div>
      </div>

      <div className="kpi-grid fi">
        {[
          { ico: "📋", bg: "#E6EBF2", l: "Tratos activos",  v: loading ? "—" : activos.length },
          { ico: "🔒", bg: "var(--cr)", l: "Dinero protegido", v: loading ? "—" : fmt(protegido) },
          { ico: "✅", bg: "var(--cr)", l: "Completados",    v: loading ? "—" : completados },
          { ico: "⭐", bg: "var(--cr)", l: "Reputación",     v: loading ? "—" : parseFloat(userStats?.reputacion || 0).toFixed(1) || "—" },
        ].map((k, i) => (
          <div key={i} className="kpi">
            <div style={{ width: 32, height: 32, borderRadius: 9, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, marginBottom: 8 }}>{k.ico}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--s400)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5, fontSize: 10 }}>{k.l}</div>
            <div style={{ fontFamily: "Manrope", fontSize: 22, fontWeight: 800, lineHeight: 1.1, marginBottom: 3 }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: 14 }}>
        <div className="fi2">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
            <h2 style={{ fontSize: 15 }}>Tratos activos</h2>
            <button className="btn bg_ bsm" onClick={() => setPage("tratos")}>Ver todos →</button>
          </div>
          {loading
            ? <div style={{ textAlign: "center", padding: 40 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></div>
            : activos.length === 0
              ? <div className="card" style={{ padding: 32 }}><div className="empty"><div className="empty-ico">🤝</div><div className="empty-t">Sin tratos activos</div><div className="empty-d">Crea tu primer trato seguro</div><button className="btn bp" style={{ marginTop: 14 }} onClick={() => setPage("crear")}>Crear trato</button></div></div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {activos.map(t => {
                  const ec = ESTADO[t.estado] || ESTADO.borrador;
                  const cp = t.vendedor?.id === user?.id ? t.comprador : t.vendedor;
                  return (
                    <div key={t.id} className="tc" onClick={() => { setTratoId(t.id); setPage("detalle"); }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--cr)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{TIPO_ICO[t.tipo] || "📋"}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>{t.titulo}</div>
                        <div style={{ fontSize: 12, color: "var(--s600)" }}>{cp ? `${cp.nombre} ${cp.apellido}` : "Esperando contraparte"}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 13.5, marginBottom: 3 }}>{fmt(t.monto)}</div>
                        <span className={`bdg ${ec.c}`}>{ec.l}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        <div className="fi3">
          <h2 style={{ fontSize: 15, marginBottom: 11 }}>Actividad reciente</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifs.length === 0 && !loading && <div className="card" style={{ padding: 18, textAlign: "center", color: "var(--s400)", fontSize: 13 }}>Sin movimientos recientes</div>}
            {notifs.map((n, i) => (
              <div key={i} style={{ background: n.leida ? "#fff" : "var(--cr2)", border: "1px solid var(--s100)", borderRadius: 11, padding: "10px 13px" }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 1 }}>{n.titulo}</div>
                <div style={{ fontSize: 12, color: "var(--s600)", marginBottom: 2 }}>{n.cuerpo}</div>
                <div style={{ fontSize: 10.5, color: "var(--s400)" }}>{timeAgo(n.createdAt)}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, background: "var(--n)", borderRadius: 12, padding: 14, cursor: "pointer", transition: "transform .2s" }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            onClick={() => setPage("crear")}>
            <div style={{ fontSize: 18, marginBottom: 5 }}>⚡</div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 13.5, color: "#fff", marginBottom: 3 }}>Trato rápido</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.4)", marginBottom: 10 }}>Comparte el link con tu contraparte</div>
            <div style={{ background: "var(--g)", color: "var(--n)", borderRadius: 7, padding: "6px 13px", fontSize: 12, fontWeight: 700, display: "inline-flex", gap: 5 }}>➕ Crear</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mis Tratos ───────────────────────────────────────
function MisTratos({ setPage, setTratoId, user, toast }) {
  const [tratos, setTratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");
  const [qrModal, setQrModal] = useState(null);
  const load = () => { setLoading(true); api.get("/tratos?limit=50").then(r => setTratos(r.data || [])).catch(e => toast(e.message, "error")).finally(() => setLoading(false)); };
  useEffect(load, []);
  const filtered = tratos.filter(t => {
    if (filter === "activos" && ["completado","cancelado","expirado"].includes(t.estado)) return false;
    if (filter === "completados" && t.estado !== "completado") return false;
    if (q) { const s = q.toLowerCase(); return t.titulo.toLowerCase().includes(s) || (t.codigo || "").toLowerCase().includes(s); }
    return true;
  });
  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="page-hd" style={{ fontSize: 21 }}>Mis Tratos</h1>
        <div style={{ display: "flex", gap: 7 }}>
          <button className="btn bg_ bsm" onClick={load}>↻</button>
          <button className="btn bp" onClick={() => setPage("crear")}>➕ Nuevo</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="pt">{[["todos","Todos"],["activos","Activos"],["completados","Completados"]].map(([id, l]) => <div key={id} className={`pt-i ${filter === id ? "act" : ""}`} onClick={() => setFilter(id)}>{l}</div>)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: "1.5px solid var(--s200)", borderRadius: 9, padding: "0 11px", height: 36, flex: "1 1 160px", maxWidth: 240 }}>
          🔍 <input placeholder="Buscar..." style={{ border: "none", outline: "none", fontSize: 13, fontFamily: "Inter", background: "transparent", width: "100%" }} value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>
      {loading
        ? <div style={{ textAlign: "center", padding: 48 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></div>
        : filtered.length === 0
          ? <div className="empty"><div className="empty-ico">📋</div><div className="empty-t">Sin tratos</div><div className="empty-d">Crea tu primer trato</div></div>
          : <div className="table-wrap">
            {qrModal && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(6,15,30,.8)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setQrModal(null)}>
                <div style={{ background: "#fff", borderRadius: 16, padding: 24, textAlign: "center", maxWidth: 280, width: "92vw", display: "flex", flexDirection: "column", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 14, color: "var(--g2)", marginBottom: 4 }}>{qrModal.codigo}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{qrModal.titulo}</div>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrModal.link)}&format=png&bgcolor=ffffff&color=07192F&qzone=2`} alt="QR" style={{ width: 200, height: 200, borderRadius: 8 }} />
                  <div style={{ fontSize: 11, color: "var(--s400)", marginTop: 8, marginBottom: 12 }}>⏱ Válido 12h desde la creación</div>
                  <button className="btn bp bsm" onClick={() => {
                    const wa = `https://wa.me/?text=🔒 Trato TratoYa: *${qrModal.titulo}*%0ALink: ${encodeURIComponent(qrModal.link)}`;
                    window.open(wa, "_blank");
                  }}>📲 Compartir por WhatsApp</button>
                  <button className="btn bo bsm" style={{ marginLeft: 8 }} onClick={() => setQrModal(null)}>Cerrar</button>
                </div>
              </div>
            )}
            <table>
              <thead><tr><th>Código</th><th>Descripción</th><th>Contraparte</th><th>Monto</th><th>Estado</th><th>QR</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {filtered.map(t => {
                  const ec = ESTADO[t.estado] || ESTADO.borrador;
                  const cp = t.vendedor?.id === user?.id ? t.comprador : t.vendedor;
                  const link = `${window.location.origin}/t/${t.link_compartir}`;
                  return (
                    <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => { setTratoId(t.id); setPage("detalle"); }}>
                      <td><span style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 11, color: "var(--g2)" }}>{t.codigo}</span></td>
                      <td><div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontSize: 17 }}>{TIPO_ICO[t.tipo]||"📋"}</span><div><div style={{ fontWeight: 600 }}>{t.titulo}</div><div style={{ fontSize: 10.5, color: "var(--s400)" }}>{t.tipo}</div></div></div></td>
                      <td>{cp ? `${cp.nombre} ${cp.apellido}` : <span style={{ color: "var(--s400)", fontStyle: "italic" }}>Sin contraparte</span>}</td>
                      <td style={{ fontFamily: "Manrope", fontWeight: 700 }}>{fmt(t.monto)}</td>
                      <td><span className={`bdg ${ec.c}`}>{ec.l}</span></td>
                      <td><button className="btn bo bsm" style={{ fontSize: 11 }} onClick={e => { e.stopPropagation(); setQrModal({ codigo: t.codigo, titulo: t.titulo, link }); }}>📱 QR</button></td>
                      <td style={{ fontSize: 11.5, color: "var(--s400)" }}>{fmtDate(t.createdAt)}</td>
                      <td><button className="btn bo bsm" onClick={e => { e.stopPropagation(); setTratoId(t.id); setPage("detalle"); }}>Ver</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
      }
    </div>
  );
}

// ─── Crear Trato ──────────────────────────────────────
function CrearTrato({ setPage, toast, user }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [f, setF_] = useState({ tipo: "producto", titulo: "", descripcion: "", monto: "", dias: "7", quien: "comprador", notas: "" });
  const sf = (k, v) => setF_(p => ({ ...p, [k]: v }));
  const monto = parseInt((f.monto || "").replace(/\D/g, "")) || 0;

  const create = async () => {
    setLoading(true);
    try {
      const res = await api.post("/tratos", { titulo: f.titulo, descripcion: f.descripcion, tipo: f.tipo, monto, dias_inspeccion: parseInt(f.dias), quien_paga_comision: f.quien, notas: f.notas });
      setDone(res.data); toast("¡Trato creado!", "success");
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  const [showQr, setShowQr] = useState(false);
  const qrUrl = done ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(done.link_publico || `${window.location.origin}/t/${done.link_compartir}`)}&format=png&bgcolor=ffffff&color=07192F&qzone=2` : null;

  if (done) return (
    <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 480 }}>
      <div className="popi" style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ width: 68, height: 68, borderRadius: "50%", background: "var(--cr)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 30 }}>✅</div>
        <h2 style={{ fontSize: 24, marginBottom: 7 }}>¡Trato creado!</h2>
        <p style={{ color: "var(--s600)", marginBottom: 16, lineHeight: 1.6, fontSize: 14 }}>Comparte el link o el código QR con tu contraparte.</p>
        <div style={{ background: "var(--n)", color: "var(--g)", borderRadius: 9, padding: "9px 15px", fontFamily: "Manrope", fontWeight: 800, fontSize: 17, marginBottom: 12 }}>{done.codigo}</div>
        <div style={{ background: "var(--s50)", borderRadius: 9, padding: "9px 13px", display: "flex", alignItems: "center", gap: 8, marginBottom: 14, border: "1.5px dashed var(--s200)" }}>
          <span style={{ fontSize: 11.5, color: "var(--s600)", flex: 1, wordBreak: "break-all", fontFamily: "monospace" }}>{done.link_publico}</span>
          <button className="btn bo bsm" onClick={() => { navigator.clipboard.writeText(done.link_publico); toast("Link copiado ✓", "success"); }}>Copiar</button>
        </div>
        {/* QR Code */}
        <div className="qr-card" style={{ background: "#fff", borderRadius: 14, padding: 16, margin: "0 auto 14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh)", border: "1px solid var(--s100)" }}>
          {qrUrl && <img src={qrUrl} alt="QR Trato" style={{ width: 180, height: 180, display: "block" }} />}
          <div style={{ fontSize: 10.5, color: "var(--s400)", marginTop: 6 }}>⏱ Válido 12 h · Expira al aceptarse</div>
        </div>
        <div style={{ display: "flex", gap: 9, marginBottom: 9 }}>
          <button className="btn bp" style={{ flex: 1 }} onClick={() => {
            const waMsj = `Hola, te comparto el link de nuestro trato seguro en TratoYa:%0A%0A🔒 *${done.titulo || done.codigo}*%0A💰 Monto: ${done.monto_fmt || ""}%0A%0A👉 ${encodeURIComponent(done.link_publico || `${window.location.origin}/t/${done.link_compartir}`)}`;
            window.open(`https://wa.me/?text=${waMsj}`, "_blank");
          }}>📲 Compartir por WhatsApp</button>
          <button className="btn bo" onClick={() => { navigator.clipboard.writeText(done.link_publico); toast("Link copiado ✓", "success"); }}>🔗 Copiar</button>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button className="btn bp" style={{ flex: 1 }} onClick={() => setPage("tratos")}>Ver tratos</button>
          <button className="btn bo" onClick={() => { setDone(null); setStep(1); setF_({ tipo: "producto", titulo: "", descripcion: "", monto: "", dias: "7", quien: "comprador", notas: "" }); }}>Crear otro</button>
        </div>
      </div>
    </div>
  );

  const tipos = [["producto","📦","Producto"],["servicio","🛠️","Servicio"],["reserva","📅","Reserva"],["vehiculo","🚗","Vehículo"]];

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
        <button className="btn bg_ bsm" onClick={() => setPage("dashboard")}>✕ Cancelar</button>
        <div style={{ flex: 1 }} />
        <div className="wz">
          {["Detalles","Condiciones","Confirmar"].map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className={`wz-c ${step > i+1 ? "d" : step === i+1 ? "a" : ""}`}>{step > i+1 ? "✓" : i+1}</div>
                <span className={`wz-l ${step === i+1 ? "a" : ""}`}>{l}</span>
              </div>
              {i < 2 && <div className={`wz-ln ${step > i+1 ? "d" : ""}`} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {step === 1 && (
          <div className="fi">
            <h2 style={{ fontSize: 21, marginBottom: 16 }}>¿Qué estás negociando?</h2>
            <div className="fg">
              <label className="fl">Tipo de trato</label>
              <div className="g4" style={{ gap: 8 }}>
                {tipos.map(([id, ic, l]) => (
                  <div key={id} onClick={() => sf("tipo", id)} style={{ border: `2px solid ${f.tipo === id ? "var(--g)" : "var(--s100)"}`, background: f.tipo === id ? "var(--cr)" : "#fff", borderRadius: 10, padding: "11px 7px", textAlign: "center", cursor: "pointer", transition: "all .15s" }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{ic}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: f.tipo === id ? "var(--g2)" : "var(--s600)" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="fg"><label className="fl">Título *</label><input className="inp" placeholder="Ej: iPhone 13 Pro Max 256GB azul" value={f.titulo} onChange={e => sf("titulo", e.target.value)} /></div>
            <div className="fg"><label className="fl">Descripción detallada</label><textarea className="inp" rows="3" placeholder="Describe el producto o servicio con detalle..." value={f.descripcion} onChange={e => sf("descripcion", e.target.value)} /></div>
            <div className="fg">
              <label className="fl">Monto en COP *</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--s400)", fontSize: 14 }}>$</span>
                <input className="inp" style={{ paddingLeft: 26 }} placeholder="0" value={f.monto} onChange={e => sf("monto", e.target.value.replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,"."))} />
              </div>
            </div>
            {monto > 0 && (
              <CommissionBreakdown
                monto={monto}
                quien={f.quien}
                showMinimum
                note="Este resumen cambia en el siguiente paso según quién asuma la comisión."
              />
            )}
            <button className="btn bp blg" style={{ width: "100%", marginTop: 16 }} onClick={() => setStep(2)} disabled={!f.titulo || monto < MONTO_MINIMO_TRATO || monto > 50000000}>Continuar →</button>
            {monto > 0 && monto < MONTO_MINIMO_TRATO && <div className="fh" style={{ color: "var(--re)", marginTop: 8 }}>El monto mínimo del trato es {fmt(MONTO_MINIMO_TRATO)}.</div>}
            {monto > 50000000 && <div className="fh" style={{ color: "var(--re)", marginTop: 8 }}>Para tratos superiores a $50.000.000 la comisión es negociable. Contacta soporte.</div>}
          </div>
        )}

        {step === 2 && (
          <div className="fi">
            <h2 style={{ fontSize: 21, marginBottom: 16 }}>Condiciones</h2>
            <div className="fg">
              <label className="fl">Días de inspección para el comprador</label>
              <select className="inp" value={f.dias} onChange={e => sf("dias", e.target.value)}>
                <option value="1">1 día</option><option value="3">3 días</option><option value="7">7 días (recomendado)</option><option value="14">14 días</option>
              </select>
              <div className="fh">El comprador tiene este tiempo para verificar y confirmar</div>
            </div>
            <div className="fg">
              <label className="fl">¿Quién paga la comisión?</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["comprador","La paga el comprador"],["vendedor","La paga el vendedor"],["compartida","50% cada uno"]].map(([v, l]) => (
                  <div key={v} onClick={() => sf("quien", v)} style={{ flex: "1 1 auto", border: `2px solid ${f.quien === v ? "var(--g)" : "var(--s100)"}`, background: f.quien === v ? "var(--cr)" : "#fff", borderRadius: 9, padding: "9px 11px", cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "center", color: f.quien === v ? "var(--g2)" : "var(--s600)", transition: "all .15s", minWidth: 110 }}>{l}</div>
                ))}
              </div>
            </div>
            <CommissionBreakdown
              monto={monto}
              quien={f.quien}
              note="El valor que verá ePayco es el total que paga el comprador. La comisión de TratoYa queda incluida en este cálculo."
            />
            <div className="fg"><label className="fl">Notas adicionales</label><textarea className="inp" rows="2" placeholder="Condiciones especiales, punto de entrega, etc." value={f.notas} onChange={e => sf("notas", e.target.value)} /></div>
            <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
              <button className="btn bo blg" onClick={() => setStep(1)}>← Atrás</button>
              <button className="btn bp blg" style={{ flex: 1 }} onClick={() => setStep(3)}>Revisar →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="fi">
            <h2 style={{ fontSize: 21, marginBottom: 16 }}>Confirmar trato</h2>
            <div className="card" style={{ padding: "17px 19px", marginBottom: 12 }}>
              <div className="g2" style={{ gap: 12 }}>
                {[["Tipo", tipos.find(([id]) => id === f.tipo)?.[2]],["Título", f.titulo],["Monto", fmt(monto)],["Días inspección", `${f.dias} días`],["Comisión la paga", f.quien]].map(([k, v]) => (
                  <div key={k}><div style={{ fontSize: 10, fontWeight: 600, color: "var(--s400)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 2 }}>{k}</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</div></div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <CommissionBreakdown monto={monto} quien={f.quien} />
            </div>
            <div style={{ background: "var(--cr)", borderRadius: 9, padding: "10px 13px", display: "flex", gap: 8, marginBottom: 16, fontSize: 13, color: "var(--s600)", lineHeight: 1.5 }}>
              ℹ️ Al crear este trato aceptas los <span style={{ color: "var(--g2)", fontWeight: 600, margin: "0 3px" }}>Términos y Condiciones</span>. El dinero solo se moverá cuando ambas partes confirmen.
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button className="btn bo blg" onClick={() => setStep(2)}>← Atrás</button>
              <button className="btn bp blg" style={{ flex: 1 }} onClick={create} disabled={loading}>
                {loading ? <><div className="spin" /> Creando...</> : "🔒 Crear trato seguro"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detalle del trato ────────────────────────────────
function ReviewBox({ tratoId, reviews, user, toast, onSaved }) {
  const mine = reviews.find(r => r.autor_id === user?.id);
  const [rating, setRating] = useState(mine?.calificacion || 0);
  const [comment, setComment] = useState(mine?.comentario || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setRating(mine?.calificacion || 0);
    setComment(mine?.comentario || "");
  }, [mine?.id]);
  const submit = async () => {
    if (!rating) return toast("Selecciona una valoración de 1 a 5 estrellas", "error");
    setBusy(true);
    try {
      await api.post(`/reviews/deal/${tratoId}`, { calificacion: rating, comentario: comment });
      toast(mine ? "Reseña actualizada" : "Reseña publicada", "success");
      onSaved?.();
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  return (
    <div className="review-card fi">
      <h3 style={{ fontSize: 15, marginBottom: 6 }}>Deja tu reseña</h3>
      <p style={{ fontSize: 12.5, color: "var(--s600)", marginBottom: 10 }}>Valora a tu contraparte y cuéntanos cómo fue el trato.</p>
      <StarRating value={rating} onChange={setRating} disabled={busy} />
      <textarea className="inp" rows="3" style={{ marginTop: 10 }} placeholder="Escribe un comentario corto sobre tu experiencia..." value={comment} onChange={e => setComment(e.target.value)} maxLength={1000} />
      <button className="btn bp" style={{ width: "100%", marginTop: 10 }} onClick={submit} disabled={busy || !rating}>{busy ? <div className="spin" /> : mine ? "Actualizar reseña" : "Publicar reseña"}</button>
      {reviews.length > 0 && (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {reviews.map(r => (
            <div key={r.id} style={{ background: "var(--s50)", borderRadius: 9, padding: "9px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <strong style={{ fontSize: 12.5 }}>{r.autor?.nombre || (r.autor_id === user?.id ? "Tu reseña" : "Usuario")}</strong>
                <span style={{ color: "var(--g2)", fontWeight: 800, fontSize: 12 }}>{r.calificacion}★</span>
              </div>
              {r.comentario && <div style={{ fontSize: 12, color: "var(--s600)", marginTop: 4, lineHeight: 1.45 }}>{r.comentario}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TratoDetalle({ tratoId, setPage, setDisputeTratoId, user, toast, onStatusUpdate }) {
  const [trato, setTrato] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [guia, setGuia] = useState({ guia: "", transportadora: "", medio_envio: "servientrega", numero_contacto: "", punto_encuentro: "" });
  const [pruebaFotos, setPruebaFotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const previousEstadoRef = useRef(null);

  const load = async (silent = false) => {
    try {
      const [t, m, rv] = await Promise.all([
        api.get(`/tratos/${tratoId}`),
        api.get(`/messages/${tratoId}`).catch(() => ({ data: [] })),
        api.get(`/reviews/deal/${tratoId}`).catch(() => ({ data: [] })),
      ]);
      const nextTrato = t.data;
      if (silent && previousEstadoRef.current && previousEstadoRef.current !== nextTrato.estado) {
        onStatusUpdate?.(nextTrato, previousEstadoRef.current, nextTrato.estado);
      }
      previousEstadoRef.current = nextTrato.estado;
      setTrato(nextTrato); setMsgs(m.data || []); setReviews(rv.data || []);
    } catch (e) { if (!silent) toast(e.message, "error"); }
    if (!silent) setLoading(false);
  };
  useEffect(() => {
    previousEstadoRef.current = null;
    load();
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [tratoId]);

  const sendMsg = async () => {
    if (!msg.trim()) return;
    try { await api.post(`/messages/${tratoId}`, { contenido: msg }); setMsg(""); load(); }
    catch (e) { toast(e.message, "error"); }
  };

  const action = async (fn, successMsg) => {
    setBusy(true);
    try { await fn(); toast(successMsg, "success"); load(); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const pagarEpayco = async () => {
    const pago = calcularComisionUI(parseFloat(trato?.monto || 0), trato?.quien_paga_comision || "comprador");
    if (!window.confirm(`Vas a pagar ${fmt(pago.totalPagar)} COP por este acuerdo en TratoYa. Este pago se procesará por ePayco.`)) return;
    setBusy(true);
    try {
      const r = await api.post(`/payments/epayco/create`, { dealId: tratoId });
      const order = r.data || r;
      if (!order?.publicKey || !order?.checkoutData) throw new Error("No se pudo generar el checkout de ePayco");
      setPaymentOrder(order);
      await openEpaycoCheckout(order);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const simularPago = async () => {
    setBusy(true);
    try {
      await api.post(`/payments/sandbox-approve/${tratoId}`, { metodo_pago: "pse" });
      toast("Pago beta aprobado. El dinero quedó en custodia de TratoYA.", "success");
      setTimeout(() => { window.location.href = "/"; }, 900);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const abrirDisputa = () => {
    setDisputeTratoId?.(tratoId);
    setPage("disputas");
  };

  if (loading) return <div className="page" style={{ textAlign: "center", padding: 60 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></div>;
  if (!trato) return <div className="page"><p>Trato no encontrado</p></div>;

  const ec = ESTADO[trato.estado] || ESTADO.borrador;
  const esV = trato.vendedor?.id === user?.id;
  const esC = trato.comprador?.id === user?.id;
  const cp = esV ? trato.comprador : trato.vendedor;
  const montoTrato = parseFloat(trato.monto || 0);
  const quienComision = trato.quien_paga_comision || "comprador";
  const commissionCalc = calcularComisionUI(montoTrato, quienComision);
  const neto = commissionCalc.vendedorRecibe;
  const entrega = trato.metadata?.datos_entrega || {};
  const medioEnvio = entrega.medio_envio || trato.metadata?.medio_envio;
  const telefonoDomiciliario = entrega.numero_contacto || trato.metadata?.numero_contacto_domiciliario || trato.metadata?.telefono_domiciliario;
  const puntoEncuentro = entrega.punto_encuentro || trato.metadata?.punto_encuentro;
  const steps = [
    { l: "Trato creado", s: "Condiciones aceptadas", done: true },
    { l: "Pago en custodia de TratoYA", s: `${fmt(montoTrato)} protegido`, done: ["pago_retenido","en_entrega","confirmado","completado"].includes(trato.estado), active: trato.estado === "pago_retenido" },
    { l: "Enviado", s: trato.guia_envio ? (medioEnvio === "en_persona" || trato.transportadora === "En persona" ? `📍 ${puntoEncuentro || "En persona"}` : medioEnvio === "domiciliario" || trato.transportadora === "Domiciliario" ? `🛵 Domiciliario · ${telefonoDomiciliario || "contacto pendiente"}` : `Guía ${trato.guia_envio} · ${trato.transportadora}`) : "Pendiente de registrar envío", done: ["en_entrega","confirmado","completado"].includes(trato.estado), active: trato.estado === "en_entrega" },
    { l: "Confirmación", s: "Comprador verifica", done: ["confirmado","completado"].includes(trato.estado), active: trato.estado === "confirmado" },
    { l: "Pago liberado", s: `${fmt(neto)} al vendedor`, done: trato.estado === "completado" },
  ];

  return (
    <div className="page fi">
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
        <button className="btn bg_ bsm" onClick={() => setPage("tratos")}>← Volver</button>
        <div style={{ height: 14, width: 1, background: "var(--s200)" }} />
        <span style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 12.5, color: "var(--g2)" }}>{trato.codigo}</span>
        <span className={`bdg ${ec.c}`}>{ec.l}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 305px", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {/* Info */}
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", gap: 13, marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--cr)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{TIPO_ICO[trato.tipo]||"📋"}</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 17, marginBottom: 2 }}>{trato.titulo}</h2>
                <div style={{ fontSize: 13, color: "var(--s600)" }}>
                  {cp ? `${esV ? "Comprador" : "Vendedor"}: ${cp.nombre} ${cp.apellido}` : <span style={{ color: "var(--or)" }}>⚠ Esperando que alguien acepte el trato</span>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Manrope", fontSize: 22, fontWeight: 800 }}>{fmt(montoTrato)}</div>
                <div style={{ fontSize: 11.5, color: "var(--s400)" }}>{fmtDate(trato.createdAt)}</div>
              </div>
            </div>
            {trato.descripcion && <p style={{ fontSize: 13, color: "var(--s600)", lineHeight: 1.55, marginBottom: 13 }}>{trato.descripcion}</p>}
            <CommissionBreakdown
              monto={montoTrato}
              quien={quienComision}
              note="El checkout de ePayco cobra exactamente el total indicado para el comprador."
            />
          </div>

          {/* Timeline + acciones */}
          <div className="card" style={{ padding: "18px 20px" }}>
            <h3 style={{ fontSize: 14, marginBottom: 14 }}>Progreso del trato</h3>
            <div className="timeline">
              {steps.map((s, i) => (
                <div key={i} className="tl-item">
                  <div className={`td_ ${s.done ? "td-d" : s.active ? "td-a" : "td-p"}`}>{s.done ? "✓" : i+1}</div>
                  <div style={{ flex: 1, paddingTop: 3 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: s.done || s.active ? "var(--n)" : "var(--s400)", marginBottom: 2 }}>{s.l}</div>
                    <div style={{ fontSize: 12, color: s.active ? "var(--g2)" : "var(--s600)" }}>{s.s}</div>
                  </div>
                </div>
              ))}
            </div>

            {trato.estado === "completado" && (
              <div style={{ marginTop: 14 }}>
                <ReviewBox tratoId={tratoId} reviews={reviews} user={user} toast={toast} onSaved={() => load(true)} />
              </div>
            )}

            {esC && medioEnvio === "domiciliario" && telefonoDomiciliario && (
              <div className="courier-box">
                <strong>🛵 Datos del domiciliario</strong>
                <div>Contacto: <a href={`tel:${telefonoDomiciliario}`} style={{ color: "var(--g2)", fontWeight: 800 }}>{telefonoDomiciliario}</a></div>
                <div style={{ fontSize: 12, color: "var(--s600)", marginTop: 3 }}>Coordina la entrega y confirma solo cuando recibas lo acordado.</div>
              </div>
            )}

            {trato.estado === "borrador" && !trato.comprador_id && (
              <div style={{ marginTop: 10, padding: "11px 13px", background: "var(--cr)", borderRadius: 9, display: "flex", gap: 9, alignItems: "center" }}>
                <span>ℹ️</span>
                <p style={{ fontSize: 13, color: "var(--s600)", flex: 1 }}>Comparte el link para que el comprador pague.</p>
                <button className="btn bo bsm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/t/${trato.link_compartir}`); toast("Link copiado ✓", "success"); }}>Copiar link</button>
              </div>
            )}

            {["activo","pago_pendiente"].includes(trato.estado) && esC && (
              <div style={{ marginTop: 13, padding: "12px 13px", background: "var(--cr)", borderRadius: 9 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}>Pago seguro con <EpaycoMark compact /></div>
                <p style={{ fontSize: 12.5, color: "var(--s600)", marginBottom: 10 }}>Tu pago se procesa en ePayco y solo la confirmación oficial marca los fondos como recibidos en TratoYA.</p>
                <button className="btn bp" style={{ width: "100%" }} onClick={pagarEpayco} disabled={busy}>
                  {busy ? <div className="spin" /> : <><span>💳 Pagar con</span><EpaycoMark compact /></>}
                </button>
                {paymentOrder?.reference && <div style={{ marginTop: 8, fontSize: 11, color: "var(--s600)", wordBreak: "break-all" }}>Referencia: {paymentOrder.reference}</div>}
              </div>
            )}

            {trato.estado === "pago_retenido" && esV && !trato.guia_envio && (
              <div style={{ marginTop: 13 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 9 }}>📦 Registrar entrega</h4>
                {/* Submenú medio de envío */}
                <div style={{ display: "flex", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>
                  {[["servientrega","🚚","Servientrega"],["domiciliario","🛵","Domiciliario"],["en_persona","🤝","En persona"]].map(([v,ic,l]) => (
                    <div key={v} onClick={() => setGuia(g => ({ ...g, medio_envio: v }))}
                      style={{ flex: "1 1 auto", border: `2px solid ${guia.medio_envio === v ? "var(--g)" : "var(--s200)"}`, background: guia.medio_envio === v ? "var(--cr)" : "#fff", borderRadius: 9, padding: "8px 11px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, textAlign: "center", color: guia.medio_envio === v ? "var(--g2)" : "var(--s600)", transition: "all .15s", minWidth: 90 }}>
                      <div style={{ fontSize: 18, marginBottom: 2 }}>{ic}</div>{l}
                    </div>
                  ))}
                </div>

                {guia.medio_envio === "servientrega" && (
                  <div className="g2" style={{ marginBottom: 9 }}>
                    <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--s800)", marginBottom: 4, display: "block" }}>Número de guía *</label>
                      <input className="inp" placeholder="Ej: 7004512345" value={guia.guia} onChange={e => setGuia(g => ({ ...g, guia: e.target.value }))} /></div>
                    <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--s800)", marginBottom: 4, display: "block" }}>Transportadora</label>
                      <input className="inp" placeholder="Servientrega" value={guia.transportadora} onChange={e => setGuia(g => ({ ...g, transportadora: e.target.value }))} /></div>
                  </div>
                )}
                {guia.medio_envio === "domiciliario" && (
                  <div style={{ marginBottom: 9 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--s800)", marginBottom: 4, display: "block" }}>Número de contacto del domiciliario *</label>
                    <input className="inp" placeholder="+57 300 123 4567" value={guia.numero_contacto} onChange={e => setGuia(g => ({ ...g, numero_contacto: e.target.value, transportadora: "Domiciliario" }))} />
                    <div style={{ fontSize: 11, color: "var(--s400)", marginTop: 3 }}>El comprador recibirá este número para coordinar la entrega.</div>
                  </div>
                )}
                {guia.medio_envio === "en_persona" && (
                  <div style={{ marginBottom: 9 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--s800)", marginBottom: 4, display: "block" }}>Punto de encuentro *</label>
                    <textarea className="inp" rows="2" placeholder="Ej: Centro Comercial Caribe, entrada principal, 3pm" value={guia.punto_encuentro} onChange={e => setGuia(g => ({ ...g, punto_encuentro: e.target.value, guia: "EN_PERSONA", transportadora: "En persona" }))} />
                  </div>
                )}

                {/* Prueba de entrega: mínimo 2 fotos OBLIGATORIAS */}
                <div style={{ marginTop: 12, padding: "12px 13px", background: "var(--reb)", border: "1.5px solid var(--re)", borderRadius: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--re)", marginBottom: 6 }}>📸 Prueba de entrega (OBLIGATORIO — mín. 2 fotos)</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    {pruebaFotos.map((f, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img src={URL.createObjectURL(f)} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "2px solid var(--g)" }} />
                        <button onClick={() => setPruebaFotos(p => p.filter((_,j) => j !== i))} style={{ position: "absolute", top: -5, right: -5, background: "var(--re)", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                      </div>
                    ))}
                    {pruebaFotos.length < 5 && (
                      <label style={{ width: 72, height: 72, border: "2px dashed var(--s200)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fff" }}>
                        <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => {
                          const nuevas = Array.from(e.target.files).slice(0, 5 - pruebaFotos.length);
                          setPruebaFotos(p => [...p, ...nuevas]);
                        }} />
                        <span style={{ fontSize: 22, color: "var(--s400)" }}>+</span>
                      </label>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--s600)" }}>{pruebaFotos.length}/2 mínimas · {5 - pruebaFotos.length} espacios restantes</div>
                </div>

                <button className="btn bp" style={{ width: "100%", marginTop: 11 }} onClick={async () => {
                  if (pruebaFotos.length < 2) { toast("Debes subir al menos 2 fotos como prueba de entrega", "error"); return; }
                  setBusy(true);
                  try {
                    // Subir fotos de prueba
                    const fd = new FormData();
                    pruebaFotos.forEach((f, i) => fd.append(`foto_${i}`, f));
                    await api.upload(`/tratos/${tratoId}/prueba-entrega`, fd);
                    // Registrar guía
                    await api.post(`/tratos/${tratoId}/registrar-guia`, guia);
                    toast("Envío registrado con prueba de entrega ✓", "success");
                    load();
                  } catch (e) { toast(e.message, "error"); }
                  setBusy(false);
                }}
                  disabled={busy || pruebaFotos.length < 2 || (guia.medio_envio === "servientrega" && !guia.guia) || (guia.medio_envio === "domiciliario" && !guia.numero_contacto) || (guia.medio_envio === "en_persona" && !guia.punto_encuentro)}>
                  {busy ? <div className="spin" /> : `📦 Confirmar envío ${pruebaFotos.length < 2 ? `(necesitas ${2-pruebaFotos.length} foto${pruebaFotos.length === 1 ? "" : "s"} más)` : "✓"}`}
                </button>
              </div>
            )}

            {["en_entrega","pendiente_confirmacion"].includes(trato.estado) && esC && (
              <div style={{ marginTop: 11, display: "flex", gap: 9 }}>
                <button className="btn bp" style={{ flex: 1 }} onClick={() => action(() => api.post(`/tratos/${tratoId}/confirmar`), "¡Entrega confirmada! El pago será liberado.")} disabled={busy}>
                  {busy ? <div className="spin" /> : "✅ Confirmar que lo recibí"}
                </button>
                <button className="btn bdd" onClick={abrirDisputa}>Disputar</button>
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div className="card chat-card">
            <div style={{ display: "flex", alignItems: "center", gap: 9, paddingBottom: 10, borderBottom: "1px solid var(--s100)", marginBottom: 9 }}>
              <Av name={cp ? `${cp.nombre} ${cp.apellido}` : "?"} size={28} />
              <div><div style={{ fontWeight: 700, fontSize: 13 }}>{cp ? `${cp.nombre} ${cp.apellido}` : "Sin contraparte"}</div><div style={{ fontSize: 10.5, color: "var(--s400)" }}>Chat del trato</div></div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
              {msgs.length === 0 && <div style={{ textAlign: "center", color: "var(--s400)", fontSize: 13, marginTop: 18 }}>Sin mensajes aún.</div>}
              {msgs.map((m, i) => {
                const mine = m.remitente_id === user?.id;
                return (
                  <div key={i} style={{ maxWidth: "85%", alignSelf: mine ? "flex-end" : "flex-start" }}>
                    <div style={{ background: mine ? "var(--n)" : "var(--s50)", color: mine ? "#fff" : "var(--n)", borderRadius: mine ? "11px 11px 3px 11px" : "11px 11px 11px 3px", padding: "8px 12px", fontSize: 13, border: mine ? "none" : "1px solid var(--s100)" }}>{m.contenido}</div>
                    <div style={{ fontSize: 10, color: "var(--s400)", marginTop: 2, textAlign: mine ? "right" : "left" }}>{timeAgo(m.createdAt)}</div>
                  </div>
                );
              })}
            </div>
            {cp && <div style={{ display: "flex", gap: 6, paddingTop: 9, borderTop: "1px solid var(--s100)", marginTop: 7 }}>
              <input className="inp" style={{ height: 34, fontSize: 13 }} placeholder="Escribe un mensaje..." value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()} />
              <button className="btn bp bsm" onClick={sendMsg}>→</button>
            </div>}
          </div>
          <div className="card" style={{ padding: 13 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--s600)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 9 }}>Acciones</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button className="btn bo bsm" style={{ justifyContent: "flex-start" }} onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/t/${trato.link_compartir}`); toast("Link copiado ✓", "success"); }}>🔗 Copiar link del trato</button>
              {!["disputado","completado","cancelado"].includes(trato.estado) && <button className="btn bdd bsm" style={{ justifyContent: "flex-start" }} onClick={abrirDisputa}>⚖️ Abrir disputa</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reputación ───────────────────────────────────────
function Reputacion({ user, setUser, toast }) {
  const [me, setMe] = useState(user);
  const load = useCallback(async (silent = false) => {
    try {
      const r = await api.get("/auth/me");
      setMe(r.data);
      setUser?.(r.data);
      sessionStore().setItem("ty_user", JSON.stringify(r.data));
    } catch (e) {
      if (!silent) toast(e.message, "error");
    }
  }, []);
  useEffect(() => {
    load(true);
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [load]);
  const total = Number(me?.total_tratos || 0);
  const exitosos = Number(me?.tratos_exitosos || 0);
  const rep = Number(me?.reputacion || 0);
  const tasa = total ? Math.round((exitosos / total) * 100) : 0;
  const nivel = rep >= 4.8 ? "Platino" : rep >= 4.4 ? "Oro" : rep >= 4 ? "Plata" : total >= 1 ? "En crecimiento" : "Nuevo";
  return (
    <div className="page fi">
      <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 18 }}>Reputación</h1>
      <div className="g2" style={{ gap: 14 }}>
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--s400)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Puntaje TratoYA</div>
          <div style={{ fontFamily: "Manrope", fontSize: 52, fontWeight: 800, lineHeight: 1, color: "var(--g2)" }}>{rep.toFixed(1)}<span style={{ fontSize: 22 }}>★</span></div>
          <p style={{ color: "var(--s600)", fontSize: 13, marginTop: 12 }}>Nivel {nivel}. El puntaje sube con transacciones completadas sin disputa y pagos liberados correctamente.</p>
        </div>
        <div className="card" style={{ padding: 22 }}>
          <div className="g2">
            {[["Tratos totales", total],["Exitosos", exitosos],["Tasa de éxito", `${tasa}%`],["KYC", me?.kyc_estado || "pendiente"]].map(([k, v]) => (
              <div key={k} style={{ background: "var(--s50)", borderRadius: 10, padding: "13px 14px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--s400)", textTransform: "uppercase", marginBottom: 4 }}>{k}</div>
                <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 18 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: "17px 19px", marginTop: 14 }}>
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Cómo se calcula</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }} className="g3">
          {["Pago liberado suma experiencia", "Cada trato completado mejora la confianza", "Disputas y cancelaciones no suman al éxito"].map(t => (
            <div key={t} style={{ background: "var(--cr2)", borderRadius: 10, padding: "12px 13px", fontSize: 13, color: "var(--s800)", fontWeight: 600 }}>{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Perfil ────────────────────────────────────────────
function Perfil({ user, setUser, toast }) {
  const [files, setFiles] = useState({});
  const [cedula, setCedula] = useState("");
  const [loading, setLoading] = useState(false);

  const uploadKyc = async () => {
    if (!cedula) { toast("Ingresa tu número de cédula", "error"); return; }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("cedula", cedula);
      if (files.cf) form.append("cedula_frente", files.cf);
      if (files.cr) form.append("cedula_reverso", files.cr);
      if (files.sl) form.append("selfie", files.sl);
      await api.upload("/kyc/upload", form);
      const me = await api.get("/auth/me");
      setUser(me.data);
      sessionStore().setItem("ty_user", JSON.stringify(me.data));
      toast("¡Identidad verificada!", "success");
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  return (
    <div className="page fi">
      <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 18 }}>Perfil</h1>
      <div className="g2" style={{ gap: 14 }}>
        <div>
          <div className="card" style={{ padding: "18px 20px", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 13, marginBottom: 16 }}>
              <Av name={`${user?.nombre||""} ${user?.apellido||""}`} size={52} />
              <div>
                <h3 style={{ fontSize: 16, marginBottom: 5 }}>{user?.nombre} {user?.apellido}</h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className={`bdg ${user?.kyc_nivel !== "ninguno" ? "gn" : "or"}`}>{user?.kyc_nivel !== "ninguno" ? "✓ Verificado" : "Sin verificar"}</span>
                  <span className="bdg nb">{user?.plan || "gratuito"}</span>
                </div>
              </div>
            </div>
            <div className="g2" style={{ gap: 10 }}>
              {[["Email", user?.email],["Teléfono", user?.telefono||"—"],["Tratos", user?.total_tratos||0],["Reputación", `${parseFloat(user?.reputacion||0).toFixed(1)}★`]].map(([k, v]) => (
                <div key={k}><div style={{ fontSize: 10, color: "var(--s400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 2 }}>{k}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div></div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <h3 style={{ fontSize: 14, marginBottom: 5 }}>Verificación de identidad (KYC)</h3>
          <p style={{ fontSize: 13, color: "var(--s600)", marginBottom: 14 }}>Requerido para crear tratos y aumentar límites de transacción.</p>
          {user?.kyc_nivel !== "ninguno" ? (
            <div style={{ background: "var(--cr)", borderRadius: 9, padding: "13px 15px" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>✅ Identidad verificada</div>
              <div style={{ fontSize: 12, color: "var(--s600)", marginTop: 3 }}>Nivel: {user?.kyc_nivel} · Estado: {user?.kyc_estado}</div>
            </div>
          ) : (
            <>
              <div className="fg"><label className="fl">Número de cédula *</label><input className="inp" placeholder="1.234.567.890" value={cedula} onChange={e => setCedula(e.target.value)} /></div>
              {[["cf","cedula_frente","📄 Cédula (frente)"],["cr","cedula_reverso","📄 Cédula (reverso)"],["sl","selfie","🤳 Selfie sosteniendo la cédula"]].map(([k, n, l]) => (
                <div key={k} className="fg">
                  <label className="fl">{l}</label>
                  <label className="uz" style={{ display: "block" }}>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => setFiles(f => ({ ...f, [k]: e.target.files[0] }))} />
                    {files[k] ? <div style={{ fontSize: 13, color: "var(--g2)", fontWeight: 600 }}>✅ {files[k].name}</div> : <div style={{ color: "var(--s400)", fontSize: 13 }}>⬆ Toca para subir imagen</div>}
                  </label>
                </div>
              ))}
              <button className="btn bp" style={{ width: "100%" }} onClick={uploadKyc} disabled={loading}>
                {loading ? <><div className="spin" /> Verificando...</> : "🔒 Enviar para verificación"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pagos ────────────────────────────────────────────
function Pagos({ toast }) {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get("/payments/history").then(r => setPagos(r.data||[])).catch(()=>{}).finally(()=>setLoading(false)); }, []);
  return (
    <div className="page fi">
      <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 18 }}>Historial de pagos</h1>
      {loading ? <div style={{ textAlign: "center", padding: 40 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></div>
        : pagos.length === 0 ? <div className="empty"><div className="empty-ico">💳</div><div className="empty-t">Sin movimientos</div><div className="empty-d">Tus pagos aparecerán aquí</div></div>
        : <div className="table-wrap"><table>
            <thead><tr><th>Trato</th><th>Tipo</th><th>Monto</th><th>Pasarela</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>{pagos.map((p, i) => <tr key={i}><td style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 11, color: "var(--g2)" }}>{p.Trato?.codigo||"—"}</td><td>{p.tipo}</td><td style={{ fontFamily: "Manrope", fontWeight: 700 }}>{fmt(p.monto)}</td><td>{p.pasarela}</td><td><span className={`bdg ${p.estado === "aprobado" ? "gn" : "or"}`}>{p.estado}</span></td><td style={{ fontSize: 11.5, color: "var(--s400)" }}>{fmtDate(p.createdAt)}</td></tr>)}</tbody>
          </table></div>
      }
    </div>
  );
}

// ─── Disputas ─────────────────────────────────────────
function Disputas({ toast, initialTratoId, clearInitialTratoId, setPage, setTratoId }) {
  const [d, setD] = useState([]);
  const [tratos, setTratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ trato_id: initialTratoId || "", tipo: "otro", motivo: "", descripcion: "" });
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dr, tr] = await Promise.all([api.get("/disputes"), api.get("/tratos?limit=100")]);
      setD(dr.data || []);
      // Solo tratos donde el pago ya fue realizado y NO han sido confirmados a conformidad
      // Estados elegibles: pago_retenido, en_entrega, pendiente_confirmacion, activo, pago_pendiente
      const elegibles = (tr.data || []).filter(t =>
        !["borrador","completado","cancelado","expirado","disputado","confirmado"].includes(t.estado)
        && ["activo","pago_pendiente","pago_retenido","en_entrega","pendiente_confirmacion"].includes(t.estado)
      );
      setTratos(elegibles);
    } catch (e) { if (!silent) toast(e.message, "error"); }
    if (!silent) setLoading(false);
  };
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (initialTratoId) setF(p => ({ ...p, trato_id: initialTratoId }));
  }, [initialTratoId]);
  const crear = async () => {
    if (!f.trato_id || !f.motivo || f.descripcion.trim().length < 20) {
      toast("Elige un trato, escribe motivo y una descripción de mínimo 20 caracteres.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/disputes", f);
      toast("Disputa creada. El trato pasó a revisión.", "success");
      setF({ trato_id: "", tipo: "otro", motivo: "", descripcion: "" });
      clearInitialTratoId?.();
      await load();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };
  return (
    <div className="page fi">
      <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 18 }}>Disputas</h1>
      <div className="card" style={{ padding: "17px 19px", marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Abrir nueva disputa</h2>
        <p style={{ fontSize: 12.5, color: "var(--s600)", marginBottom: 13 }}>Solo disponible para tratos activos. Tu historial se actualiza cada 5 segundos.</p>
        {tratos.length === 0 && !loading && (
          <div style={{ background: "var(--orb)", border: "1px solid var(--or)", borderRadius: 9, padding: "11px 13px", fontSize: 13, color: "var(--or)", marginBottom: 13 }}>
            ⚠ No tienes tratos activos elegibles para disputa. Solo se pueden disputar tratos con pago en custodia de TratoYA o en entrega que no hayan sido confirmados.
          </div>
        )}
        <div className="g2">
          <div className="fg">
            <label className="fl">Trato *</label>
            <select className="inp" value={f.trato_id} onChange={e => setF(p => ({ ...p, trato_id: e.target.value }))}>
              <option value="">— Seleccionar trato —</option>
              {tratos.map(t => <option key={t.id} value={t.id}>{t.codigo} · {t.titulo} · {ESTADO[t.estado]?.l || t.estado}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fl">Tipo</label>
            <select className="inp" value={f.tipo} onChange={e => setF(p => ({ ...p, tipo: e.target.value }))}>
              <option value="no_recibido">No recibido</option>
              <option value="producto_danado">Producto dañado</option>
              <option value="diferente">Diferente a lo acordado</option>
              <option value="servicio_incompleto">Servicio incompleto</option>
              <option value="fraude">Posible fraude</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>
        <div className="fg"><label className="fl">Motivo</label><input className="inp" placeholder="Ej: El vendedor no entregó el producto" value={f.motivo} onChange={e => setF(p => ({ ...p, motivo: e.target.value }))} /></div>
        <div className="fg"><label className="fl">Descripción</label><textarea className="inp" rows="3" placeholder="Cuenta qué pasó, fechas, acuerdos y evidencia disponible..." value={f.descripcion} onChange={e => setF(p => ({ ...p, descripcion: e.target.value }))} /></div>
        <button className="btn bdd" onClick={crear} disabled={saving || !f.trato_id}>{saving ? <div className="spin" /> : "⚖️ Crear disputa"}</button>
      </div>
      {loading ? <div style={{ textAlign: "center", padding: 40 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></div>
        : d.length === 0 ? <div className="empty"><div className="empty-ico">⚖️</div><div className="empty-t">Sin disputas</div><div className="empty-d">¡Excelente! Todos tus tratos están en orden.</div></div>
        : d.map((x, i) => <div key={i} className="card" style={{ padding: "15px 17px", marginBottom: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 11, color: "var(--g2)", marginBottom: 3 }}>{x.Trato?.codigo || ""}</div>
                <div className="wrap-any" style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{x.motivo}</div>
                <div className="wrap-any" style={{ fontSize: 12, color: "var(--s600)" }}>{x.descripcion?.slice(0,160)}{x.descripcion?.length > 160 ? "..." : ""}</div>
              </div>
              <span className={`bdg ${x.estado === "resuelta" || x.estado === "cerrada" ? "gn" : "or"}`}>{x.estado}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 12 }} className="g4">
              {[
                ["Abierta", fmtDate(x.createdAt), true],
                ["En revisión", x.estado !== "abierta" ? "Activa" : "Pendiente", ["en_revision","esperando_info","resuelta","cerrada"].includes(x.estado)],
                ["Resolución", x.resolucion || "Pendiente", ["resuelta","cerrada"].includes(x.estado)],
                ["Límite", fmtDate(x.fecha_limite), true],
              ].map(([k, v, on]) => (
                <div key={k} style={{ background: on ? "var(--cr2)" : "var(--s50)", borderRadius: 9, padding: "9px 10px" }}>
                  <div style={{ fontSize: 10, color: "var(--s400)", fontWeight: 700, textTransform: "uppercase" }}>{k}</div>
                  <div className="wrap-any" style={{ fontSize: 12, fontWeight: 700, color: on ? "var(--n)" : "var(--s400)" }}>{v}</div>
                </div>
              ))}
            </div>
            {x.notas_mediador && <div className="wrap-any" style={{ marginTop: 10, background: "var(--cr)", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "var(--s800)" }}>Resolución: {x.notas_mediador}</div>}
            {x.Trato?.id && <button className="btn bo bsm" style={{ marginTop: 10 }} onClick={() => { setTratoId?.(x.Trato.id); setPage?.("detalle"); }}>Ver trato</button>}
          </div>)
      }
    </div>
  );
}

// ─── Auth ─────────────────────────────────────────────
function Auth({ setSession, toast }) {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [f, setF_] = useState({ nombre:"", apellido:"", email:"", password:"", telefono:"" });
  const sf = (k, v) => setF_(p => ({ ...p, [k]: v }));
  // KYC obligatorio al registro
  const [kycFiles, setKycFiles] = useState({ cedula_frente: null, cedula_reverso: null, selfie: null });
  const [cedula, setCedula] = useState("");

  const login = async (e) => {
    e?.preventDefault();
    if (!f.email || !f.password) { toast("Completa email y contraseña", "error"); return; }
    setLoading(true);
    try {
      const r = await api.post("/auth/login", { email: f.email, password: f.password });
      saveSession(r.token, r.refresh_token, r.user);
      setSession({ user: r.user, token: r.token });
      toast(`Bienvenido, ${r.user.nombre}!`, "success");
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  const register = async () => {
    if (!f.nombre || !f.email || !f.password) { toast("Completa todos los campos", "error"); return; }
    if (f.password.length < 8) { toast("Contraseña mínimo 8 caracteres", "error"); return; }
    if (!cedula) { toast("El número de cédula es obligatorio", "error"); return; }
    if (!kycFiles.cedula_frente) { toast("La foto de cédula es obligatoria", "error"); return; }
    if (!kycFiles.selfie) { toast("La selfie es obligatoria", "error"); return; }
    setLoading(true);
    try {
      // 1. Crear cuenta
      await api.post("/auth/register", { nombre: f.nombre, apellido: f.apellido, email: f.email, password: f.password, telefono: f.telefono });
      // 2. Login automático para obtener token
      const r = await api.post("/auth/login", { email: f.email, password: f.password });
      sessionStore().setItem("ty_token", r.token);
      // 3. Subir KYC de inmediato
      const form = new FormData();
      form.append("cedula", cedula);
      form.append("cedula_frente", kycFiles.cedula_frente);
      if (kycFiles.cedula_reverso) form.append("cedula_reverso", kycFiles.cedula_reverso);
      form.append("selfie", kycFiles.selfie);
      await api.upload("/kyc/upload", form);
      sessionStore().removeItem("ty_token");
      toast("¡Cuenta creada! Los documentos están en revisión. Ya puedes iniciar sesión.", "success");
      setMode("login"); setStep(1);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  return (
    <div className="auth-pg">
      <div className="auth-l">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 42 }}>
            <div style={{ width: 29, height: 29, background: "var(--g)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, color: "var(--n)" }}>T</div>
            <span style={{ fontFamily: "Manrope", fontSize: 18, fontWeight: 800, color: "#fff" }}>Trato<span style={{ color: "var(--g)" }}>Ya</span></span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--g)", background: "rgba(168,196,0,.15)", padding: "2px 6px", borderRadius: 5 }}>BETA</span>
          </div>
          <div style={{ fontSize: 33, fontFamily: "Manrope", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 13 }}>Tu pago seguro<br /><span style={{ color: "var(--g)" }}>hasta el final.</span></div>
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, lineHeight: 1.6, maxWidth: 290 }}>Intermediaciones seguras para cualquier trato entre personas.</p>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          {["🔒 Dinero en custodia fiduciaria","⚡ Trato en 3 minutos","⭐ Mediación en 72 horas"].map(t => <div key={t} style={{ marginBottom: 8 }}><span className="bdg gn" style={{ fontSize: 11.5 }}>{t}</span></div>)}
        </div>
      </div>

      <div className="auth-r">
        <div className="auth-w fi">
          <h2 style={{ fontSize: 24, marginBottom: 5 }}>{mode === "login" ? "Bienvenido de nuevo" : "Crear cuenta gratis"}</h2>
          <p style={{ color: "var(--s600)", fontSize: 13, marginBottom: 24 }}>{mode === "login" ? "Ingresa a tu cuenta TratoYa" : "Empieza a hacer tratos seguros"}</p>

          {mode === "login" ? (
            <form onSubmit={login}>
              <div className="fg"><label className="fl">Email</label><input className="inp" type="email" autoComplete="email" placeholder="tu@correo.com" value={f.email} onChange={e => sf("email", e.target.value)} /></div>
              <div className="fg"><label className="fl">Contraseña</label><input className="inp" type="password" autoComplete="current-password" placeholder="Tu contraseña" value={f.password} onChange={e => sf("password", e.target.value)} /></div>
              <button type="submit" className="btn bp blg" style={{ width: "100%", marginTop: 4 }} disabled={loading}>
                {loading ? <><div className="spin" /> Entrando...</> : "Iniciar sesión"}
              </button>
            </form>
          ) : (
            <>
              {step === 1 && (
                <div className="fi">
                  <div className="g2"><div className="fg"><label className="fl">Nombre *</label><input className="inp" placeholder="Juan" value={f.nombre} onChange={e => sf("nombre", e.target.value)} /></div><div className="fg"><label className="fl">Apellido *</label><input className="inp" placeholder="Pérez" value={f.apellido} onChange={e => sf("apellido", e.target.value)} /></div></div>
                  <div className="fg"><label className="fl">Email *</label><input className="inp" type="email" autoComplete="email" placeholder="tu@correo.com" value={f.email} onChange={e => sf("email", e.target.value)} /></div>
                  <div className="fg"><label className="fl">WhatsApp</label><input className="inp" placeholder="+57 300 123 4567" value={f.telefono} onChange={e => sf("telefono", e.target.value)} /></div>
                  <div className="fg"><label className="fl">Contraseña *</label><input className="inp" type="password" autoComplete="new-password" name="tratoya_new_password" placeholder="Mínimo 8 caracteres" value={f.password} onChange={e => sf("password", e.target.value)} /></div>
                  <button className="btn bp blg" style={{ width: "100%" }} onClick={() => setStep(2)} disabled={!f.nombre || !f.apellido || !f.email || !f.password}>Continuar →</button>
                </div>
              )}
              {step === 2 && (
                <div className="fi">
                  <div style={{ background: "var(--reb)", border: "1.5px solid var(--re)", borderRadius: 10, padding: 13, marginBottom: 14, display: "flex", gap: 9 }}>
                    <span style={{ fontSize: 20 }}>🆔</span>
                    <div><div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, color: "var(--re)" }}>Verificación de identidad OBLIGATORIA</div><p style={{ fontSize: 12, color: "var(--s800)", lineHeight: 1.5 }}>Sin esto no puedes crear tu cuenta. Requerido por cumplimiento legal (SARLAFT/UIAF).</p></div>
                  </div>
                  <div className="fg">
                    <label className="fl">Número de cédula *</label>
                    <input className="inp" placeholder="1.234.567.890" value={cedula} onChange={e => setCedula(e.target.value)} />
                  </div>
                  {[["cedula_frente","📄","Foto de cédula (frente) *"],["cedula_reverso","📄","Foto de cédula (reverso)"],["selfie","🤳","Selfie sosteniendo tu cédula *"]].map(([k, ico, label]) => (
                    <div key={k} className="fg">
                      <label className="fl">{ico} {label}</label>
                      <label style={{ display: "block", border: `2px dashed ${kycFiles[k] ? "var(--g)" : "var(--re)"}`, background: kycFiles[k] ? "var(--cr)" : "var(--reb)", borderRadius: 10, padding: "14px 16px", textAlign: "center", cursor: "pointer", transition: "all .2s" }}>
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => setKycFiles(p => ({ ...p, [k]: e.target.files[0] }))} />
                        {kycFiles[k]
                          ? <div style={{ fontSize: 13, color: "var(--g2)", fontWeight: 600 }}>✅ {kycFiles[k].name}</div>
                          : <div style={{ color: "var(--re)", fontSize: 13 }}>⬆ Toca para subir imagen (obligatorio)</div>}
                      </label>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 9, marginTop: 8 }}>
                    <button className="btn bo blg" onClick={() => setStep(1)}>← Atrás</button>
                    <button className="btn bp blg" style={{ flex: 1 }} onClick={register}
                      disabled={loading || !cedula || !kycFiles.cedula_frente || !kycFiles.selfie}>
                      {loading ? <><div className="spin" /> Creando...</> : "🔒 Crear cuenta"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <p style={{ textAlign: "center", marginTop: 18, fontSize: 13.5, color: "var(--s600)" }}>
            {mode === "login" ? "¿Sin cuenta? " : "¿Ya tienes cuenta? "}
            <span style={{ color: "var(--g2)", fontWeight: 700, cursor: "pointer" }} onClick={() => { setMode(mode === "login" ? "register" : "login"); setStep(1); setF_(p => ({ ...p, password: "" })); }}>
              {mode === "login" ? "Regístrate gratis" : "Inicia sesión"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Landing ──────────────────────────────────────────
function Landing({ goAuth }) {
  return (
    <div className="land">
      <nav className="lnav">
        <div className="logo-row">
          <button className="btn bg_ back-mini" style={{ color: "rgba(255,255,255,.72)" }} onClick={() => { window.location.href = "/"; }} title="Inicio">←</button>
          <div style={{ width: 28, height: 28, background: "var(--g)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, color: "var(--n)" }}>T</div>
          <span style={{ fontFamily: "Manrope", fontSize: 18, fontWeight: 800, color: "#fff" }}>Trato<span style={{ color: "var(--g)" }}>Ya</span></span>
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--g)", background: "rgba(168,196,0,.15)", padding: "2px 6px", borderRadius: 5 }}>BETA</span>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button className="btn bg_" style={{ color: "rgba(255,255,255,.72)" }} onClick={() => goAuth("login")}>Iniciar sesión</button>
          <button className="btn bp" onClick={() => goAuth("register")}>Crear cuenta gratis</button>
        </div>
      </nav>

      <section className="hero">
        <div className="hbdg fi"><div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--g)", animation: "none" }} /> Plataforma beta activa · Colombia 🇨🇴</div>
        <h1 className="fi2">Tu pago seguro<br /><span>hasta el final.</span></h1>
        <p className="fi3">Compra y vende sin miedo. TratoYa retiene el dinero hasta que ambas partes confirmen.</p>
        <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }} className="fi3">
          <button className="btn bp blg" onClick={() => goAuth("register")}>🔒 Crear cuenta gratis</button>
          <button className="btn bo blg" onClick={() => goAuth("login")}>Iniciar sesión</button>
        </div>
        <div className="htrust fi3">{["PSE y Nequi","Verificación de identidad","Mediación en 72h","Sin cobros ocultos"].map(t => <div key={t} className="htrust-i">{t}</div>)}</div>
      </section>

      <section className="sbar">
        <div className="sgrid">{[["$0","Costo de registro"],["4.5%","Comisión promedio"],["72h","Resolución de disputas"],["100%","Garantía de devolución"]].map(([n,l]) => <div key={l} className="si"><div className="snum">{n}</div><div className="slbl">{l}</div></div>)}</div>
      </section>

      <section className="sec">
        <div className="stag">Proceso</div>
        <h2 className="sh">5 pasos, <span>un trato seguro</span></h2>
        <div className="sgrd">
          {[["1","🤝","Crear trato","Define precio y condiciones"],["2","💳","Pagar","El dinero queda en TratoYa"],["3","📦","Entregar","Vendedor envía con guía"],["4","✅","Confirmar","Comprador verifica"],["5","💰","Liberar","Dinero al vendedor en 24h"]].map(([n,ic,t,d],i) => (
            <div key={i} className="sti">
              <div className="stn">{n}</div>
              <div style={{ fontSize: 24, marginBottom: 11 }}>{ic}</div>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{t}</div>
              <div style={{ fontSize: 12.5, color: "var(--s600)", lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "var(--n)", padding: "52px 44px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "Manrope", fontSize: 33, fontWeight: 800, color: "#fff", marginBottom: 11 }}>¿Listo para un trato seguro?</h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,.5)", marginBottom: 26 }}>Regístrate gratis. Sin tarjeta requerida.</p>
        <button className="btn bp blg" onClick={() => goAuth("register")}>🔒 Crear cuenta gratis</button>
      </section>

      <footer style={{ background: "#040F1E", padding: "22px 44px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ color: "rgba(255,255,255,.3)", fontSize: 11.5 }}>© 2026 TratoYa · NEXEN / Invention Technologies S.A.S. · Cartagena de Indias</div>
        <div className="footer-links" style={{ display: "flex", gap: 16 }}>{["Términos","Privacidad","Soporte"].map(l => <span key={l} style={{ color: "rgba(255,255,255,.3)", fontSize: 11.5, cursor: "pointer" }}>{l}</span>)}</div>
      </footer>
    </div>
  );
}

function PublicTratoPage({ link, session, goAuth, toast }) {
  const [trato, setTrato] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/tratos/public/${link}`);
      setTrato(r.data);
    } catch (e) { toast(e.message, "error"); setTrato(null); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [link]);
  const aceptar = async () => {
    if (!session) { goAuth("login"); return; }
    setBusy(true);
    try {
      const r = await api.put(`/tratos/public/${link}/activar`);
      setTrato(r.data);
      toast("Trato aceptado. Ahora puedes pagar.", "success");
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const pagar = async () => {
    const pago = calcularComisionUI(parseFloat(trato?.monto || 0), trato?.quien_paga_comision || "comprador");
    if (!window.confirm(`Vas a pagar ${fmt(pago.totalPagar)} COP por este acuerdo en TratoYa. Este pago se procesará por ePayco.`)) return;
    setBusy(true);
    try {
      const r = await api.post(`/payments/epayco/create`, { dealId: trato.id });
      const paymentOrder = r.data || r;
      setOrder(paymentOrder);
      await openEpaycoCheckout(paymentOrder);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const simularPago = async () => {
    setBusy(true);
    try {
      await api.post(`/payments/sandbox-approve/${trato.id}`, { metodo_pago: "pse" });
      toast("Pago aprobado en beta. El dinero quedó en custodia de TratoYA.", "success");
      setTimeout(() => { window.location.href = "/"; }, 900);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  if (loading) return <div className="land" style={{ display: "grid", placeItems: "center" }}><div className="spin" /></div>;
  if (!trato) return <div className="land" style={{ display: "grid", placeItems: "center" }}><div className="empty"><div className="empty-t">Trato no encontrado</div></div></div>;

  const vendedor = trato.vendedor ? `${trato.vendedor.nombre} ${trato.vendedor.apellido}` : "Vendedor";
  const isBuyer = session?.user?.id === trato.comprador_id;
  const isSeller = session?.user?.id === trato.vendedor_id;
  const canAccept = session && trato.estado === "borrador" && !isSeller;
  const canPay = session && isBuyer && ["activo","pago_pendiente"].includes(trato.estado);
  const ec = ESTADO[trato.estado] || ESTADO.borrador;
  const montoTrato = parseFloat(trato.monto || 0);
  const quienComision = trato.quien_paga_comision || "comprador";

  return (
    <div className="land" style={{ minHeight: "100vh", background: "var(--s50)" }}>
      <nav className="lnav">
        <div className="logo-row">
          <button className="btn bg_ back-mini" style={{ color: "rgba(255,255,255,.72)" }} onClick={() => { window.location.href = "/"; }} title="Inicio">←</button>
          <div style={{ width: 28, height: 28, background: "var(--g)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, color: "var(--n)" }}>T</div>
          <span style={{ fontFamily: "Manrope", fontSize: 18, fontWeight: 800, color: "#fff" }}>Trato<span style={{ color: "var(--g)" }}>Ya</span></span>
        </div>
        {!session && <div style={{ display: "flex", gap: 9 }}><button className="btn bg_" style={{ color: "rgba(255,255,255,.72)" }} onClick={() => goAuth("login")}>Iniciar sesión</button><button className="btn bp" onClick={() => goAuth("register")}>Crear cuenta</button></div>}
      </nav>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "38px 20px" }}>
        <div className="card" style={{ padding: "24px 26px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: "Manrope", fontWeight: 800, color: "var(--g2)", fontSize: 12, marginBottom: 5 }}>{trato.codigo}</div>
              <h1 style={{ fontSize: 27, marginBottom: 7 }}>{trato.titulo}</h1>
              <div style={{ color: "var(--s600)", fontSize: 13 }}>Creado por {vendedor}</div>
            </div>
            <span className={`bdg ${ec.c}`}>{ec.l}</span>
          </div>
          {trato.descripcion && <p style={{ color: "var(--s600)", fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>{trato.descripcion}</p>}
          <div style={{ marginBottom: 18 }}>
            <CommissionBreakdown
              monto={montoTrato}
              quien={quienComision}
              note="Este es el valor real que se usará para el checkout de ePayco."
            />
          </div>
          {!session ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn bp blg" onClick={() => goAuth("register")}>Crear cuenta y aceptar</button>
              <button className="btn bo blg" onClick={() => goAuth("login")}>Ya tengo cuenta</button>
            </div>
          ) : isSeller ? (
            <div style={{ background: "var(--cr)", padding: 13, borderRadius: 10, fontSize: 13, color: "var(--s600)" }}>
              <div style={{ fontWeight: 700, color: "var(--n)", marginBottom: 4 }}>Este link es para que tu contraparte acepte y pague.</div>
              <div style={{ marginBottom: 12 }}>Para pruebas beta puedes simular el pago completo y dejar el dinero en custodia de TratoYA.</div>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <button className="btn bp" onClick={simularPago} disabled={busy}>{busy ? <div className="spin" /> : "Simular pago beta completo"}</button>
                <button className="btn bo" onClick={() => { window.location.href = "/"; }}>Ir a mi dashboard</button>
              </div>
            </div>
          ) : canAccept ? (
            <button className="btn bp blg" onClick={aceptar} disabled={busy}>{busy ? <div className="spin" /> : "Aceptar trato y continuar al pago"}</button>
          ) : canPay ? (
            <div>
              <button className="btn bp blg" style={{ width: "100%" }} onClick={pagar} disabled={busy}>{busy ? <div className="spin" /> : <><span>Pagar con</span><EpaycoMark /></>}</button>
              {order?.reference && <div style={{ fontSize: 11, color: "var(--s600)", marginTop: 8 }}>Referencia: {order.reference}</div>}
            </div>
          ) : (
            <div style={{ background: "var(--cr)", padding: 13, borderRadius: 10, fontSize: 13, color: "var(--s600)" }}>Este trato está en estado {ec.l}. Puedes verlo desde tu panel.</div>
          )}
        </div>
      </main>
    </div>
  );
}

function PaymentResultPage({ session, goAuth, toast }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference") || params.get("x_id_invoice") || params.get("x_extra3") || params.get("invoice");
  useEffect(() => {
    if (!session || !reference) { setLoading(false); return; }
    const check = () => api.get(`/payments/status?reference=${encodeURIComponent(reference)}`)
      .then(r => setResult(r.data))
      .catch(e => toast(e.message, "error"))
      .finally(() => setLoading(false));
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [session, reference]);

  const status = result?.status;
  const statusCopy = {
    PAID: ["✅", "Pago recibido", "Tus fondos quedaron registrados en TratoYA."],
    PAYMENT_PENDING: ["⏳", "Pago pendiente", "Tu pago está pendiente de confirmación."],
    CREATED: ["⏳", "Verificando pago", "Estamos verificando tu pago con ePayco..."],
    PAYMENT_DECLINED: ["❌", "Pago rechazado", "El pago fue rechazado. Puedes intentar nuevamente."],
    PAYMENT_ERROR: ["⚠️", "Error en el pago", "Hubo un error procesando el pago."],
    PAYMENT_VOIDED: ["↩️", "Pago anulado", "El pago fue anulado por ePayco."],
  }[status] || ["💳", "Resultado del pago", "Estamos verificando tu pago con ePayco..."];

  return (
    <div className="land" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--s50)", padding: 20 }}>
      <div className="card" style={{ padding: "26px 28px", maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 10 }}>{statusCopy[0]}</div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>{statusCopy[1]}</h1>
        {!session ? <p style={{ color: "var(--s600)", marginBottom: 16 }}>Inicia sesión para verificar el estado de la transacción.</p>
          : loading ? <div className="spin" style={{ margin: "18px auto" }} />
          : !reference ? <p style={{ color: "var(--s600)" }}>ePayco no envió una referencia de pago.</p>
          : <p style={{ color: "var(--s600)" }}>{statusCopy[2]}</p>}
        {reference && <div style={{ fontSize: 11, color: "var(--s400)", wordBreak: "break-all", marginTop: 10 }}>Referencia: {reference}</div>}
        {!session && <button className="btn bp" onClick={() => goAuth("login")}>Iniciar sesión</button>}
        {session && <button className="btn bp" style={{ marginTop: 16 }} onClick={() => { window.location.href = "/"; }}>Volver al acuerdo</button>}
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────
function AppShell({ session, setSession, toast }) {
  const [page, setPage] = useState("dashboard");
  const [tratoId, setTratoId] = useState(null);
  const [disputeTratoId, setDisputeTratoId] = useState(null);
  const [floatingNote, setFloatingNote] = useState(null);
  const [celebration, setCelebration] = useState(false);
  const showFloatingNote = useCallback((note) => {
    setFloatingNote(note);
    notifyDeviceFeedback(note?.tipo === "trato_completado" ? "celebration" : "bubble");
    playBubbleSound();
    setTimeout(() => setFloatingNote(n => n === note ? null : n), 9000);
  }, []);
  const estadoLabel = useCallback((estado) => (ESTADO[estado]?.l || estado || "Actualizado").replace(/[^\p{L}\p{N}\s]/gu, "").trim(), []);
  const showCompletionCelebration = useCallback(() => {
    setCelebration(true);
    notifyDeviceFeedback("celebration");
    playCelebrationSound();
    setTimeout(() => setCelebration(false), 2600);
  }, []);
  const notifyStatusUpdate = useCallback((trato, _prevEstado, nextEstado) => {
    if (nextEstado === "completado") {
      showCompletionCelebration();
    }
    showFloatingNote({
      tipo: "estado_trato",
      icon: nextEstado === "completado" ? "🔔" : "💬",
      titulo: nextEstado === "completado" ? "Trato completado" : "Estado del trato actualizado",
      cuerpo: `${trato.codigo || "Tu trato"} ahora está en ${estadoLabel(nextEstado)}.`,
      trato_id: trato.id,
    });
  }, [showFloatingNote, estadoLabel, showCompletionCelebration]);

  const logout = useCallback((message = "Sesión cerrada") => {
    const logoutMessage = typeof message === "string" ? message : "Sesión cerrada";
    api.post("/auth/logout").catch(()=>{});
    clearSession();
    setSession(null);
    toast(logoutMessage, "info");
  }, [setSession, toast]);
  const updateUser = (u) => setSession(s => ({ ...s, user: u }));

  useEffect(() => {
    const unlock = () => unlockNotificationSound();
    const events = ["pointerdown", "keydown", "touchstart", "touchend", "click", "focus", "pageshow"];
    const unlockWhenVisible = () => {
      if (document.visibilityState === "visible") unlockNotificationSound();
    };
    unlockNotificationSound();
    events.forEach(evt => window.addEventListener(evt, unlock, { passive: true }));
    document.addEventListener("visibilitychange", unlockWhenVisible);
    return () => {
      events.forEach(evt => window.removeEventListener(evt, unlock));
      document.removeEventListener("visibilitychange", unlockWhenVisible);
    };
  }, []);

  useEffect(() => {
    const INACTIVITY_MS = 30 * 60 * 1000;
    let timerId;
    const resetTimer = () => {
      clearTimeout(timerId);
      timerId = setTimeout(() => logout("Sesión cerrada por 30 minutos de inactividad"), INACTIVITY_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(timerId);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [logout]);

  // ── SSE Push Notifications en tiempo real ──────────
  useEffect(() => {
    if (!session?.token) return;
    let ctrl = new AbortController();
    const conectarSSE = async () => {
      try {
        const resp = await fetch(`${API_URL}/users/stream`, {
          headers: { Authorization: `Bearer ${session.token}` },
          signal: ctrl.signal,
        });
        if (!resp.ok) return;
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop();
          for (const chunk of lines) {
            const dataLine = chunk.split("\n").find(l => l.startsWith("data:"));
            if (!dataLine) continue;
            try {
              const evt = JSON.parse(dataLine.slice(5).trim());
              if (evt.tipo !== "conectado") {
                const supportNote = isSupportNotification(evt);
                const note = {
                  tipo: evt.tipo,
                  icon: supportNote || ["pago_liberado", "trato_completado"].includes(evt.tipo) ? "🔔" : "💬",
                  titulo: supportNote ? 'Mensaje de "Soporte - TratoYA"' : (evt.datos?.titulo || evt.tipo),
                  cuerpo: evt.datos?.cuerpo || evt.datos?.mensaje || "Nueva actividad en tu cuenta",
                  trato_id: evt.datos?.metadata?.trato_id || evt.datos?.trato_id,
                };
                if (["pago_liberado", "trato_completado"].includes(evt.tipo)) showCompletionCelebration();
                showFloatingNote(note);
              }
            } catch { /* ignore */ }
          }
        }
      } catch (e) {
        if (e.name !== "AbortError") setTimeout(conectarSSE, 5000);
      }
    };
    conectarSSE();
    return () => ctrl.abort();
  }, [session?.token, showFloatingNote, showCompletionCelebration]);

  const openFloatingNote = () => {
    if (floatingNote?.trato_id) {
      setTratoId(floatingNote.trato_id);
      setPage("detalle");
    } else {
      setPage("dashboard");
    }
    setFloatingNote(null);
  };

  const pages = {
    dashboard: { title: "Dashboard",    c: <Dashboard setPage={setPage} setTratoId={setTratoId} user={session.user} toast={toast} setUser={updateUser} /> },
    tratos:    { title: "Mis Tratos",   c: <MisTratos setPage={setPage} setTratoId={setTratoId} user={session.user} toast={toast} /> },
    crear:     { title: "Crear trato",  c: <CrearTrato setPage={setPage} toast={toast} user={session.user} /> },
    detalle:   { title: "Detalle",      c: <TratoDetalle tratoId={tratoId} setPage={setPage} setDisputeTratoId={setDisputeTratoId} user={session.user} toast={toast} onStatusUpdate={notifyStatusUpdate} /> },
    pagos:     { title: "Pagos",        c: <Pagos toast={toast} /> },
    disputas:  { title: "Disputas",     c: <Disputas toast={toast} initialTratoId={disputeTratoId} clearInitialTratoId={() => setDisputeTratoId(null)} setPage={setPage} setTratoId={setTratoId} /> },
    reputacion:{ title: "Reputación",   c: <Reputacion user={session.user} setUser={updateUser} toast={toast} /> },
    perfil:    { title: "Perfil", c: <Perfil user={session.user} setUser={updateUser} toast={toast} /> },
  };
  const cur = pages[page] || pages.dashboard;

  return (
    <div>
      <Sidebar page={page} setPage={setPage} user={session.user} onLogout={logout} />
      <div className="main">
        <Topbar title={cur.title} user={session.user} page={page} setPage={setPage} />
        <div key={page}>{cur.c}</div>
      </div>
      <FloatingNotification note={floatingNote} onOpen={openFloatingNote} onClose={() => setFloatingNote(null)} />
      <CelebrationOverlay show={celebration} />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────
export default function TratoYaApp() {
  clearLegacySession();
  const { toasts, show, remove } = useToast();
  const [session, setSession] = useState(() => {
    const u = getSavedUser(), t = sessionStore().getItem("ty_token");
    return (u && t) ? { user: u, token: t } : null;
  });
  const [authMode, setAuthMode] = useState(null);
  const toast = useCallback((m, type = "info") => show(m, type), [show]);
  const isAdminRoute = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");
  const publicMatch = window.location.pathname.match(/^\/t\/([^/]+)/);
  const isPaymentResult = window.location.pathname === "/pagos/respuesta" || window.location.pathname === "/pago/resultado";

  return (
    <>
      {isAdminRoute ? (
        <TratoYaAdmin />
      ) : publicMatch ? (
        <>
          <style>{FONTS}{CSS}</style>
          {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />)}
          {authMode && !session
            ? <Auth setSession={setSession} toast={toast} />
            : <PublicTratoPage link={publicMatch[1]} session={session} goAuth={setAuthMode} toast={toast} />}
        </>
      ) : isPaymentResult ? (
        <>
          <style>{FONTS}{CSS}</style>
          {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />)}
          {authMode && !session
            ? <Auth setSession={setSession} toast={toast} />
            : <PaymentResultPage session={session} goAuth={setAuthMode} toast={toast} />}
        </>
      ) : (
        <>
          <style>{FONTS}{CSS}</style>
          {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />)}
          {session
        ? <AppShell session={session} setSession={setSession} toast={toast} />
        : authMode
          ? <Auth setSession={setSession} toast={toast} />
          : <Landing goAuth={setAuthMode} />
          }
        </>
      )}
    </>
  );
}
