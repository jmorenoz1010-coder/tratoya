import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { ADMIN_ENTRY_PATH } from "./lib/routes";
import { publicTratoUrl, calcularComisionUI, parseCopAmount } from "./lib/utils";
import logo from "./assets/tratoya-logo.png";

/* ═══════════════════════════════════════════════════════════
   TRATOYA · PANEL DE ADMINISTRACIÓN
   Superusuario completo — conectado al backend real
   Ruta privada  |  Solo accesible con rol = 'admin'
   ═══════════════════════════════════════════════════════════ */

const API_URL = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "tratoya.com" || host === "www.tratoya.com") return "https://api.tratoya.com/api";
  }
  return "/api";
})();

const api = {
  _tok: () => localStorage.getItem("ty_admin_token_v2"),
  _ref: () => localStorage.getItem("ty_admin_refresh_v2"),
  async req(method, path, body = null, isForm = false, _retry = false) {
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
      throw new Error("No se pudo conectar con el servidor. Verifica tu conexión.");
    }
    const d = await r.json().catch(() => ({ success: false, message: "Error de conexión" }));
    if (!r.ok && r.status === 401 && !_retry) {
      // Intenta refrescar el token antes de cerrar sesión
      const refresh = this._ref();
      if (refresh) {
        try {
          const rr = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refresh }),
          });
          const rd = await rr.json().catch(() => ({}));
          if (rr.ok && rd.token) {
            localStorage.setItem("ty_admin_token_v2", rd.token);
            return this.req(method, path, body, isForm, true); // reintento con nuevo token
          }
        } catch { /* sigue al logout */ }
      }
      localStorage.removeItem("ty_admin_token_v2");
      localStorage.removeItem("ty_admin_refresh_v2");
      localStorage.removeItem("ty_admin_user_v2");
      localStorage.removeItem("ty_admin_token");
      window.dispatchEvent(new CustomEvent("ty-admin-auth-expired", { detail: d.message || "Sesión vencida" }));
    }
    if (!r.ok) throw new Error(d.message || `Error ${r.status}`);
    return d;
  },
  get:  (p)    => api.req("GET",    p),
  post: (p, b) => api.req("POST",   p, b),
  upload: (p, f) => api.req("POST", p, f, true),
  put:  (p, b) => api.req("PUT",    p, b),
  patch:(p, b) => api.req("PATCH",  p, b),
  del:  (p)    => api.req("DELETE", p),
};

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtTime = (d) => d ? new Date(d).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const timeAgo = (d) => { if (!d) return ""; const diff = Date.now() - new Date(d); const m = Math.floor(diff/60000); if (m < 1) return "ahora"; if (m < 60) return `hace ${m}m`; const h = Math.floor(m/60); if (h < 24) return `hace ${h}h`; return `hace ${Math.floor(h/24)}d`; };

const KYC_ESTADOS = { ninguno:"bg", basico:"or", verificado:"gn", premium:"pu", suspendido:"rd" };
const TRATO_EST = { borrador:"bg", activo:"nb", pago_pendiente:"or", pago_retenido:"nb", en_entrega:"or", confirmado:"gn", completado:"gn", disputado:"rd", cancelado:"bg", expirado:"bg" };
const DISP_EST = { abierta:"rd", en_revision:"or", resuelta:"gn", cancelada:"bg" };
const ROLE_BADGE = { superadmin:"pu", admin:"gn", moderador:"or", soporte:"nb", invitado:"bg", user:"bg" };
const ROLE_LABEL = { superadmin:"Superadmin", admin:"Administrador", moderador:"Moderador", soporte:"Soporte", invitado:"Invitado", user:"Usuario" };
const rolLabel = (rol = "user") => ROLE_LABEL[rol] || rol;
const TRATO_LABEL = {
  borrador: "Borrador",
  activo: "Listo para pago",
  pago_pendiente: "Revisar comprobante",
  pago_retenido: "Pago confirmado · entregar",
  en_entrega: "Entrega en curso",
  pendiente_confirmacion: "Comprador debe confirmar",
  confirmado: "Listo para liberar",
  completado: "Completado",
  disputado: "En disputa",
  cancelado: "Cancelado",
  expirado: "Expirado",
};
const tratoLabel = (estado) => TRATO_LABEL[estado] || estado || "—";

const ROLE_OPTIONS = [
  { id: "invitado", label: "Invitado", desc: "Acceso temporal o de prueba, sin permisos operativos." },
  { id: "user", label: "Usuario", desc: "Usa la plataforma, crea tratos y gestiona su cuenta." },
  { id: "soporte", label: "Soporte", desc: "Atiende tickets y responde casos sin tocar dinero ni roles." },
  { id: "moderador", label: "Moderador", desc: "Revisa KYC, disputas y puede pausar usuarios riesgosos." },
  { id: "admin", label: "Administrador", desc: "Opera usuarios, pagos, notificaciones y configuración." },
  { id: "superadmin", label: "Superadmin", desc: "Control total, incluyendo roles y permisos críticos." },
];

const PERMISSIONS = [
  { key: "Usuarios", invitado: false, user: false, soporte: false, moderador: true, admin: true, superadmin: true },
  { key: "KYC", invitado: false, user: false, soporte: false, moderador: true, admin: true, superadmin: true },
  { key: "Disputas", invitado: false, user: false, soporte: true, moderador: true, admin: true, superadmin: true },
  { key: "Pagos/retiros", invitado: false, user: false, soporte: false, moderador: false, admin: true, superadmin: true },
  { key: "Notificaciones", invitado: false, user: false, soporte: true, moderador: true, admin: true, superadmin: true },
  { key: "Configuración", invitado: false, user: false, soporte: false, moderador: false, admin: true, superadmin: true },
  { key: "Credenciales", invitado: false, user: false, soporte: false, moderador: false, admin: false, superadmin: true },
  { key: "Roles", invitado: false, user: false, soporte: false, moderador: false, admin: false, superadmin: true },
];

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Nunito+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');`;

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --n:#07192F;--n2:#0D2647;--n3:#1A3A5F;
  --g:#A8C400;--g2:#479818;--cr:#EAF2DC;
  --s50:#F4F6F8;--s100:#E5E9EE;--s200:#CBD3DD;--s300:#B0BDCC;--s400:#9AA5B3;--s600:#6B7785;--s800:#3A4452;
  --or:#E07B00;--orb:#FFF3E0;--rd:#D9534F;--rdb:#FEECEC;--pu:#7C3AED;--pub:#EDE9FE;
  --sh:0 1px 4px rgba(7,25,47,.09);--shm:0 4px 14px rgba(7,25,47,.12);--shl:0 8px 28px rgba(7,25,47,.16)
}
html,body{height:100%}
body{font-family:'Nunito Sans',sans-serif;background:#071819;color:var(--n);-webkit-font-smoothing:antialiased;line-height:1.55}
h1,h2,h3,h4{font-family:'Manrope','Nunito Sans',sans-serif;line-height:1.12;letter-spacing:.005em}
code,pre,.mono{font-family:'JetBrains Mono',monospace}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}

@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes sp{to{transform:rotate(360deg)}}
@keyframes pi{from{transform:scale(.88);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pu{0%,100%{opacity:1}50%{opacity:.4}}
.fi{animation:fi .3s ease both}.fi2{animation:fi .3s .06s ease both}.fi3{animation:fi .3s .12s ease both}.popi{animation:pi .28s cubic-bezier(.34,1.56,.64,1) both}
.spin{width:18px;height:18px;border:2.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:sp .7s linear infinite;display:inline-block;flex-shrink:0}

/* Layout — sidebar fijo + admin-main con margen, igual al patrón del AppShell */
.admin-shell{min-height:100vh;background:var(--s50)}
.admin-sidebar{width:220px;background:radial-gradient(circle at 70% 8%,rgba(169,235,27,.18),transparent 30%),linear-gradient(180deg,#071819 0%,#0b2927 58%,#061112 100%);border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;position:fixed;left:0;top:0;height:100vh;overflow-y:auto;z-index:100;box-shadow:18px 0 48px rgba(0,0,0,.18)}
.sb-top{padding:18px 14px 12px;border-bottom:1px solid rgba(255,255,255,.05)}
.sb-logo{display:flex;align-items:center;gap:9px}
.admin-logo-img{width:136px;height:auto;display:block;filter:drop-shadow(0 12px 20px rgba(0,0,0,.35))}
.logo-mk{width:30px;height:30px;background:var(--g);border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Syne';font-weight:800;font-size:15px;color:var(--n);flex-shrink:0}
.sb-nav{flex:1;padding:8px 7px;overflow-y:auto}
.nav-sec{font-size:9px;font-weight:900;color:rgba(169,235,27,.5);letter-spacing:1.4px;text-transform:uppercase;padding:10px 8px 4px}
.ni{display:flex;align-items:center;gap:8px;width:100%;padding:9px 10px;border-radius:12px;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:800;color:rgba(244,255,249,.68);transition:all .15s;margin-bottom:3px;user-select:none;white-space:nowrap;border:1px solid transparent;background:transparent;text-align:left}
.ni:hover{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.08)}
.ni.act{background:linear-gradient(135deg,rgba(169,235,27,.2),rgba(72,165,28,.13));color:#dfff60;font-weight:900;border-color:rgba(169,235,27,.25);box-shadow:0 12px 26px rgba(117,205,22,.13)}
.ni-badge{margin-left:auto;background:var(--rd);color:#fff;font-size:9.5px;font-weight:800;padding:1px 6px;border-radius:10px}
.sb-bot{padding:10px 12px 14px;border-top:1px solid rgba(255,255,255,.05)}

.admin-main{margin-left:220px;background:var(--s50);display:flex;flex-direction:column;min-height:100vh}
.topbar{background:#fff;border-bottom:1px solid var(--s100);padding:0 20px;height:54px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:80}
.page{padding:18px 20px;flex:1}

/* Cards */
.card{background:#fff;border-radius:12px;border:1px solid var(--s100);box-shadow:var(--sh)}
.card-dark{background:#0D1F38;border:1px solid rgba(255,255,255,.06);border-radius:12px}

/* Stat cards */
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.stat{background:#fff;border-radius:11px;padding:14px 16px;border:1px solid var(--s100);transition:transform .18s,box-shadow .18s;cursor:pointer}
.stat:hover{transform:translateY(-2px);box-shadow:var(--shm)}
.stat-ico{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:7px}
.stat-lbl{font-size:9.5px;font-weight:600;color:var(--s400);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.stat-val{font-family:'Syne';font-size:21px;font-weight:800;line-height:1.1;margin-bottom:2px}
.stat-sub{font-size:11px;color:var(--s600)}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font-family:'Nunito Sans',sans-serif;font-weight:800;font-size:13px;border:none;cursor:pointer;transition:all .16s;border-radius:8px;padding:0 16px;height:36px;white-space:nowrap}
.btn:active{transform:scale(.97)}.btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
.bp{background:var(--g);color:var(--n)}.bp:hover:not(:disabled){background:#B8D400}
.bn{background:var(--n);color:#fff}.bn:hover:not(:disabled){background:var(--n2)}
.bo{background:transparent;color:var(--n);border:1.5px solid var(--s200)}.bo:hover:not(:disabled){border-color:var(--g);color:var(--g2)}
.bg_{background:transparent;color:var(--s600);padding:0 10px}.bg_:hover:not(:disabled){background:var(--s100);color:var(--n)}
.brd{background:var(--rdb);color:var(--rd)}.brd:hover:not(:disabled){background:var(--rd);color:#fff}
.bor{background:var(--orb);color:var(--or)}.bor:hover:not(:disabled){background:var(--or);color:#fff}
.bpu{background:var(--pub);color:var(--pu)}.bpu:hover:not(:disabled){background:var(--pu);color:#fff}
.bsm{height:28px;font-size:11.5px;padding:0 10px;border-radius:6px}
.blg{height:42px;font-size:14px;padding:0 22px;border-radius:10px}

/* Inputs */
.inp{width:100%;height:38px;padding:0 12px;font-family:'Nunito Sans',sans-serif;font-size:13px;color:var(--n);background:#fff;border:1.5px solid var(--s200);border-radius:8px;outline:none;transition:border-color .16s,box-shadow .16s}
.inp:focus{border-color:var(--g);box-shadow:0 0 0 3px rgba(168,196,0,.12)}.inp::placeholder{color:var(--s400)}
textarea.inp{height:auto;padding:9px 12px;resize:vertical}
.fl{display:block;font-size:12px;font-weight:600;color:var(--s800);margin-bottom:5px}
.fg{margin-bottom:12px}

/* Badges */
.bdg{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;white-space:nowrap}
.bdg.gn{background:var(--cr);color:var(--g2)}.bdg.nb{background:#E6EBF2;color:var(--n3)}.bdg.or{background:var(--orb);color:var(--or)}.bdg.rd{background:var(--rdb);color:var(--rd)}.bdg.bg{background:var(--s100);color:var(--s600)}.bdg.pu{background:var(--pub);color:var(--pu)}

/* Table */
.tw{overflow-x:auto;border-radius:10px;border:1px solid var(--s100)}
.tw td,.tw th{vertical-align:top}
.tw td{overflow-wrap:anywhere;word-break:break-word}
.td-wrap{max-width:260px;white-space:normal;overflow-wrap:anywhere;line-height:1.35}
table{width:100%;border-collapse:collapse;font-size:12.5px}
thead th{background:var(--n);color:#fff;padding:9px 13px;text-align:left;font-size:9.5px;font-weight:600;letter-spacing:.6px;text-transform:uppercase}
thead th:first-child{border-radius:10px 0 0 0}thead th:last-child{border-radius:0 10px 0 0}
tbody td{padding:9px 13px;border-bottom:1px solid var(--s100);color:var(--s800)}
tbody tr:last-child td{border-bottom:none}tbody tr:hover td{background:var(--s50)}

/* Modal */
.overlay{position:fixed;inset:0;background:rgba(6,15,30,.7);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}
.modal{background:#fff;border-radius:14px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:var(--shl);animation:pi .25s ease both;margin:auto}
.modal-hd{padding:16px 20px;border-bottom:1px solid var(--s100);display:flex;align-items:center;justify-content:space-between}
.modal-bd{padding:18px 20px}
.modal-ft{padding:14px 20px;border-top:1px solid var(--s100);display:flex;gap:8px;justify-content:flex-end}

/* Toast */
.toast-wrap{position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:7px;pointer-events:none}
.toast{background:var(--n);color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:var(--shl);display:flex;align-items:center;gap:8px;animation:pi .25s ease both;max-width:320px}
.toast.success{background:var(--g2)}.toast.error{background:var(--rd)}.toast.warn{background:var(--or)}

/* Tabs */
.tabs{display:flex;gap:2px;background:var(--s100);padding:3px;border-radius:8px;margin-bottom:14px}
.tab{padding:5px 14px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .14s;color:var(--s600)}
.tab.act{background:#fff;color:var(--n);box-shadow:var(--sh)}

/* Search bar */
.search{display:flex;align-items:center;gap:8px;background:#fff;border:1.5px solid var(--s200);border-radius:8px;padding:0 12px;height:36px}
.search input{border:none;outline:none;font-size:13px;font-family:'DM Sans',sans-serif;background:transparent;flex:1;color:var(--n)}
.search input::placeholder{color:var(--s400)}

/* Live dot */
.live{width:7px;height:7px;border-radius:50%;background:#22c55e;animation:pu 2s infinite;box-shadow:0 0 0 3px rgba(34,197,94,.2)}

/* Ticket */
.ticket{border:1.5px solid var(--s100);border-radius:10px;padding:13px 15px;background:#fff;margin-bottom:9px;cursor:pointer;transition:border-color .16s}
.ticket:hover{border-color:var(--g)}
.ticket.open{border-left:3px solid var(--rd)}.ticket.pending{border-left:3px solid var(--or)}.ticket.resolved{border-left:3px solid var(--g2)}

/* Activity log */
.log-item{display:flex;gap:11px;padding:9px 0;border-bottom:1px solid var(--s100)}
.log-item:last-child{border-bottom:none}
.log-dot{width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0}

/* Admin login */
.adm-login{min-height:100vh;background:radial-gradient(circle at 72% 20%,rgba(169,235,27,.2),transparent 28%),linear-gradient(140deg,#061315 0%,#0b2526 48%,#071012 100%);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.adm-login::before{content:'';position:absolute;top:-20%;left:-10%;width:60%;height:60%;background:radial-gradient(ellipse,rgba(169,235,27,.12) 0%,transparent 60%);pointer-events:none}

/* Roles */
.role-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}
.role-card{background:#fff;border:1px solid var(--s100);border-radius:10px;padding:12px 13px;min-height:104px}
.role-card strong{display:block;font-size:13px;margin:7px 0 4px}
.role-card p{font-size:11.5px;color:var(--s600);line-height:1.35}
.perm-grid{display:grid;grid-template-columns:1.2fr repeat(6,1fr);border:1px solid var(--s100);border-radius:10px;overflow:hidden;background:#fff}
.perm-cell{padding:9px 11px;border-right:1px solid var(--s100);border-bottom:1px solid var(--s100);font-size:12px;display:flex;align-items:center;justify-content:center;min-height:36px}
.perm-cell:nth-child(7n){border-right:none}.perm-cell.h{background:var(--n);color:#fff;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}.perm-cell.k{justify-content:flex-start;font-weight:600;color:var(--s800)}

/* Grid helpers */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px}
@media (max-width:900px){
  .admin-shell{display:block!important;min-height:100vh}
  .admin-sidebar{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;width:100%!important;min-width:0!important;max-width:none!important;height:72px!important;z-index:120;border-right:0;border-top:1px solid rgba(255,255,255,.08);overflow:hidden}
  .sb-top,.sb-bot,.nav-sec{display:none}
  .sb-nav{height:72px;display:flex;align-items:center;gap:4px;overflow-x:auto;overflow-y:hidden;padding:7px 8px}
  .ni{min-width:70px;flex:1;flex-direction:column;justify-content:center;gap:3px;text-align:center;font-size:10px;padding:7px 5px;margin:0;white-space:normal}
  .ni span{font-size:16px!important}
  .ni-badge{position:absolute;margin-left:0;top:4px;right:8px}
  .admin-main{margin-left:0!important;padding-bottom:82px;min-width:0}
  .topbar{height:auto;min-height:54px;padding:9px 12px;gap:8px;align-items:flex-start;flex-wrap:wrap}
  .topbar>div{min-width:0;flex-wrap:wrap}
  .page{padding:14px 12px}
  .stat-grid,.role-grid,.g2,.g3{grid-template-columns:1fr!important}
  .tw{margin-left:-2px;margin-right:-2px}
  table{min-width:780px}
  .modal{max-width:calc(100vw - 20px);max-height:92vh}
  .modal-hd,.modal-bd,.modal-ft{padding-left:14px;padding-right:14px}
  .toast-wrap{left:10px;right:10px;top:10px}
  .toast{max-width:none}
  .search{width:100%!important}
}
`;

// ─── Toast ────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  const ico = { success: "✅", error: "❌", warn: "⚠️", info: "ℹ️" };
  return <div className={`toast ${type}`}>{ico[type] || "ℹ️"} {message}</div>;
}
function useToast() {
  const [ts, setTs] = useState([]);
  const show = useCallback((message, type = "info") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setTs(t => {
      const sinDuplicado = t.filter(x => !(x.message === message && x.type === type));
      return [...sinDuplicado.slice(-3), { id, message, type }];
    });
  }, []);
  const rm = useCallback((id) => setTs(t => t.filter(x => x.id !== id)), []);
  return { ts, show, rm };
}

// ─── Sidebar nav ──────────────────────────────────────
const NAV = [
  { sec: "General" },
  { id: "dashboard",    ico: "📊", l: "Inicio" },
  { id: "actividad",    ico: "⚡", l: "Transacciones en TR" },
  { sec: "Usuarios" },
  { id: "usuarios",     ico: "👥", l: "Todos los usuarios" },
  { id: "roles",        ico: "🛡️", l: "Roles y accesos" },
  { id: "kyc",          ico: "🆔", l: "Verificaciones KYC" },
  { id: "baneos",       ico: "🚫", l: "Baneados / Suspendidos" },
  { sec: "Operaciones" },
  { id: "tratos",       ico: "🤝", l: "Todos los tratos" },
  { id: "pagos",        ico: "💳", l: "Pagos y retiros" },
  { id: "comisiones",   ico: "💰", l: "Comisiones TratoYa" },
  { id: "resenas",      ico: "⭐", l: "Reseñas y reputación" },
  { id: "disputas",     ico: "⚖️", l: "Disputas", badge: true },
  { sec: "Soporte" },
  { id: "tickets",      ico: "🎫", l: "Tickets de soporte" },
  { id: "notificaciones", ico: "🔔", l: "Enviar notificaciones" },
  { sec: "Sistema" },
  { id: "configuracion", ico: "⚙️", l: "Configuración" },
  { id: "logs",         ico: "📋", l: "Logs del sistema" },
];

function Sidebar({ page, setPage, admin, disputasPendientes = 0 }) {
  return (
    <aside className="admin-sidebar">
      <div className="sb-top">
        <div className="sb-logo">
          <a href="/" aria-label="Ir al inicio">
            <img className="admin-logo-img" src={logo} alt="TratoYa" />
          </a>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--g)", background: "rgba(168,196,0,.12)", padding: "1px 6px", borderRadius: 4, display: "inline-block", marginLeft: 5 }}>ADMIN</div>
          </div>
        </div>
      </div>
      <nav className="sb-nav">
        {NAV.map((item, i) => {
          if (item.sec) return <div key={i} className="nav-sec">{item.sec}</div>;
          return (
            <button key={item.id} type="button" className={`ni ${page === item.id ? "act" : ""}`} onClick={() => setPage(item.id)}>
              <span style={{ fontSize: 14 }}>{item.ico}</span>
              {item.l}
              {item.badge && disputasPendientes > 0 && <span className="ni-badge">{disputasPendientes}</span>}
            </button>
          );
        })}
      </nav>
      <div className="sb-bot">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--g)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne", fontWeight: 800, fontSize: 12, color: "var(--n)" }}>
            {(admin?.nombre || "A")[0]}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{admin?.nombre || "Admin"}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>{rolLabel(admin?.rol || "admin")}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── DASHBOARD ────────────────────────────────────────
function AdminDashboard({ toast, setPage }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actividad, setActividad] = useState([]);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/actividad-reciente"),
    ]).then(([s, a]) => {
      setStats(s.data || s);
      setActividad(a.data || []);
    }).catch(() => {
      // fallback demo stats si el endpoint aún no existe
      setStats({ usuarios: 0, tratos: 0, volumen: 0, disputas_abiertas: 0, kyc_pendientes: 0, comisiones_mes: 0, tratos_hoy: 0, registros_hoy: 0 });
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 60000);
    return () => clearInterval(t);
  }, [load]);

  const kpis = stats ? [
    { ico: "👥", bg: "#E6EBF2", l: "Usuarios totales", v: stats.usuarios || 0, sub: `+${stats.registros_hoy || 0} hoy`, page: "usuarios" },
    { ico: "🤝", bg: "var(--cr)", l: "Tratos totales", v: stats.tratos || 0, sub: `${stats.tratos_hoy || 0} hoy`, page: "tratos" },
    { ico: "💰", bg: "var(--cr)", l: "Volumen total", v: fmt(stats.volumen), sub: `${stats.pagos_hoy || 0} pagos hoy`, page: "pagos" },
    { ico: "⚖️", bg: "#FEECEC", l: "Disputas abiertas", v: stats.disputas_abiertas || 0, sub: `${stats.kyc_pendientes || 0} KYC pendientes`, page: "disputas" },
  ] : [];

  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>Panel de Control</h1>
          <p style={{ color: "var(--s600)", fontSize: 12.5, marginTop: 2 }}>Vista general de la plataforma</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "#fff", borderRadius: 8, border: "1px solid var(--s100)", fontSize: 12.5, fontWeight: 600 }}>
          <div className="live" /> Sistema operativo
        </div>
      </div>

      <div className="stat-grid fi">
        {loading
          ? [1,2,3,4].map(i => <div key={i} className="stat"><div style={{ height: 80, background: "var(--s100)", borderRadius: 8 }} /></div>)
          : kpis.map((k, i) => (
            <div key={i} className="stat" onClick={() => setPage?.(k.page)} title={`Abrir ${k.l}`}>
              <div className="stat-ico" style={{ background: k.bg }}>{k.ico}</div>
              <div className="stat-lbl">{k.l}</div>
              <div className="stat-val">{k.v}</div>
              <div className="stat-sub">{k.sub}</div>
            </div>
          ))
        }
      </div>

      <div className="g2" style={{ gap: 14, alignItems: "start" }}>
        {/* Ingresos */}
        <div className="card" style={{ padding: "16px 18px" }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>💰 Comisiones del mes</h3>
          <div style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, color: "var(--g2)", marginBottom: 4 }}>{fmt(stats?.comisiones_mes || 0)}</div>
          <div style={{ fontSize: 12, color: "var(--s600)" }}>Ingresos netos TratoYa</div>
          <div style={{ marginTop: 14, height: 6, background: "var(--s100)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: "62%", height: "100%", background: "linear-gradient(to right,var(--g),var(--g2))", borderRadius: 3 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--s400)", marginTop: 4 }}>
            <span>Meta mensual</span><span>62%</span>
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="card" style={{ padding: "16px 18px" }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>⚡ Actividad reciente · actualiza cada 60s</h3>
          {actividad.length === 0
            ? <div style={{ textAlign: "center", padding: 20, color: "var(--s400)", fontSize: 13 }}>Sin actividad registrada</div>
            : actividad.slice(0, 6).map((a, i) => (
              <div key={i} className="log-item">
                <div className="log-dot" style={{ background: a.tipo === "registro" ? "var(--g2)" : a.tipo === "trato" ? "var(--n)" : a.tipo === "disputa" ? "var(--rd)" : "var(--or)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.descripcion}</div>
                  <div style={{ fontSize: 11, color: "var(--s400)" }}>{timeAgo(a.createdAt)}</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── USUARIOS ─────────────────────────────────────────
function Usuarios({ toast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [kycBusy, setKycBusy] = useState(null); // id del usuario cuyo KYC está cambiando
  const [pwForm, setPwForm] = useState({ password: "", confirmar: "" });
  const [msgForm, setMsgForm] = useState({ titulo: "", cuerpo: "" });

  const load = () => {
    setLoading(true);
    api.get(`/admin/users${q ? `?q=${q}` : ""}`)
      .then(r => setUsers(r.data || []))
      .catch(e => toast(e.message || "Error cargando usuarios", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const resetPassword = async () => {
    if (!pwForm.password || pwForm.password !== pwForm.confirmar) { toast("Las contraseñas no coinciden", "error"); return; }
    if (pwForm.password.length < 6) { toast("Mínimo 6 caracteres", "error"); return; }
    setBusy(true);
    try {
      await api.post(`/admin/users/${selected.id}/reset-password`, { password: pwForm.password });
      toast(`Contraseña restablecida para ${selected.nombre}`, "success");
      setModal(null); setPwForm({ password: "", confirmar: "" });
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const toggleBan = async (user) => {
    setBusy(true);
    try {
      const nuevoEstado = user.estado === "activo" ? "suspendido" : "activo";
      await api.patch(`/admin/users/${user.id}/estado`, { estado: nuevoEstado });
      toast(`Usuario ${nuevoEstado === "suspendido" ? "suspendido" : "reactivado"}`, nuevoEstado === "suspendido" ? "warn" : "success");
      load();
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const toggleKyc = async (user) => {
    const levels = ['ninguno', 'basico', 'verificado', 'premium'];
    const cur = levels.indexOf(user.kyc_nivel || 'ninguno');
    const nextLevel = levels[Math.min(cur + 1, levels.length - 1)] === user.kyc_nivel
      ? levels[Math.max(cur - 1, 0)]
      : levels[Math.min(cur + 1, levels.length - 1)];
    // Ciclo: ninguno → basico → verificado → premium → ninguno
    const cycle = { ninguno: 'basico', basico: 'verificado', verificado: 'premium', premium: 'ninguno' };
    const next = cycle[user.kyc_nivel || 'ninguno'] || 'basico';
    setKycBusy(user.id);
    try {
      const r = await api.patch(`/admin/users/${user.id}/kyc`, { kyc_nivel: next });
      // Actualiza el usuario en la lista local sin recargar toda la tabla
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, kyc_nivel: next, kyc_estado: r.data?.kyc_estado || 'aprobado' } : u));
      toast(`✓ ${user.nombre}: verificación → ${next}`, 'success');
    } catch (e) { toast(e.message, 'error'); }
    setKycBusy(null);
  };

  const sendPush = async () => {
    if (!msgForm.titulo || !msgForm.cuerpo) { toast("Completa título y mensaje", "error"); return; }
    setBusy(true);
    try {
      await api.post(`/admin/users/${selected.id}/notificacion`, msgForm);
      toast(`Notificación enviada a ${selected.nombre}`, "success");
      setModal(null); setMsgForm({ titulo: "", cuerpo: "" });
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const openUserDetail = async (user) => {
    setSelected(user);
    setSelectedDetail(null);
    setModal(null);
    setDetailLoading(true);
    try {
      const r = await api.get(`/admin/users/${user.id}/detalle`);
      setSelectedDetail(r.data);
      setSelected(r.data?.user || user);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = users.filter(u => !q || `${u.nombre} ${u.apellido} ${u.email} ${u.usuario_unico || ""} ${u.cedula || ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 20 }}>Usuarios</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="search" style={{ width: 260 }}>🔍 <input placeholder="Buscar nombre, email, ID o documento…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} /></div>
          <button className="btn bg_" onClick={load}>↻</button>
        </div>
      </div>

      <div className="tw">
        <table>
          <thead><tr><th>#</th><th>Usuario</th><th>Email</th><th>Nombre de usuario</th><th>Identificación</th><th>Banco</th><th>KYC</th><th>Rol</th><th>Estado</th><th>Tratos</th><th>Registro</th><th>Acciones</th></tr></thead>
          <tbody>
            {loading && users.length === 0
              ? <tr><td colSpan={12} style={{ textAlign: "center", padding: 32, color: "var(--s400)" }}><div className="spin" style={{ margin: "0 auto" }} /></td></tr>
              : filtered.length === 0
                ? <tr><td colSpan={12} style={{ textAlign: "center", padding: 28, color: "var(--s400)", fontSize: 13 }}>Sin usuarios</td></tr>
                : filtered.map((u, i) => (
                  <tr key={u.id}>
                    <td style={{ color: "var(--s400)", fontSize: 11 }}>{i + 1}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--n)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne", fontWeight: 800, fontSize: 11, color: "var(--g)", flexShrink: 0 }}>{(u.nombre || "?")[0]}</div>
                        <div>
                          <button className="btn bg_ bsm" style={{ height: "auto", padding: 0, justifyContent: "flex-start", fontWeight: 800, fontSize: 12.5, color: "var(--n)" }} onClick={() => openUserDetail(u)}>{u.nombre} {u.apellido}</button>
                          <div style={{ fontSize: 10.5, color: "var(--s400)" }}>UUID: {u.id?.slice?.(0,8) || u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>{u.email}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{u.usuario_unico || "—"}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{[u.tipo_identificacion, u.cedula].filter(Boolean).join(" ") || "—"}</td>
                    <td style={{ fontSize: 11.5 }}>{(u.CuentaBancarias || u.CuentaBancaria || [])[0]?.banco || "—"}</td>
                    <td>
                      {u.kyc_nivel === 'premium'
                        ? <span style={{display:'inline-flex',alignItems:'center',gap:4,background:'#1877F2',color:'#fff',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>
                            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:14,height:14,background:'#fff',borderRadius:'50%',color:'#1877F2',fontSize:10,fontWeight:900,lineHeight:1,flexShrink:0}}>✓</span>
                            PREMIUM
                          </span>
                        : u.kyc_nivel === 'verificado'
                          ? <span style={{display:'inline-flex',alignItems:'center',gap:4,background:'#1877F2',color:'#fff',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>
                              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:14,height:14,background:'#fff',borderRadius:'50%',color:'#1877F2',fontSize:10,fontWeight:900,lineHeight:1,flexShrink:0}}>✓</span>
                              Verif.
                            </span>
                          : u.kyc_nivel === 'basico'
                            ? <span className="bdg gn" style={{fontSize:10}}>✓ Básico</span>
                            : <span className="bdg bg" style={{fontSize:10}}>Sin verif.</span>}
                    </td>
                    <td><span className={`bdg ${ROLE_BADGE[u.rol] || "bg"}`}>{rolLabel(u.rol)}</span></td>
                    <td><span className={`bdg ${u.estado === "activo" ? "gn" : u.estado === "suspendido" ? "rd" : "bg"}`}>{u.estado}</span></td>
                    <td style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 12.5 }}>{u.total_tratos || 0}</td>
                    <td style={{ fontSize: 11, color: "var(--s400)" }}>{fmtDate(u.createdAt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          className={`btn bsm ${u.kyc_nivel === 'premium' || u.kyc_nivel === 'verificado' ? 'bp' : u.kyc_nivel === 'basico' ? 'bor' : 'bg_'}`}
                          title={`Verificación actual: ${u.kyc_nivel || 'ninguno'}. Clic para cambiar.`}
                          onClick={() => toggleKyc(u)}
                          disabled={kycBusy === u.id}
                          style={{minWidth:28}}
                        >
                          {kycBusy === u.id
                            ? <div className="spin" style={{width:12,height:12}} />
                            : u.kyc_nivel === 'premium' || u.kyc_nivel === 'verificado'
                              ? <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:15,height:15,background:'#1877F2',borderRadius:'50%',color:'#fff',fontSize:11,fontWeight:900,lineHeight:1}}>✓</span>
                              : u.kyc_nivel === 'basico' ? '✓' : '○'}
                        </button>
                        <button className="btn bg_ bsm" title="Ver perfil" onClick={() => openUserDetail(u)}>👁</button>
                        <button className="btn bg_ bsm" title="Restablecer contraseña" onClick={() => { setSelected(u); setModal("pw"); }}>🔑</button>
                        <button className="btn bg_ bsm" title="Enviar notificación" onClick={() => { setSelected(u); setModal("msg"); }}>🔔</button>
                        <button className={`btn bsm ${u.estado === "activo" ? "brd" : "bor"}`} title={u.estado === "activo" ? "Suspender" : "Reactivar"} onClick={() => toggleBan(u)} disabled={busy}>
                          {u.estado === "activo" ? "🚫" : "✅"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* Modal perfil */}
      {selected && !modal && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 860 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 style={{ fontSize: 16 }}>Perfil — {selected.nombre} {selected.apellido}</h3>
              <button className="btn bg_ bsm" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-bd">
              {detailLoading && <div style={{ padding: 20, textAlign: "center", color: "var(--s400)" }}><div className="spin" style={{ margin: "0 auto" }} /></div>}
              <div className="g2" style={{ gap: 10, marginBottom: 14 }}>
                {[["ID interno", selected.id],["Email", selected.email],["Nombre de usuario", selected.usuario_unico ? `@${selected.usuario_unico}` : "—"],["Teléfono", selected.telefono||"—"],["Ciudad", selected.ciudad||"—"],["Identificación", [selected.tipo_identificacion, selected.cedula].filter(Boolean).join(" ") || "—"],["Rol", rolLabel(selected.rol)],["Estado", selected.estado],["KYC", `${selected.kyc_nivel || "—"} / ${selected.kyc_estado || "—"}`],["Plan", selected.plan||"gratuito"],["Tratos", selected.total_tratos||0],["Exitosos", selected.tratos_exitosos||0],["Reputación", `${parseFloat(selected.reputacion||0).toFixed(1)}★`],["Último login", fmtTime(selected.last_login)]].map(([k,v]) => (
                  <div key={k} style={{ background: "var(--s50)", borderRadius: 8, padding: "9px 11px" }}>
                    <div style={{ fontSize: 9.5, color: "var(--s400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "var(--s50)", borderRadius: 8, padding: "9px 11px" }}>
                <div style={{ fontSize: 9.5, color: "var(--s400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 2 }}>Fecha de registro</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(selected.createdAt)}</div>
              </div>
              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: 13, marginBottom: 8 }}>Información bancaria</h4>
                {((selectedDetail?.cuentas_bancarias || selected.CuentaBancaria || selected.CuentaBancariae || selected.CuentaBancarias || []).length)
                  ? (selectedDetail?.cuentas_bancarias || selected.CuentaBancaria || selected.CuentaBancariae || selected.CuentaBancarias).map(a => <div key={a.id} style={{ background: "var(--s50)", borderRadius: 8, padding: "9px 11px", marginBottom: 7, fontSize: 12.5 }}><b>{a.banco}</b> · {a.tipo} · <span className="mono">{String(a.numero || "—")}</span> · {a.titular || "Sin titular"} · {a.cedula_titular || "Sin cédula titular"}</div>)
                  : <div style={{ color: "var(--s400)", fontSize: 12.5 }}>Sin cuenta bancaria registrada.</div>}
              </div>
              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: 13, marginBottom: 8 }}>Historial de tratos</h4>
                {(selectedDetail?.tratos || []).length ? (
                  <div className="tw"><table><thead><tr><th>Código</th><th>Rol</th><th>Título</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
                    {selectedDetail.tratos.map(t => <tr key={t.id}><td className="mono">{t.codigo}</td><td>{t.comprador_id === selected.id ? "Comprador" : "Vendedor"}</td><td>{t.titulo}</td><td>{fmt(t.monto)}</td><td><span className={`bdg ${TRATO_EST[t.estado] || "bg"}`}>{tratoLabel(t.estado)}</span></td><td>{fmtDate(t.createdAt)}</td></tr>)}
                  </tbody></table></div>
                ) : <div style={{ color: "var(--s400)", fontSize: 12.5 }}>Sin tratos registrados.</div>}
              </div>
              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: 13, marginBottom: 8 }}>Pagos del usuario</h4>
                {(selectedDetail?.pagos || []).length ? (
                  <div className="tw"><table><thead><tr><th>Trato</th><th>Tipo</th><th>Monto</th><th>Pasarela</th><th>Estado</th><th>Referencia</th></tr></thead><tbody>
                    {selectedDetail.pagos.map(p => <tr key={p.id}><td>{p.Trato?.codigo || "—"}</td><td>{p.tipo}</td><td>{fmt(p.monto)}</td><td>{p.pasarela}</td><td>{p.estado}</td><td className="mono">{p.pasarela_ref || "—"}</td></tr>)}
                  </tbody></table></div>
                ) : <div style={{ color: "var(--s400)", fontSize: 12.5 }}>Sin pagos registrados.</div>}
              </div>
            </div>
            <div className="modal-ft">
              <button className="btn bpu bsm" onClick={() => setModal("msg")}>🔔 Enviar notificación</button>
              <button className="btn bor bsm" onClick={() => setModal("pw")}>🔑 Resetear contraseña</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reset contraseña */}
      {modal === "pw" && selected && (
        <div className="overlay" onClick={() => { setModal(null); setPwForm({ password: "", confirmar: "" }); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 style={{ fontSize: 15 }}>🔑 Restablecer contraseña</h3>
              <button className="btn bg_ bsm" onClick={() => { setModal(null); setPwForm({ password: "", confirmar: "" }); }}>✕</button>
            </div>
            <div className="modal-bd">
              <div style={{ background: "var(--orb)", border: "1px solid rgba(224,123,0,.2)", borderRadius: 8, padding: "10px 13px", marginBottom: 14, fontSize: 12.5, color: "var(--or)" }}>
                ⚠️ Vas a cambiar la contraseña de <strong>{selected.nombre} {selected.apellido}</strong> ({selected.email})
              </div>
              <div className="fg"><label className="fl">Nueva contraseña</label><input className="inp" type="password" placeholder="Mínimo 6 caracteres" value={pwForm.password} onChange={e => setPwForm(p => ({ ...p, password: e.target.value }))} /></div>
              <div className="fg"><label className="fl">Confirmar contraseña</label><input className="inp" type="password" placeholder="Repite la contraseña" value={pwForm.confirmar} onChange={e => setPwForm(p => ({ ...p, confirmar: e.target.value }))} /></div>
            </div>
            <div className="modal-ft">
              <button className="btn bg_" onClick={() => { setModal(null); setPwForm({ password: "", confirmar: "" }); }}>Cancelar</button>
              <button className="btn bor" onClick={resetPassword} disabled={busy}>{busy ? <div className="spin" /> : "🔑 Restablecer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal enviar notificación */}
      {modal === "msg" && selected && (
        <div className="overlay" onClick={() => { setModal(null); setMsgForm({ titulo: "", cuerpo: "" }); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 style={{ fontSize: 15 }}>🔔 Enviar notificación push</h3>
              <button className="btn bg_ bsm" onClick={() => { setModal(null); setMsgForm({ titulo: "", cuerpo: "" }); }}>✕</button>
            </div>
            <div className="modal-bd">
              <div style={{ fontSize: 12.5, color: "var(--s600)", marginBottom: 13 }}>Para: <strong>{selected.nombre} {selected.apellido}</strong> · {selected.email}</div>
              <div className="fg"><label className="fl">Título</label><input className="inp" placeholder="Ej: Acción requerida en tu trato" value={msgForm.titulo} onChange={e => setMsgForm(p => ({ ...p, titulo: e.target.value }))} /></div>
              <div className="fg"><label className="fl">Mensaje</label><textarea className="inp" rows="3" placeholder="Escribe el mensaje aquí…" value={msgForm.cuerpo} onChange={e => setMsgForm(p => ({ ...p, cuerpo: e.target.value }))} /></div>
            </div>
            <div className="modal-ft">
              <button className="btn bg_" onClick={() => { setModal(null); setMsgForm({ titulo: "", cuerpo: "" }); }}>Cancelar</button>
              <button className="btn bp" onClick={sendPush} disabled={busy}>{busy ? <div className="spin" /> : "🔔 Enviar notificación"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NOTIFICACIONES MASIVAS ───────────────────────────
function Notificaciones({ toast }) {
  const [form, setForm] = useState({ titulo: "", cuerpo: "", segmento: "todos" });
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState([]);
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const enviar = async () => {
    if (!form.titulo || !form.cuerpo) { toast("Completa título y mensaje", "error"); return; }
    setLoading(true);
    try {
      await api.post("/admin/notificaciones/masiva", form);
      toast(`Notificación enviada al segmento: ${form.segmento}`, "success");
      setHistorial(h => [{ ...form, fecha: new Date(), destinatarios: form.segmento === "todos" ? "Todos" : form.segmento }, ...h]);
      setForm({ titulo: "", cuerpo: "", segmento: "todos" });
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  const segmentos = [
    ["todos", "🌐 Todos los usuarios"],
    ["sin_kyc", "🆔 Sin verificar KYC"],
    ["con_trato_activo", "🤝 Con tratos activos"],
    ["sin_trato", "😴 Sin ningún trato"],
    ["disputas_abiertas", "⚖️ Con disputas abiertas"],
  ];

  return (
    <div className="page fi">
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Enviar Notificaciones</h1>
      <div className="g2" style={{ gap: 14, alignItems: "start" }}>
        <div className="card" style={{ padding: "16px 18px" }}>
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>🔔 Nueva notificación push</h3>
          <div className="fg">
            <label className="fl">Segmento de destinatarios</label>
            <select className="inp" value={form.segmento} onChange={e => sf("segmento", e.target.value)}>
              {segmentos.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fl">Título</label><input className="inp" placeholder="Ej: Novedad importante en TratoYa" value={form.titulo} onChange={e => sf("titulo", e.target.value)} /></div>
          <div className="fg"><label className="fl">Mensaje</label><textarea className="inp" rows="4" placeholder="Escribe el mensaje que verán los usuarios…" value={form.cuerpo} onChange={e => sf("cuerpo", e.target.value)} /></div>

          <div style={{ background: "var(--s50)", borderRadius: 9, padding: "11px 13px", marginBottom: 13, border: "1px solid var(--s100)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--s400)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 7 }}>Vista previa</div>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 2 }}>{form.titulo || "Sin título"}</div>
            <div style={{ fontSize: 12.5, color: "var(--s600)", lineHeight: 1.45 }}>{form.cuerpo || "Sin mensaje"}</div>
          </div>

          <button className="btn bp" style={{ width: "100%" }} onClick={enviar} disabled={loading || !form.titulo || !form.cuerpo}>
            {loading ? <><div className="spin" /> Enviando…</> : "📤 Enviar notificación"}
          </button>
        </div>

        <div>
          <div className="card" style={{ padding: "16px 18px", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>📱 SMS (próximamente)</h3>
            <div style={{ padding: "14px", background: "var(--s50)", borderRadius: 9, textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>📲</div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Mensajes de texto</div>
              <div style={{ fontSize: 12, color: "var(--s600)", lineHeight: 1.5 }}>Integración con Twilio o AWS SNS. Disponible en la próxima versión.</div>
              <button className="btn bo bsm" style={{ marginTop: 10 }} disabled>Próximamente</button>
            </div>
          </div>

          <div className="card" style={{ padding: "16px 18px" }}>
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>📜 Historial de envíos</h3>
            {historial.length === 0
              ? <div style={{ textAlign: "center", padding: 20, color: "var(--s400)", fontSize: 12.5 }}>Sin envíos en esta sesión</div>
              : historial.map((h, i) => (
                <div key={i} style={{ padding: "9px 0", borderBottom: "1px solid var(--s100)" }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{h.titulo}</div>
                  <div style={{ fontSize: 11, color: "var(--s400)" }}>{h.destinatarios} · {fmtTime(h.fecha)}</div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DISPUTAS ─────────────────────────────────────────
function Disputas({ toast }) {
  const [disputas, setDisputas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [resolucion, setResolucion] = useState({ fallo: "comprador", notas: "" });
  const [contacto, setContacto] = useState({ destino: "ambos", titulo: "Soporte TratoYA", cuerpo: "" });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("abierta");

  const load = () => {
    setLoading(true);
    api.get("/admin/disputes")
      .then(r => setDisputas(r.data || []))
      .catch(() => toast("Error cargando disputas", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const resolver = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/disputes/${selected.id}/resolver`, resolucion);
      toast("Disputa resuelta. Pago procesado.", "success");
      setSelected(null); load();
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const contactar = async () => {
    if (!contacto.cuerpo.trim()) { toast("Escribe el mensaje para contactar", "error"); return; }
    setBusy(true);
    try {
      await api.post(`/admin/tratos/${selected.Trato?.id}/contactar`, contacto);
      toast("Mensaje enviado al chat y notificaciones.", "success");
      setContacto({ destino: "ambos", titulo: "Soporte TratoYA", cuerpo: "" });
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const filtered = disputas.filter(d => filter === "todas" || d.estado === filter);

  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 20 }}>Disputas</h1>
        <button className="btn bg_" onClick={load}>↻</button>
      </div>

      <div className="tabs">
        {[["abierta","Abiertas"],["en_revision","En revisión"],["resuelta","Resueltas"],["todas","Todas"]].map(([id, l]) => (
          <div key={id} className={`tab ${filter === id ? "act" : ""}`} onClick={() => setFilter(id)}>{l}</div>
        ))}
      </div>

      {loading
        ? <div style={{ textAlign: "center", padding: 40 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></div>
        : filtered.length === 0
          ? <div style={{ textAlign: "center", padding: 36, color: "var(--s400)", fontSize: 13 }}>Sin disputas en esta categoría</div>
          : <div className="tw"><table>
              <thead><tr><th>Trato</th><th>Motivo</th><th>Aperturista</th><th>Estado</th><th>Monto</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 11, color: "var(--g2)" }}>{d.Trato?.codigo || "—"}</td>
                    <td><div className="td-wrap"><div style={{ fontWeight: 600, fontSize: 12.5 }}>{d.motivo}</div><div style={{ fontSize: 11, color: "var(--s400)" }}>{d.descripcion?.slice(0, 90)}{d.descripcion?.length > 90 ? "…" : ""}</div></div></td>
                    <td style={{ fontSize: 12 }}><div className="td-wrap">{d.aperturista?.nombre} {d.aperturista?.apellido}</div></td>
                    <td><span className={`bdg ${DISP_EST[d.estado] || "bg"}`}>{d.estado}</span></td>
                    <td style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 12.5 }}>{fmt(d.Trato?.monto)}</td>
                    <td style={{ fontSize: 11, color: "var(--s400)" }}>{fmtDate(d.createdAt)}</td>
                    <td><button className="btn bp bsm" onClick={() => setSelected(d)}>Revisar</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
      }

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 style={{ fontSize: 15 }}>⚖️ Resolver disputa · {selected.Trato?.codigo}</h3>
              <button className="btn bg_ bsm" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-bd">
              <div className="g2" style={{ marginBottom: 14 }}>
                <div style={{ background: "var(--s50)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9.5, color: "var(--s400)", fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>Comprador</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{selected.Trato?.comprador?.nombre} {selected.Trato?.comprador?.apellido}</div>
                </div>
                <div style={{ background: "var(--s50)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9.5, color: "var(--s400)", fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>Vendedor</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{selected.Trato?.vendedor?.nombre} {selected.Trato?.vendedor?.apellido}</div>
                </div>
              </div>
              <div style={{ background: "var(--rdb)", borderRadius: 8, padding: "10px 13px", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, color: "var(--rd)" }}>{selected.motivo}</div>
                <div style={{ fontSize: 12.5, color: "var(--s600)", lineHeight: 1.5 }}>{selected.descripcion}</div>
              </div>
              <div style={{ background: "var(--cr2)", border: "1px solid rgba(168,196,0,.35)", borderRadius: 10, padding: "12px 13px", marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: "var(--g2)" }}>Contactar participantes</div>
                <div className="g2" style={{ marginBottom: 8 }}>
                  <select className="inp" value={contacto.destino} onChange={e => setContacto(c => ({ ...c, destino: e.target.value }))}>
                    <option value="ambos">Comprador y vendedor</option>
                    <option value="comprador">Solo comprador</option>
                    <option value="vendedor">Solo vendedor</option>
                  </select>
                  <input className="inp" placeholder="Título" value={contacto.titulo} onChange={e => setContacto(c => ({ ...c, titulo: e.target.value }))} />
                </div>
                <textarea className="inp" rows="2" placeholder="Escribe el mensaje que llegará al chat del trato y a notificaciones..." value={contacto.cuerpo} onChange={e => setContacto(c => ({ ...c, cuerpo: e.target.value }))} />
                <button className="btn bo bsm" style={{ marginTop: 8, color: "var(--g2)", borderColor: "rgba(168,196,0,.45)" }} onClick={contactar} disabled={busy}>Enviar mensaje</button>
              </div>
              <div className="fg">
                <label className="fl">Fallo a favor de</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["comprador","🛒 Comprador — devolver dinero"],["vendedor","🏪 Vendedor — liberar pago"],["split","⚖️ División 50/50"]].map(([v, l]) => (
                    <div key={v} onClick={() => setResolucion(r => ({ ...r, fallo: v }))} style={{ flex: 1, border: `2px solid ${resolucion.fallo === v ? "var(--g)" : "var(--s100)"}`, background: resolucion.fallo === v ? "var(--cr)" : "#fff", borderRadius: 8, padding: "9px 8px", cursor: "pointer", fontSize: 12, fontWeight: 600, textAlign: "center", color: resolucion.fallo === v ? "var(--g2)" : "var(--s600)", transition: "all .15s" }}>{l}</div>
                  ))}
                </div>
              </div>
              <div className="fg"><label className="fl">Notas de resolución (quedan registradas)</label><textarea className="inp" rows="3" placeholder="Explica brevemente el fallo para el expediente…" value={resolucion.notas} onChange={e => setResolucion(r => ({ ...r, notas: e.target.value }))} /></div>
            </div>
            <div className="modal-ft">
              <button className="btn bg_" onClick={() => setSelected(null)}>Cancelar</button>
              <button className="btn bp" onClick={resolver} disabled={busy}>{busy ? <div className="spin" /> : "✅ Ejecutar resolución"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TICKETS ──────────────────────────────────────────
function Tickets({ toast }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState("");
  const [crear, setCrear] = useState(false);
  const [newTicket, setNewTicket] = useState({ usuario_email: "", categoria: "general", asunto: "", descripcion: "", prioridad: "media" });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("abierto");

  const load = () => {
    setLoading(true);
    api.get("/admin/tickets")
      .then(r => setTickets(r.data || []))
      .catch(() => toast("Error cargando tickets", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const crearTicket = async () => {
    if (!newTicket.asunto || !newTicket.descripcion) { toast("Completa asunto y descripción", "error"); return; }
    setBusy(true);
    try {
      await api.post("/admin/tickets", newTicket);
      toast("Ticket creado", "success"); setCrear(false); load();
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const responder = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api.post(`/admin/tickets/${selected.id}/respuesta`, { contenido: reply });
      toast("Respuesta enviada al usuario", "success"); setReply(""); load();
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const cambiarEstado = async (id, estado) => {
    try { await api.patch(`/admin/tickets/${id}/estado`, { estado }); toast(`Ticket ${estado}`, "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  };

  const filtered = tickets.filter(t => filter === "todos" || t.estado === filter);
  const PRIO_COLOR = { alta: "rd", media: "or", baja: "bg" };
  const CAT_ICO = { general: "📋", pago: "💳", trato: "🤝", kyc: "🆔", tecnico: "🔧", otro: "❓" };

  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 20 }}>Tickets de Soporte</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn bg_" onClick={load}>↻</button>
          <button className="btn bp" onClick={() => setCrear(true)}>+ Nuevo ticket</button>
        </div>
      </div>

      <div className="tabs">
        {[["abierto","Abiertos"],["en_proceso","En proceso"],["resuelto","Resueltos"],["todos","Todos"]].map(([id, l]) => (
          <div key={id} className={`tab ${filter === id ? "act" : ""}`} onClick={() => setFilter(id)}>{l}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 14 }}>
        <div>
          {loading
            ? <div style={{ textAlign: "center", padding: 40 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></div>
            : filtered.length === 0
              ? <div style={{ textAlign: "center", padding: 36, color: "var(--s400)", fontSize: 13 }}>Sin tickets en esta categoría</div>
              : filtered.map(t => (
                <div key={t.id} className={`ticket ${t.estado}`} onClick={() => setSelected(t)} style={{ borderLeft: `3px solid ${t.estado === "abierto" ? "var(--rd)" : t.estado === "en_proceso" ? "var(--or)" : "var(--g2)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                        <span style={{ fontSize: 14 }}>{CAT_ICO[t.categoria] || "📋"}</span>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{t.asunto}</span>
                        <span className={`bdg ${PRIO_COLOR[t.prioridad] || "bg"}`}>{t.prioridad}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--s600)" }}>{t.descripcion?.slice(0, 80)}…</div>
                      <div style={{ fontSize: 11, color: "var(--s400)", marginTop: 4 }}>{t.usuario?.email || "Sin usuario"} · {timeAgo(t.createdAt)}</div>
                    </div>
                    <div style={{ display: "flex", flex_direction: "column", gap: 4 }}>
                      <span className={`bdg ${t.estado === "abierto" ? "rd" : t.estado === "en_proceso" ? "or" : "gn"}`}>{t.estado}</span>
                    </div>
                  </div>
                </div>
              ))
          }
        </div>

        {/* Panel de respuesta */}
        {selected && (
          <div className="card" style={{ padding: "15px 17px", height: "fit-content", position: "sticky", top: 70 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14 }}>#{selected.id?.slice?.(0, 8) || selected.id} · {selected.asunto}</h3>
              <button className="btn bg_ bsm" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ background: "var(--s50)", borderRadius: 8, padding: "10px 12px", marginBottom: 11 }}>
              <div style={{ fontSize: 11, color: "var(--s400)", marginBottom: 3 }}>De: {selected.usuario?.email || "—"} · {fmtDate(selected.createdAt)}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{selected.descripcion}</div>
            </div>
            {(selected.respuestas || []).map((r, i) => (
              <div key={i} style={{ background: r.es_admin ? "var(--cr)" : "var(--s50)", borderRadius: 8, padding: "9px 11px", marginBottom: 8 }}>
                <div style={{ fontSize: 10.5, color: "var(--s400)", marginBottom: 2 }}>{r.es_admin ? "Admin" : selected.usuario?.nombre} · {timeAgo(r.createdAt)}</div>
                <div style={{ fontSize: 12.5 }}>{r.contenido}</div>
              </div>
            ))}
            <textarea className="inp" rows="3" placeholder="Escribe tu respuesta al usuario…" style={{ marginBottom: 9 }} value={reply} onChange={e => setReply(e.target.value)} />
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <button className="btn bp bsm" style={{ flex: 1 }} onClick={responder} disabled={busy || !reply.trim()}>{busy ? <div className="spin" /> : "📤 Responder"}</button>
              <button className="btn bsm" style={{ background: "var(--cr)", color: "var(--g2)", fontWeight: 700 }} onClick={() => cambiarEstado(selected.id, "resuelto")}>✅ Cerrar</button>
            </div>
            {selected.estado !== "en_proceso" && <button className="btn bor bsm" style={{ width: "100%", marginTop: 6 }} onClick={() => cambiarEstado(selected.id, "en_proceso")}>▶ Marcar en proceso</button>}
          </div>
        )}
      </div>

      {/* Modal crear ticket */}
      {crear && (
        <div className="overlay" onClick={() => setCrear(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd"><h3 style={{ fontSize: 15 }}>🎫 Crear nuevo ticket</h3><button className="btn bg_ bsm" onClick={() => setCrear(false)}>✕</button></div>
            <div className="modal-bd">
              <div className="g2">
                <div className="fg"><label className="fl">Email del usuario</label><input className="inp" placeholder="usuario@correo.com" value={newTicket.usuario_email} onChange={e => setNewTicket(p => ({ ...p, usuario_email: e.target.value }))} /></div>
                <div className="fg"><label className="fl">Categoría</label><select className="inp" value={newTicket.categoria} onChange={e => setNewTicket(p => ({ ...p, categoria: e.target.value }))}>{Object.entries(CAT_ICO).map(([k]) => <option key={k} value={k}>{k}</option>)}</select></div>
              </div>
              <div className="g2">
                <div className="fg"><label className="fl">Prioridad</label><select className="inp" value={newTicket.prioridad} onChange={e => setNewTicket(p => ({ ...p, prioridad: e.target.value }))}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div>
                <div className="fg"><label className="fl">Asunto</label><input className="inp" placeholder="Resumen del problema" value={newTicket.asunto} onChange={e => setNewTicket(p => ({ ...p, asunto: e.target.value }))} /></div>
              </div>
              <div className="fg"><label className="fl">Descripción detallada</label><textarea className="inp" rows="4" value={newTicket.descripcion} onChange={e => setNewTicket(p => ({ ...p, descripcion: e.target.value }))} /></div>
            </div>
            <div className="modal-ft"><button className="btn bg_" onClick={() => setCrear(false)}>Cancelar</button><button className="btn bp" onClick={crearTicket} disabled={busy}>{busy ? <div className="spin" /> : "Crear ticket"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KYC ──────────────────────────────────────────────
function KYCVerificaciones({ toast }) {
  const [kycs, setKycs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notas, setNotas] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/admin/kyc/pendientes")
      .then(r => setKycs(r.data || []))
      .catch(() => toast("Error cargando KYC", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const aprobar = async (id) => {
    setBusy(true);
    try { await api.post(`/admin/kyc/${id}/aprobar`, { notas }); toast("KYC aprobado ✅", "success"); setSelected(null); load(); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const rechazar = async (id) => {
    if (!notas) { toast("Indica el motivo de rechazo", "error"); return; }
    setBusy(true);
    try { await api.post(`/admin/kyc/${id}/rechazar`, { notas }); toast("KYC rechazado", "warn"); setSelected(null); load(); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 style={{ fontSize: 20 }}>Verificaciones KYC pendientes</h1>
        <button className="btn bg_" onClick={load}>↻</button>
      </div>

      {loading
        ? <div style={{ textAlign: "center", padding: 40 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></div>
        : kycs.length === 0
          ? <div style={{ textAlign: "center", padding: 44, color: "var(--s400)" }}><div style={{ fontSize: 40, marginBottom: 10 }}>✅</div><div style={{ fontWeight: 700, fontSize: 15 }}>Sin verificaciones pendientes</div></div>
          : <div className="tw"><table>
              <thead><tr><th>Usuario</th><th>Cédula</th><th>Documentos</th><th>Enviado</th><th>Acciones</th></tr></thead>
              <tbody>
                {kycs.map((k, i) => (
                  <tr key={k.id}>
                    <td><div style={{ fontWeight: 600, fontSize: 12.5 }}>{k.User?.nombre} {k.User?.apellido}</div><div style={{ fontSize: 11, color: "var(--s400)" }}>{k.User?.email}</div></td>
                    <td style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 12 }}>{k.cedula}</td>
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        {k.cedula_frente_url && <a href={k.cedula_frente_url} target="_blank" rel="noreferrer" className="btn bo bsm">📄 Frente</a>}
                        {k.cedula_reverso_url && <a href={k.cedula_reverso_url} target="_blank" rel="noreferrer" className="btn bo bsm">📄 Reverso</a>}
                        {k.selfie_url && <a href={k.selfie_url} target="_blank" rel="noreferrer" className="btn bo bsm">🤳 Selfie</a>}
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--s400)" }}>{timeAgo(k.createdAt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button className="btn bp bsm" onClick={() => { setSelected(k); setNotas(""); }}>Revisar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          }

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd"><h3 style={{ fontSize: 15 }}>🆔 Revisión KYC</h3><button className="btn bg_ bsm" onClick={() => setSelected(null)}>✕</button></div>
            <div className="modal-bd">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{selected.User?.nombre} {selected.User?.apellido}</div>
              <div style={{ fontSize: 12.5, color: "var(--s600)", marginBottom: 13 }}>Cédula: <strong>{selected.cedula}</strong></div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {[["cedula_frente_url","Cédula frente"],["cedula_reverso_url","Cédula reverso"],["selfie_url","Selfie"]].map(([field, lbl]) => selected[field] && (
                  <a key={field} href={selected[field]} target="_blank" rel="noreferrer" className="btn bo bsm">📄 Ver {lbl}</a>
                ))}
              </div>
              <div className="fg"><label className="fl">Notas (requerido para rechazar, opcional para aprobar)</label><textarea className="inp" rows="3" placeholder="Motivo o comentario interno…" value={notas} onChange={e => setNotas(e.target.value)} /></div>
            </div>
            <div className="modal-ft">
              <button className="btn brd" onClick={() => rechazar(selected.id)} disabled={busy}>{busy ? <div className="spin" /> : "✗ Rechazar"}</button>
              <button className="btn bp" onClick={() => aprobar(selected.id)} disabled={busy}>{busy ? <div className="spin" /> : "✓ Aprobar KYC"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TRATOS ADMIN ─────────────────────────────────────
function MiniField({ label, value, mono = false }) {
  return (
    <div style={{ background: "var(--s50)", border: "1px solid var(--s100)", borderRadius: 8, padding: "9px 10px", minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: "var(--s400)", fontWeight: 800, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
      <div className={mono ? "mono" : ""} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--n)", overflowWrap: "anywhere" }}>{value ?? "—"}</div>
    </div>
  );
}

function PersonCard({ title, user }) {
  const doc = [user?.tipo_identificacion, user?.cedula].filter(Boolean).join(" ");
  return (
    <div className="card" style={{ padding: 14 }}>
      <h3 style={{ fontSize: 14, marginBottom: 10 }}>{title}</h3>
      {user ? (
        <div className="g2" style={{ gap: 8 }}>
          <MiniField label="Nombre" value={`${user.nombre || ""} ${user.apellido || ""}`.trim() || "—"} />
          <MiniField label="Nombre de usuario" value={user.usuario_unico ? `@${user.usuario_unico}` : "—"} mono />
          <MiniField label="Email" value={user.email} mono />
          <MiniField label="Teléfono" value={user.telefono || "—"} />
          <MiniField label="Identificación" value={doc || "—"} mono />
          <MiniField label="KYC" value={`${user.kyc_nivel || "—"} / ${user.kyc_estado || "—"}`} />
          <MiniField label="Reputación" value={`${Number(user.reputacion || 0).toFixed(1)}★ · ${user.total_resenas || 0} reseñas`} />
        </div>
      ) : <p style={{ fontSize: 12.5, color: "var(--s400)" }}>Aún no asignado.</p>}
    </div>
  );
}

function AdminTratoDetailModal({ detail, loading, onClose, onRefresh, onLiberar, onCancelar, toast, fullPage = false, backHref = ADMIN_ENTRY_PATH }) {
  const [destino, setDestino] = useState("ambos");
  const [mensaje, setMensaje] = useState("");
  const [sending, setSending] = useState(false);
  const data = detail || {};
  const t = data.trato || {};
  const publicUrl = t.link_compartir ? publicTratoUrl(t.link_compartir) : null;
  const bankAccounts = data.cuentas_bancarias || [];
  const retentionPayment = data.pagos?.find?.((p) => p.tipo === "retencion");
  const manualPayment = t.metadata?.manual_payment || retentionPayment?.metadata || null;
  const adminCalc = t.monto ? calcularComisionUI(parseCopAmount(t.monto), t.quien_paga_comision || "comprador") : null;
  const validateReceipt = async () => {
    if (!retentionPayment?.id) return toast("No hay comprobante pendiente por validar.", "warn");
    try {
      await api.post(`/admin/pagos/${retentionPayment.id}/confirmar`);
      toast("Comprobante validado. El flujo fue actualizado para comprador y vendedor.", "success");
      onRefresh?.();
    } catch (e) { toast(e.message, "error"); }
  };

  const sendMessage = async () => {
    if (!mensaje.trim()) return toast("Escribe un mensaje", "warn");
    setSending(true);
    try {
      await api.post(`/admin/tratos/${t.id}/contactar`, {
        destino,
        titulo: 'Mensaje de "Soporte - TratoYA"',
        cuerpo: mensaje.trim(),
      });
      toast("Mensaje enviado", "success");
      setMensaje("");
      onRefresh?.();
    } catch (e) { toast(e.message, "error"); }
    finally { setSending(false); }
  };

  return (
    <div className={fullPage ? "page fi" : "modal"} style={fullPage ? { padding: 20 } : undefined}>
      <div className={fullPage ? "" : "modal-card"} style={fullPage ? { width: "100%" } : { width: "min(1120px, 96vw)", maxHeight: "92vh" }}>
        <div className="modal-hd">
          <div>
            <h2 style={{ fontSize: 18 }}>{loading ? "Cargando trato…" : `${t.codigo || "Trato"} · ${t.titulo || ""}`}</h2>
            {!loading && <p style={{ fontSize: 12, color: "var(--s400)", marginTop: 3 }}>{t.id}</p>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!loading && <span className={`bdg ${TRATO_EST[t.estado] || "bg"}`}>{tratoLabel(t.estado)}</span>}
            {fullPage ? <a className="btn admin-back-btn" href={backHref}>← Volver</a> : <button className="btn bg_ bsm" onClick={onClose}>×</button>}
          </div>
        </div>
        <div className={fullPage ? "" : "modal-bd"} style={fullPage ? { paddingTop: 14 } : { overflowY: "auto", maxHeight: "calc(92vh - 128px)" }}>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--s400)" }}><div className="spin" style={{ margin: "0 auto" }} /></div> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 12, marginBottom: 12 }}>
                <div className="card" style={{ padding: 14 }}>
                  <h3 style={{ fontSize: 14, marginBottom: 10 }}>Resumen operativo</h3>
                  <div className="g2" style={{ gap: 8 }}>
                    <MiniField label="Monto del trato" value={fmt(t.monto)} />
                    <MiniField label="Comisión TratoYA" value={`${fmt(t.comision_monto)} · 4.5% + IMP`} />
                    <MiniField label="Vendedor recibe" value={fmt(t.monto_neto || t.monto)} />
                    <MiniField label="Quién paga comisión" value={t.quien_paga_comision || "—"} />
                    <MiniField label="Tipo" value={t.tipo || "—"} />
                    <MiniField label="Invitación directa" value={t.metadata?.invitacion_directa ? `Sí · ${t.metadata?.contraparte_usuario_unico || "—"}` : "No"} />
                    <MiniField label="Creado" value={fmtTime(t.createdAt)} />
                    <MiniField label="Expira" value={fmtTime(t.fecha_expiracion)} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: "var(--s400)", fontWeight: 800, textTransform: "uppercase" }}>Descripción</div>
                    <p style={{ fontSize: 12.5, color: "var(--s800)", marginTop: 4, whiteSpace: "pre-wrap" }}>{t.descripcion || "Sin descripción"}</p>
                  </div>
                  {t.quien_paga_comision === "compartida" && adminCalc && (
                    <div className="admin-flow-box" style={{ marginTop: 10 }}>
                      <b>Comisión 50/50 explicada</b>
                      <span>Comprador debe pagar a TratoYA: {fmt(adminCalc.totalPagar)}.</span>
                      <span>Vendedor debe asumir/descontar: {fmt(adminCalc.vendedorComision)}.</span>
                      <span>Valor exacto a transferir al vendedor al liberar: {fmt(adminCalc.vendedorRecibe)}.</span>
                      <span>TratoYA conserva libre el 4.5% base: {fmt(adminCalc.comisionTratoYa)}; el IMP/4x1000 queda cubierto dentro de la comisión total.</span>
                    </div>
                  )}
                </div>
                <div className="card" style={{ padding: 14 }}>
                  <h3 style={{ fontSize: 14, marginBottom: 10 }}>Control admin</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {publicUrl && <a className="btn bg_ bsm" href={publicUrl} target="_blank" rel="noreferrer">Abrir link público</a>}
                    {["pago_retenido","en_entrega","confirmado","pendiente_confirmacion"].includes(t.estado) && <button className="btn bp bsm" onClick={() => onLiberar(t.id)}>Liberar pago</button>}
                    {!["completado","cancelado","expirado"].includes(t.estado) && <button className="btn brd bsm" onClick={() => onCancelar(t.id)}>Cancelar trato</button>}
                    <button className="btn bg_ bsm" onClick={onRefresh}>Actualizar</button>
                  </div>
                  {manualPayment && (
                    <div className="admin-flow-box" style={{ marginBottom: 12 }}>
                      <b>Pago reportado por comprador</b>
                      <span>ID de operación: {manualPayment.payment_reference_required || t.codigo || "—"}</span>
                      <span>Transacción: {manualPayment.transaction_ref || "—"}</span>
                      <span>Método: {manualPayment.method || "—"} · Esperado: {fmt(manualPayment.amount_expected)}</span>
                      {manualPayment.receipt_url && <a href={manualPayment.receipt_url} target="_blank" rel="noreferrer">Abrir comprobante del comprador</a>}
                    </div>
                  )}
                  <div className="admin-unified-flow">
                    {[
                      ["Pago recibido", Boolean(manualPayment), manualPayment ? "Comprobante cargado" : "Pendiente"],
                      ["TratoYA valida", ["pago_retenido","en_entrega","pendiente_confirmacion","confirmado","completado"].includes(t.estado), t.estado === "pago_pendiente" ? "Revisar comprobante" : "Validación"],
                      ["Vendedor entrega", ["en_entrega","pendiente_confirmacion","confirmado","completado"].includes(t.estado), "Entrega"],
                      ["Fondos liberados", t.estado === "completado", "Cierre"],
                    ].map(([label, done, sub]) => (
                      <div key={label} className={`admin-unified-step ${done ? "done" : ""}`}>
                        <i>{done ? "✓" : "•"}</i><b>{label}</b><span>{sub}</span>
                      </div>
                    ))}
                  </div>
                  {t.estado === "pago_pendiente" && retentionPayment?.estado !== "aprobado" && (
                    <button className="btn bp" style={{ width: "100%", marginBottom: 12 }} onClick={validateReceipt}>
                      Validar comprobante y actualizar flujo
                    </button>
                  )}
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    {["comprador","vendedor","ambos"].map(x => <button key={x} className={`btn bsm ${destino === x ? "bp" : "bg_"}`} onClick={() => setDestino(x)}>{x}</button>)}
                  </div>
                  <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Mensaje de soporte para este trato…" style={{ width: "100%", minHeight: 82, border: "1px solid var(--s200)", borderRadius: 8, padding: 10, fontFamily: "inherit", resize: "vertical" }} />
                  <button className="btn bp" style={{ width: "100%", marginTop: 8 }} onClick={sendMessage} disabled={sending}>{sending ? "Enviando…" : "Enviar desde Soporte TratoYA"}</button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <PersonCard title="Vendedor" user={t.vendedor} />
                <PersonCard title="Comprador" user={t.comprador} />
              </div>

              <div className="card" style={{ padding: 14, marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, marginBottom: 10 }}>Información bancaria registrada</h3>
                <div className="tw" style={{ boxShadow: "none" }}>
                  <table>
                    <thead><tr><th>Usuario</th><th>Entidad</th><th>Tipo</th><th>Número</th><th>Titular</th><th>Estado</th></tr></thead>
                    <tbody>
                      {bankAccounts.length ? bankAccounts.map(a => {
                        const owner = a.usuario_id === t.vendedor_id ? "Vendedor" : a.usuario_id === t.comprador_id ? "Comprador" : "Usuario";
                        return <tr key={a.id}>
                          <td>{owner}</td>
                          <td>{a.banco}</td>
                          <td>{a.tipo}</td>
                          <td className="mono">{a.numero || "—"}</td>
                          <td>{a.titular || "—"}</td>
                          <td><span className={`bdg ${a.verificada ? "gn" : "bg"}`}>{a.verificada ? "verificada" : "sin verificar"}</span></td>
                        </tr>;
                      }) : <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--s400)", padding: 18 }}>Sin información bancaria registrada</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card" style={{ padding: 14, marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, marginBottom: 10 }}>Fechas y entrega</h3>
                <div className="g2" style={{ gap: 8 }}>
                  <MiniField label="Activado" value={fmtTime(t.fecha_activado)} />
                  <MiniField label="Pago" value={fmtTime(t.fecha_pago)} />
                  <MiniField label="Enviado" value={fmtTime(t.fecha_entrega)} />
                  <MiniField label="Confirmación" value={fmtTime(t.fecha_confirmacion)} />
                  <MiniField label="Liberación" value={fmtTime(t.fecha_liberacion)} />
                  <MiniField label="Transportadora" value={t.transportadora || "—"} />
                  <MiniField label="Guía" value={t.guia_envio || "—"} mono />
                  <MiniField label="Tracking" value={t.tracking_url || "—"} mono />
                </div>
              </div>

              {[
                ["Pagos registrados", data.pagos, p => [p.tipo, fmt(p.monto), p.pasarela, p.estado, p.referencia_externa || "—", p.metadata?.receipt_url ? <a href={p.metadata.receipt_url} target="_blank" rel="noreferrer">Comprobante</a> : "—", fmtTime(p.createdAt)]],
                ["Intenciones de pago", data.payment_intents, p => [p.provider, p.reference, fmt(p.amount_cop), p.status, p.wompi_transaction_id || p.raw_response?.ref_payco || p.raw_response?.transaction_id || "—", fmtTime(p.updatedAt || p.createdAt || p.updated_at || p.created_at)]],
                ["Eventos pasarela", data.payment_events, e => [e.provider, e.event_type, e.reference, e.status, e.is_valid_signature ? "Firma OK" : "Sin firma/pendiente", fmtTime(e.received_at)]],
                ["Ledger", data.ledger, l => [l.type, fmt((l.amount_cents || 0) / 100), l.description || "—", fmtTime(l.created_at)]],
              ].map(([title, rows = [], map]) => (
                <div key={title} className="card" style={{ padding: 14, marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, marginBottom: 10 }}>{title}</h3>
                  <div className="tw" style={{ boxShadow: "none" }}>
                    <table><tbody>{rows.length ? rows.map((row, i) => <tr key={row.id || i}>{map(row).map((v, j) => <td key={j} style={{ fontSize: 11.5, overflowWrap: "anywhere" }}>{v}</td>)}</tr>) : <tr><td style={{ textAlign: "center", color: "var(--s400)", padding: 18 }}>Sin registros</td></tr>}</tbody></table>
                  </div>
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div className="card" style={{ padding: 14 }}>
                  <h3 style={{ fontSize: 14, marginBottom: 10 }}>Chat y mensajes</h3>
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    {(data.mensajes || []).length ? data.mensajes.map(m => (
                      <div key={m.id} style={{ borderBottom: "1px solid var(--s100)", padding: "8px 0" }}>
                        <div style={{ fontSize: 11, color: "var(--s400)" }}>{fmtTime(m.createdAt)} · {m.remitente ? `${m.remitente.nombre || ""} ${m.remitente.apellido || ""}`.trim() : "Sistema"} · {m.tipo}</div>
                        <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{m.contenido}</div>
                      </div>
                    )) : <p style={{ fontSize: 12.5, color: "var(--s400)" }}>Sin mensajes.</p>}
                  </div>
                </div>
                <div className="card" style={{ padding: 14 }}>
                  <h3 style={{ fontSize: 14, marginBottom: 10 }}>Disputa y reseñas</h3>
                  {data.disputa ? (
                    <div style={{ marginBottom: 12 }}>
                      <span className={`bdg ${DISP_EST[data.disputa.estado] || "bg"}`}>{data.disputa.estado}</span>
                      <p style={{ fontSize: 12.5, marginTop: 7, fontWeight: 700 }}>{data.disputa.motivo}</p>
                      <p style={{ fontSize: 12, color: "var(--s600)", whiteSpace: "pre-wrap" }}>{data.disputa.descripcion}</p>
                    </div>
                  ) : <p style={{ fontSize: 12.5, color: "var(--s400)", marginBottom: 12 }}>Sin disputa abierta.</p>}
                  {(data.resenas || []).length ? data.resenas.map(r => (
                    <div key={r.id} style={{ borderTop: "1px solid var(--s100)", padding: "8px 0" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800 }}>{"★".repeat(r.calificacion)}{"☆".repeat(5 - r.calificacion)}</div>
                      <div style={{ fontSize: 11, color: "var(--s400)" }}>{r.autor?.email} → {r.destinatario?.email}</div>
                      <p style={{ fontSize: 12.5 }}>{r.comentario || "Sin comentario"}</p>
                    </div>
                  )) : <p style={{ fontSize: 12.5, color: "var(--s400)" }}>Sin reseñas.</p>}
                </div>
              </div>

              <div className="card" style={{ padding: 14 }}>
                <h3 style={{ fontSize: 14, marginBottom: 10 }}>Notas internas y auditoría</h3>
                <p style={{ fontSize: 12.5, whiteSpace: "pre-wrap", marginBottom: 10 }}>{t.notas_internas || "Sin notas internas."}</p>
                <div style={{ maxHeight: 210, overflowY: "auto" }}>
                  {(data.audit_logs || []).length ? data.audit_logs.map(l => (
                    <div key={l.id} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, borderTop: "1px solid var(--s100)", padding: "7px 0", fontSize: 11.5 }}>
                      <span style={{ color: "var(--s400)" }}>{fmtTime(l.created_at)}</span>
                      <span><b>{l.action}</b> · {JSON.stringify(l.metadata || {})}</span>
                    </div>
                  )) : <p style={{ fontSize: 12.5, color: "var(--s400)" }}>Sin auditoría asociada.</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TratosAdmin({ toast }) {
  const [tratos, setTratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = () => {
    setLoading(true);
    api.get(`/admin/tratos${q ? `?q=${q}` : ""}`)
      .then(r => setTratos(r.data || []))
      .catch(() => toast("Error", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openDetail = async (id) => {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const r = await api.get(`/admin/tratos/${id}/detalle`);
      setDetail(r.data);
    } catch (e) {
      toast(e.message, "error");
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detailId) return;
    try {
      const r = await api.get(`/admin/tratos/${detailId}/detalle`);
      setDetail(r.data);
    } catch (e) { toast(e.message, "error"); }
  };

  const forzarCancelar = async (id) => {
    if (!confirm("¿Cancelar este trato? El dinero será devuelto al comprador.")) return;
    try { await api.post(`/admin/tratos/${id}/cancelar`); toast("Trato cancelado", "warn"); load(); refreshDetail(); }
    catch (e) { toast(e.message, "error"); }
  };

  const forzarLiberar = async (id) => {
    if (!confirm("¿Liberar el pago al vendedor forzadamente?")) return;
    try { await api.post(`/admin/tratos/${id}/liberar`); toast("Pago liberado", "success"); load(); refreshDetail(); }
    catch (e) { toast(e.message, "error"); }
  };

  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 20 }}>Todos los Tratos</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="search" style={{ width: 220 }}>🔍 <input placeholder="Código o título…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} /></div>
          <button className="btn bg_" onClick={load}>↻</button>
        </div>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th>Código</th><th>Título</th><th>Vendedor</th><th>Comprador</th><th>Monto</th><th>Tipo envío</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody>
            {loading
              ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 32 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></td></tr>
              : tratos.map(t => (
                <tr key={t.id} onClick={() => { window.location.href = `${ADMIN_ENTRY_PATH}?trato=${encodeURIComponent(t.id)}&from=tratos`; }} style={{ cursor: "pointer" }}>
                  <td style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 11, color: "var(--g2)" }}>{t.codigo}</td>
                  <td style={{ fontWeight: 600, fontSize: 12.5, maxWidth: 180 }}>{t.titulo}</td>
                  <td style={{ fontSize: 12 }}>{t.vendedor?.nombre} {t.vendedor?.apellido}<div className="mono" style={{ fontSize: 10, color: "var(--s400)" }}>{t.vendedor?.usuario_unico || "—"}</div></td>
                  <td style={{ fontSize: 12 }}>{t.comprador?.nombre} {t.comprador?.apellido || <span style={{ color: "var(--s400)", fontStyle: "italic" }}>—</span>}<div className="mono" style={{ fontSize: 10, color: "var(--s400)" }}>{t.comprador?.usuario_unico || "—"}</div></td>
                  <td style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 12.5 }}>{fmt(t.monto)}</td>
                  <td><span className={`bdg ${t.metadata?.invitacion_directa ? "gn" : "bg"}`}>{t.metadata?.invitacion_directa ? "Directo por ID" : "Link / QR"}</span></td>
                  <td><span className={`bdg ${TRATO_EST[t.estado] || "bg"}`}>{tratoLabel(t.estado)}</span></td>
                  <td style={{ fontSize: 11, color: "var(--s400)" }}>{fmtDate(t.createdAt)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <a className="btn bg_ bsm" href={`${ADMIN_ENTRY_PATH}?trato=${encodeURIComponent(t.id)}&from=tratos`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>👁 Detalle</a>
                      {["pago_retenido","en_entrega","confirmado"].includes(t.estado) && <button className="btn bp bsm" onClick={(e) => { e.stopPropagation(); forzarLiberar(t.id); }}>💰 Liberar</button>}
                      {!["completado","cancelado","expirado"].includes(t.estado) && <button className="btn brd bsm" onClick={(e) => { e.stopPropagation(); forzarCancelar(t.id); }}>✕</button>}
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TratoAdminFullPage({ tratoId, toast, backHref }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!tratoId) return;
    setLoading(true);
    api.get(`/admin/tratos/${tratoId}/detalle`)
      .then(r => setDetail(r.data))
      .catch(e => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [tratoId, toast]);

  useEffect(load, [load]);

  const forzarCancelar = async (id) => {
    if (!confirm("¿Cancelar este trato? El dinero será devuelto al comprador.")) return;
    try { await api.post(`/admin/tratos/${id}/cancelar`); toast("Trato cancelado", "warn"); load(); }
    catch (e) { toast(e.message, "error"); }
  };

  const forzarLiberar = async (id) => {
    if (!confirm("¿Liberar el pago al vendedor forzadamente?")) return;
    try { await api.post(`/admin/tratos/${id}/liberar`); toast("Pago liberado", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  };

  return <AdminTratoDetailModal detail={detail} loading={loading} onRefresh={load} onLiberar={forzarLiberar} onCancelar={forzarCancelar} toast={toast} fullPage backHref={backHref} />;
}

// ─── PAGOS ADMIN ──────────────────────────────────────
let adminPagosCache = [];

function PagosAdmin({ toast }) {
  const [pagos, setPagos] = useState(adminPagosCache);
  const [loading, setLoading] = useState(adminPagosCache.length === 0);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [payPanel, setPayPanel] = useState("recientes");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [releaseRef, setReleaseRef] = useState("");
  const [releaseReceipt, setReleaseReceipt] = useState(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.get(`/admin/pagos${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then(r => {
        adminPagosCache = r.data || [];
        setPagos(adminPagosCache);
        setLastSync(new Date());
      })
      .catch(() => toast("Error cargando pagos", "error"))
      .finally(() => setLoading(false));
  }, [q, toast]);

  useEffect(() => {
    load(adminPagosCache.length > 0);
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [load]);

  const confirmar = async (p) => {
    setConfirmTarget(p);
  };

  const confirmarPago = async () => {
    const p = confirmTarget;
    if (!p) return;
    setBusy(true);
    try {
      await api.post(`/admin/pagos/${p.id}/confirmar`);
      toast("Pago confirmado. Vendedor notificado para entregar.", "success");
      setConfirmTarget(null);
      await load(true);
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  const rechazar = async (p) => {
    if (!confirm(`¿Marcar como fallido el pago del trato ${p.Trato?.codigo || ""}? El comprador deberá esperar 10 minutos.`)) return;
    setBusy(true);
    try {
      await api.post(`/admin/pagos/${p.id}/rechazar`);
      toast("Pago rechazado. Reintento bloqueado por 10 minutos.", "warn");
      await load(true);
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  const liberar = async (p) => {
    setReleaseTarget(p);
    setReleaseRef("");
    setReleaseReceipt(null);
  };

  const confirmarLiberacion = async () => {
    const p = releaseTarget;
    if (!p) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("referencia_liberacion", releaseRef.trim());
      if (releaseReceipt) fd.append("release_receipt", releaseReceipt);
      await api.upload(`/admin/tratos/${p.trato_id}/liberar`, fd);
      toast("Pago liberado. Se notificó reflejo máximo en 1 hora.", "success");
      setReleaseTarget(null);
      await load(true);
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  const estadoCls = (estado) => estado === "aprobado" ? "gn" : ["pendiente", "procesando"].includes(estado) ? "or" : "rd";
  const porConsignar = pagos.filter((p) => p.tipo === "retencion" && p.estado === "aprobado" && ["pago_retenido","en_entrega","confirmado","pendiente_confirmacion"].includes(p.Trato?.estado));
  const sellerAmount = (p) => Number(p.neto_desembolso || p.Trato?.monto_neto || p.Trato?.monto || 0);
  const freeGain = (p) => Math.round(Number(p.Trato?.monto || 0) * 0.045);
  const coveredCosts = (p) => Math.max(0, Number(p.monto || 0) - sellerAmount(p) - freeGain(p));
  const recentIncoming = pagos
    .filter((p) => p.tipo === "retencion" && ["pendiente","procesando"].includes(p.estado))
    .slice(0, 6);
  const allReleasedHistory = pagos
    .filter((p) => p.tipo === "liberacion" || p.estado === "liberado");
  const releasedHistory = allReleasedHistory
    .filter((p) => {
      const d = new Date(p.createdAt);
      if (historyFrom && d < new Date(`${historyFrom}T00:00:00`)) return false;
      if (historyTo && d > new Date(`${historyTo}T23:59:59`)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalPorConsignar = porConsignar.reduce((sum, p) => sum + sellerAmount(p), 0);
  const totalLiberado = releasedHistory.reduce((sum, p) => sum + Number(p.monto || 0), 0);
  const panelItems = [
    ["recientes", "Pagos recién recibidos", recentIncoming.length, "Validación inmediata"],
    ["consignar", "Por consignar", porConsignar.length, fmt(totalPorConsignar)],
    ["historial", "Historial de consignaciones", allReleasedHistory.length, "Filtrado por fechas"],
    ["todos", "Todos los movimientos", pagos.length, "Tabla completa"],
  ];
  const filterItems = [
    ["todos", "Todos", pagos.length],
    ["recientes", "Recién recibidos", recentIncoming.length],
    ["consignar", "Por consignar", porConsignar.length],
    ["aprobados", "Confirmados", pagos.filter((p) => p.estado === "aprobado").length],
    ["fallidos", "Fallidos", pagos.filter((p) => p.estado === "rechazado").length],
    ["historial", "Historial", allReleasedHistory.length],
  ];
  const filteredPagos = pagos.filter((p) => {
    if (statusFilter === "recientes") return p.tipo === "retencion" && ["pendiente","procesando"].includes(p.estado);
    if (statusFilter === "consignar") return porConsignar.some((x) => x.id === p.id);
    if (statusFilter === "aprobados") return p.estado === "aprobado";
    if (statusFilter === "fallidos") return p.estado === "rechazado";
    if (statusFilter === "historial") return allReleasedHistory.some((x) => x.id === p.id);
    return true;
  });

  return (
    <div className="page fi">
      {confirmTarget && (
        <div className="overlay">
          <div className="modal trato-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-hd">
              <div>
                <h3>Confirmar pago recibido</h3>
                <p>Verifica en Nequi/Bre-B antes de aprobar.</p>
              </div>
              <button className="btn bg_ bsm" onClick={() => setConfirmTarget(null)}>×</button>
            </div>
            <div className="confirm-pay-body">
              <div className="confirm-pay-icon">✓</div>
              <h2>{confirmTarget.Trato?.codigo || "Trato"}</h2>
              <p>Confirma que recibiste exactamente <strong>{fmt(confirmTarget.monto)}</strong>.</p>
              {confirmTarget.metadata?.receipt_url && <a className="btn bo" href={confirmTarget.metadata.receipt_url} target="_blank" rel="noreferrer">Abrir comprobante</a>}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: 16 }}>
              <button className="btn bg_" onClick={() => setConfirmTarget(null)}>Cancelar</button>
              <button className="btn bp" disabled={busy} onClick={confirmarPago}>{busy ? <div className="spin" /> : "Sí, confirmar recibido"}</button>
            </div>
          </div>
        </div>
      )}
      {releaseTarget && (
        <div className="overlay">
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-hd">
              <div>
                <h3>Liberar fondos al vendedor</h3>
                <p style={{ fontSize: 12, color: "var(--s500)" }}>{releaseTarget.Trato?.codigo} · {fmt(sellerAmount(releaseTarget))}</p>
              </div>
              <button className="btn bg_ bsm" onClick={() => setReleaseTarget(null)}>×</button>
            </div>
            <div style={{ padding: 16 }}>
              <div className="fg"><label className="fl">Referencia de transferencia</label><input className="inp" value={releaseRef} onChange={(e) => setReleaseRef(e.target.value)} placeholder="Referencia de Nequi/Bre-B" /></div>
              <div className="fg">
                <label className="fl">Comprobante de consignación al vendedor</label>
                <label className="file-pick">
                  <input type="file" accept="image/*,.pdf" onChange={(e) => setReleaseReceipt(e.target.files?.[0] || null)} />
                  <span>Examinar...</span>
                  <strong>{releaseReceipt?.name || "No se ha seleccionado ningún archivo."}</strong>
                </label>
              </div>
              <div className="admin-flow-box">TratoYA notificará al vendedor que el dinero fue consignado y adjuntará el comprobante si lo cargas.</div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: 16, borderTop: "1px solid var(--s100)" }}>
              <button className="btn bg_" onClick={() => setReleaseTarget(null)}>Cancelar</button>
              <button className="btn bp" disabled={busy} onClick={confirmarLiberacion}>{busy ? <div className="spin" /> : "Liberar y notificar"}</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20 }}>Pagos y Retiros</h1>
          <p style={{ fontSize: 12, color: "var(--s500)", marginTop: 3 }}>Cola en vivo de pagos reportados. Actualiza cada 60s.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="search" style={{ width: 240 }}>🔍 <input placeholder="Número del trato…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} /></div>
          <button className="btn bg_" onClick={() => load()}>↻</button>
          {lastSync && <span style={{ fontSize: 11, color: "var(--s400)" }}>Sync {lastSync.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      </div>
      <div className="pay-admin-menu">
        {panelItems.map(([key, label, count, sub]) => (
          <button key={key} className={`pay-admin-tab ${payPanel === key ? "active" : ""}`} onClick={() => setPayPanel(key)}>
            <span>{label}</span>
            <strong>{count}</strong>
            <em>{sub}</em>
          </button>
        ))}
      </div>
      {payPanel === "todos" && (
        <div className="pay-admin-filters">
          {filterItems.map(([key, label, count]) => (
            <button key={key} className={`btn bsm ${statusFilter === key ? "bp" : "bg_"}`} onClick={() => setStatusFilter(key)}>
              {label} <span className="mono" style={{ opacity: .72 }}>{count}</span>
            </button>
          ))}
        </div>
      )}
      {payPanel === "recientes" && <div className="card live-payments">
        <div className="live-payments-head">
          <div>
            <h2>Pagos recién recibidos</h2>
            <p>Se actualiza automáticamente cada 60 segundos para validar lo que acaba de entrar sin saturar la base.</p>
          </div>
          <span className="live-pill"><i /> En vivo</span>
        </div>
        {recentIncoming.length === 0 ? (
          <div className="empty-mini">No hay pagos nuevos por revisar en este momento.</div>
        ) : (
          <div className="live-payments-list">
            {recentIncoming.map((p) => (
              <div className="live-payment-row" key={`live-${p.id}`} onClick={() => setSelected(p)}>
                <div>
                  <b>{p.Trato?.codigo || "Trato"}</b>
                  <span>{p.Trato?.titulo || "Pago"} · {timeAgo(p.createdAt)}</span>
                </div>
                <strong>{fmt(p.monto)}</strong>
                <div className="live-actions">
                  <button className="btn bp bsm" disabled={busy} onClick={(e) => { e.stopPropagation(); confirmar(p); }}>Confirmar</button>
                  <button className="btn brd bsm" disabled={busy} onClick={(e) => { e.stopPropagation(); rechazar(p); }}>Fallido</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal admin-payment-flow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-hd">
              <div>
                <h2 style={{ fontSize: 17 }}>{selected.Trato?.codigo || "Trato"} · Flujo de pago</h2>
                <p style={{ fontSize: 12, color: "var(--s500)" }}>{selected.Trato?.titulo || "Sin título"}</p>
              </div>
              <button className="btn bg_ bsm" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="modal-bd">
              <div className="admin-flow-grid">
                <MiniField label="Monto recibido esperado" value={fmt(selected.monto)} />
                <MiniField label="Referencia transferencia" value={selected.pasarela_ref || "—"} mono />
                <MiniField label="Método" value={selected.metadata?.method || selected.metodo_pago || selected.pasarela || "—"} />
                <MiniField label="Estado del pago" value={selected.estado} />
                <MiniField label="Comprador" value={`${selected.Trato?.comprador?.nombre || selected.User?.nombre || ""} ${selected.Trato?.comprador?.apellido || selected.User?.apellido || ""}`.trim() || "—"} />
                <MiniField label="Vendedor" value={`${selected.Trato?.vendedor?.nombre || ""} ${selected.Trato?.vendedor?.apellido || ""}`.trim() || "—"} />
                <MiniField label="Vendedor recibe" value={fmt(selected.neto_desembolso || selected.Trato?.monto_neto || selected.Trato?.monto)} />
                <MiniField label="Llave reportada" value={selected.metadata?.transaction_ref || selected.pasarela_ref || "—"} mono />
              </div>
              <div className="admin-flow-box">
                <b>Verificación del pago</b>
                <span>1. Busca en Nequi/Bre-B la referencia {selected.pasarela_ref || selected.metadata?.transaction_ref || "reportada"}.</span>
                <span>2. Confirma que llegó exactamente {fmt(selected.monto)} para {selected.Trato?.codigo || "el trato"}.</span>
                <span>3. Al confirmar, el vendedor recibe notificación para entregar. Al liberar, ambos ven que se refleja máximo en 1 hora.</span>
                {selected.metadata?.transfer_concept && <span>Concepto enviado: {selected.metadata.transfer_concept}</span>}
                {selected.metadata?.receipt_url && <a href={selected.metadata.receipt_url} target="_blank" rel="noreferrer">Abrir comprobante adjunto</a>}
                {selected.metadata?.release_receipt_url && <a href={selected.metadata.release_receipt_url} target="_blank" rel="noreferrer">Abrir comprobante de consignación al vendedor</a>}
                {selected.metadata?.notes && <span>Nota comprador: {selected.metadata.notes}</span>}
              </div>
              {selected.Trato?.metadata || selected.Trato ? (
                selected.Trato?.estado && selected.Trato?.monto && selected.Trato?.monto_neto && (
                  <div className="admin-flow-box" style={{ marginTop: 10 }}>
                    <b>Valores de liberación</b>
                    <span>Valor exacto al vendedor: {fmt(sellerAmount(selected))}.</span>
                    <span>Ganancia libre TratoYA 4.5%: {fmt(freeGain(selected))}.</span>
                    <span>IMP/4x1000 cubierto dentro de comisión: {fmt(coveredCosts(selected))}.</span>
                    {selected.Trato?.metadata?.manual_payment?.commission_visible && <span>Comisión total cobrada: {fmt(selected.Trato.metadata.manual_payment.commission_visible)}.</span>}
                  </div>
                )
              ) : null}
            </div>
            <div className="modal-ft" style={{ flexWrap: "wrap" }}>
              {selected.tipo === "retencion" && selected.estado !== "aprobado" && <button className="btn bp" disabled={busy} onClick={() => confirmar(selected)}>Confirmar recibido</button>}
              {selected.tipo === "retencion" && ["pendiente","procesando"].includes(selected.estado) && <button className="btn brd" disabled={busy} onClick={() => rechazar(selected)}>Marcar fallido</button>}
              {["pago_retenido","en_entrega","confirmado","pendiente_confirmacion"].includes(selected.Trato?.estado) && <button className="btn bp" disabled={busy} onClick={() => liberar(selected)}>LIBERAR</button>}
              <a className="btn bg_" href={`${ADMIN_ENTRY_PATH}?trato=${encodeURIComponent(selected.trato_id)}&from=pagos`} target="_blank" rel="noreferrer">Ver trato completo</a>
            </div>
          </div>
        </div>
      )}
      {payPanel === "consignar" && (
        <div className="card admin-payment-detail">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 16 }}>Transferencias pendientes por consignar al vendedor</h2>
              <p style={{ fontSize: 12, color: "var(--s500)", marginTop: 3 }}>Total exacto pendiente: <b>{fmt(totalPorConsignar)}</b></p>
            </div>
            <span className="bdg or">{porConsignar.length} pendientes</span>
          </div>
          {porConsignar.length === 0 ? <div className="empty-mini">No hay consignaciones pendientes.</div> : (
            <div className="tw" style={{ boxShadow: "none" }}>
              <table>
                <thead><tr><th>Trato</th><th>Vendedor</th><th>Valor exacto a transferir</th><th>Ganancia libre 4.5%</th><th>Costos cubiertos</th><th>Acción</th></tr></thead>
                <tbody>
                  {porConsignar.map((p) => (
                    <tr key={`release-${p.id}`} onClick={() => setSelected(p)} style={{ cursor: "pointer" }}>
                      <td><b className="mono">{p.Trato?.codigo}</b><div style={{ fontSize: 11, color: "var(--s500)" }}>{p.Trato?.titulo}</div></td>
                      <td>{p.Trato?.vendedor?.nombre} {p.Trato?.vendedor?.apellido}<div className="mono" style={{ fontSize: 10, color: "var(--s400)" }}>{p.Trato?.vendedor?.usuario_unico || p.Trato?.vendedor?.email}</div></td>
                      <td style={{ fontFamily: "Syne", fontWeight: 800, color: "var(--g2)" }}>{fmt(sellerAmount(p))}</td>
                      <td style={{ fontWeight: 800 }}>{fmt(freeGain(p))}</td>
                      <td>{fmt(coveredCosts(p))}</td>
                      <td><button className="btn bp bsm" disabled={busy} onClick={(e) => { e.stopPropagation(); liberar(p); }}>LIBERAR</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {payPanel === "historial" && <div className="card admin-payment-detail admin-history-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Historial de liberaciones</h2>
            <p style={{ fontSize: 12, color: "var(--s500)", marginTop: 3 }}>Pagos al vendedor ya marcados como completados. Total registrado: <b>{fmt(totalLiberado)}</b></p>
          </div>
          <div className="history-date-filters">
            <input className="inp" type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
            <input className="inp" type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
            <button className="btn bg_ bsm" onClick={() => { setHistoryFrom(""); setHistoryTo(""); }}>Limpiar</button>
          </div>
        </div>
        {releasedHistory.length === 0 ? (
          <div className="empty-mini">Todavía no hay liberaciones registradas.</div>
        ) : (
          <div className="tw" style={{ boxShadow: "none" }}>
            <table>
              <thead><tr><th>Trato</th><th>Vendedor</th><th>Monto liberado</th><th>Referencia</th><th>Fecha</th></tr></thead>
              <tbody>
                {releasedHistory.map((p) => (
                  <tr key={`history-${p.id}`} onClick={() => setSelected(p)} style={{ cursor: "pointer" }}>
                    <td><b className="mono">{p.Trato?.codigo || "—"}</b><div style={{ fontSize: 11, color: "var(--s500)" }}>{p.Trato?.titulo || "—"}</div></td>
                    <td>{p.Trato?.vendedor?.nombre} {p.Trato?.vendedor?.apellido}</td>
                    <td style={{ fontFamily: "Syne", fontWeight: 800, color: "var(--g2)" }}>{fmt(p.monto)}</td>
                    <td><span className="mono" style={{ fontSize: 11 }}>{p.referencia_externa || p.pasarela_ref || "—"}</span></td>
                    <td style={{ fontSize: 11, color: "var(--s400)" }}>{fmtTime(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}
      {payPanel === "todos" && <div className="tw">
        <table>
          <thead><tr><th>Trato</th><th>Usuario</th><th>Tipo</th><th>Monto</th><th>Método</th><th>Ref. externa</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody>
            {loading
              ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 32 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></td></tr>
              : filteredPagos.length === 0
                ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 28, color: "var(--s500)", fontSize: 12.5 }}>No hay pagos para este filtro.</td></tr>
              : filteredPagos.map((p) => (
                <tr key={p.id} onClick={() => setSelected(p)} style={{ cursor: "pointer" }}>
                  <td style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 11, color: "var(--g2)" }}>{p.Trato?.codigo || "—"}</td>
                  <td style={{ fontSize: 12 }}>{p.User?.nombre} {p.User?.apellido}</td>
                  <td style={{ fontSize: 12 }}>{p.tipo}</td>
                  <td style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 12.5 }}>{fmt(p.monto)}</td>
                  <td style={{ fontSize: 12 }}>{p.metadata?.method || p.metodo_pago || p.pasarela}</td>
                  <td><span className="mono" style={{ fontSize: 11, color: "var(--s400)" }}>{p.referencia_externa?.slice?.(0, 16) || "—"}</span></td>
                  <td><span className={`bdg ${estadoCls(p.estado)}`}>{p.estado}</span></td>
                  <td style={{ fontSize: 11, color: "var(--s400)" }}>{fmtDate(p.createdAt)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      <button className="btn bg_ bsm" onClick={(e) => { e.stopPropagation(); setSelected(p); }}>Ver flujo</button>
                      {p.tipo === "retencion" && p.estado !== "aprobado" && <button className="btn bp bsm" disabled={busy} onClick={(e) => { e.stopPropagation(); confirmar(p); }}>Confirmar</button>}
                      {p.tipo === "retencion" && ["pendiente","procesando"].includes(p.estado) && <button className="btn brd bsm" disabled={busy} onClick={(e) => { e.stopPropagation(); rechazar(p); }}>Fallido</button>}
                      {["pago_retenido","en_entrega","confirmado","pendiente_confirmacion"].includes(p.Trato?.estado) && <button className="btn bp bsm" disabled={busy} onClick={(e) => { e.stopPropagation(); liberar(p); }}>LIBERAR</button>}
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>}
    </div>
  );
}

// ─── LOGS ────────────────────────────────────────────
function Logs({ toast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/admin/logs").then(r => setLogs(r.data || [])).catch(() => setLogs([])).finally(() => setLoading(false));
  }, []);
  const lvlColor = { error: "rd", warn: "or", info: "nb", debug: "bg" };
  return (
    <div className="page fi">
      <h1 style={{ fontSize: 20, marginBottom: 14 }}>Logs del sistema</h1>
      <div style={{ background: "#0D1F38", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(255,255,255,.06)", maxHeight: 520, overflowY: "auto" }}>
        {loading ? <div style={{ color: "rgba(255,255,255,.4)", textAlign: "center", padding: 32 }}><div className="spin" style={{ margin: "0 auto" }} /></div>
          : logs.length === 0
            ? <div style={{ color: "rgba(255,255,255,.3)", textAlign: "center", padding: 32, fontSize: 13 }}>Sin logs disponibles o endpoint pendiente</div>
            : logs.map((l, i) => (
              <div key={i} style={{ fontFamily: "JetBrains Mono", fontSize: 11.5, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.04)", display: "flex", gap: 12 }}>
                <span style={{ color: "rgba(255,255,255,.25)", minWidth: 160 }}>{l.timestamp || l.createdAt}</span>
                <span className={`bdg ${lvlColor[l.level] || "bg"}`} style={{ flexShrink: 0 }}>{l.level}</span>
                <span style={{ color: "rgba(255,255,255,.7)" }}>{l.message}</span>
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ─── CONFIGURACIÓN ────────────────────────────────────
function Configuracion({ toast }) {
  const [config, setConfig] = useState({ comision_min: "1500", limite_diario: "50000000", dias_inspeccion_default: "7", mantenimiento: false });
  const [loading, setLoading] = useState(false);
  const sc = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  const guardar = async () => {
    setLoading(true);
    try { await api.put("/admin/configuracion", config); toast("Configuración guardada", "success"); }
    catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  return (
    <div className="page fi">
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Configuración del sistema</h1>
      <div style={{ maxWidth: 560 }}>
        <div className="card" style={{ padding: "18px 20px", marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>💰 Comisiones</h3>
          <div className="fg"><label className="fl">Comisión mínima (COP)</label><input className="inp" type="number" value={config.comision_min} onChange={e => sc("comision_min", e.target.value)} /></div>
          <div className="fg"><label className="fl">Límite diario por usuario (COP)</label><input className="inp" type="number" value={config.limite_diario} onChange={e => sc("limite_diario", e.target.value)} /></div>
        </div>

        <div className="card" style={{ padding: "18px 20px", marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>⚙️ Modo mantenimiento</h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Activar modo mantenimiento</div>
              <div style={{ fontSize: 12, color: "var(--s600)" }}>Bloquea todas las operaciones de pago temporalmente</div>
            </div>
            <div onClick={() => sc("mantenimiento", !config.mantenimiento)} style={{ width: 44, height: 24, borderRadius: 12, background: config.mantenimiento ? "var(--g)" : "var(--s200)", cursor: "pointer", position: "relative", transition: "background .2s" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: config.mantenimiento ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
            </div>
          </div>
        </div>

        <button className="btn bp blg" style={{ width: "100%" }} onClick={guardar} disabled={loading}>
          {loading ? <><div className="spin" /> Guardando…</> : "💾 Guardar configuración"}
        </button>
      </div>
    </div>
  );
}

// ─── Actividad en vivo ────────────────────────────────
function ResenasAdmin({ toast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/reviews")
      .then(r => setItems(r.data || []))
      .catch(() => toast("Error cargando reseñas", "error"))
      .finally(() => setLoading(false));
  }, [toast]);
  useEffect(load, [load]);
  const avg = items.length ? items.reduce((s, r) => s + Number(r.calificacion || 0), 0) / items.length : 0;
  const five = items.filter(r => Number(r.calificacion) === 5).length;
  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>⭐ Reseñas y reputación</h1>
          <p style={{ fontSize: 12.5, color: "var(--s600)", marginTop: 2 }}>Valoraciones escritas al completar transacciones.</p>
        </div>
        <button className="btn bg_" onClick={load}>↻ Actualizar</button>
      </div>
      <div className="g3" style={{ marginBottom: 14 }}>
        {[
          ["Promedio", `${avg.toFixed(1)}★`, "Últimas 100 reseñas"],
          ["Reseñas", items.length, "publicadas"],
          ["5 estrellas", five, "experiencias excelentes"],
        ].map(([l, v, s]) => (
          <div key={l} className="card" style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "var(--s400)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>{l}</div>
            <div style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, color: "var(--g2)" }}>{v}</div>
            <div style={{ fontSize: 12, color: "var(--s600)", marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? <div style={{ padding: 40, textAlign: "center" }}><div className="spin" style={{ margin: "0 auto" }} /></div>
          : items.length === 0 ? <div style={{ padding: 42, textAlign: "center", color: "var(--s400)" }}>Sin reseñas todavía</div>
          : <div className="tw"><table>
            <thead><tr><th>Trato</th><th>Autor</th><th>Destinatario</th><th>Estrellas</th><th>Comentario</th><th>Fecha</th></tr></thead>
            <tbody>{items.map(r => (
              <tr key={r.id}>
                <td><strong>{r.Trato?.codigo || "—"}</strong><div style={{ fontSize: 11, color: "var(--s500)" }}>{r.Trato?.titulo || ""}</div></td>
                <td>{r.autor ? `${r.autor.nombre} ${r.autor.apellido}` : r.autor_id}</td>
                <td>{r.destinatario ? `${r.destinatario.nombre} ${r.destinatario.apellido}` : r.destinatario_id}</td>
                <td><span style={{ color: "var(--g2)", fontWeight: 800 }}>{r.calificacion}★</span></td>
                <td style={{ maxWidth: 360, whiteSpace: "normal", lineHeight: 1.4 }}>{r.comentario || "—"}</td>
                <td style={{ fontSize: 11.5, color: "var(--s400)" }}>{fmtDate(r.createdAt)}</td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}

// ─── PANEL DE COMISIONES ─────────────────────────────
function ComisionesPanel({ toast }) {
  const [pagos, setPagos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mes");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get("/admin/pagos"), api.get("/admin/stats")])
      .then(([p, s]) => { setPagos(p.data || []); setStats(s.data); })
      .catch(() => toast("Error cargando comisiones", "error"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Tasas de comisión de pasarelas (aproximadas Colombia 2024)
  const TASAS_PASARELA = {
    pse:              { label: "PSE",        pct: 0.012, fijo: 900 },
    nequi:            { label: "Nequi",      pct: 0.018, fijo: 0   },
    daviplata:        { label: "Daviplata",  pct: 0.020, fijo: 0   },
    tarjeta_credito:  { label: "T. Crédito", pct: 0.030, fijo: 0   },
    tarjeta_debito:   { label: "T. Débito",  pct: 0.020, fijo: 0   },
    transferencia:    { label: "Transferencia", pct: 0, fijo: 0 },
    efectivo:         { label: "Efectivo",   pct: 0, fijo: 0 },
  };

  const aprobados = pagos.filter(p => p.estado === "aprobado");
  const comisiones = aprobados.filter(p => p.tipo === "comision");

  // Calcular período
  const ahora = new Date();
  const inicio = periodo === "hoy"
    ? new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    : periodo === "semana"
    ? new Date(ahora.getTime() - 7 * 86400000)
    : periodo === "mes"
    ? new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    : new Date(ahora.getFullYear(), 0, 1);

  const comisionesPeriodo = comisiones.filter(p => new Date(p.createdAt) >= inicio);
  const bruto = comisionesPeriodo.reduce((s, p) => s + parseFloat(p.monto || 0), 0);

  // Desglose por método de pago
  const byMetodo = {};
  aprobados.filter(p => p.tipo === "retencion" && new Date(p.createdAt) >= inicio).forEach(p => {
    const metodo = p.metodo_pago || p.pasarela || "otros";
    if (!byMetodo[metodo]) byMetodo[metodo] = { count: 0, volumen: 0, comision_pasarela: 0 };
    byMetodo[metodo].count++;
    byMetodo[metodo].volumen += parseFloat(p.monto || 0);
    const tasa = TASAS_PASARELA[metodo] || TASAS_PASARELA.transferencia;
    byMetodo[metodo].comision_pasarela += parseFloat(p.monto || 0) * tasa.pct + tasa.fijo;
  });

  const totalDeducciones = Object.values(byMetodo).reduce((s, v) => s + v.comision_pasarela, 0);
  const neto = bruto - totalDeducciones;

  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>💰 Comisiones TratoYa</h1>
          <p style={{ fontSize: 12.5, color: "var(--s600)", marginTop: 2 }}>Ingresos netos descontando costos de pasarelas</p>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          {[["hoy","Hoy"],["semana","7 días"],["mes","Este mes"],["año","Este año"]].map(([v,l]) => (
            <button key={v} className={`btn bsm ${periodo === v ? "bp" : "bo"}`} onClick={() => setPeriodo(v)}>{l}</button>
          ))}
          <button className="btn bg_" onClick={load}>↻</button>
        </div>
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 60 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></div> : (
        <>
          {/* KPIs principales */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 11, marginBottom: 16 }}>
            <div className="card" style={{ padding: "18px 20px", borderLeft: "4px solid var(--g)" }}>
              <div style={{ fontSize: 11, color: "var(--s400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Comisión Bruta TratoYa</div>
              <div style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, color: "var(--g2)" }}>{fmt(bruto)}</div>
              <div style={{ fontSize: 12, color: "var(--s600)", marginTop: 4 }}>{comisionesPeriodo.length} transacciones</div>
            </div>
            <div className="card" style={{ padding: "18px 20px", borderLeft: "4px solid var(--rd)" }}>
              <div style={{ fontSize: 11, color: "var(--s400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Deducciones Pasarelas</div>
              <div style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, color: "var(--rd)" }}>−{fmt(totalDeducciones)}</div>
              <div style={{ fontSize: 12, color: "var(--s600)", marginTop: 4 }}>Bre-B, Nequi, Daviplata, transferencia</div>
            </div>
            <div className="card" style={{ padding: "18px 20px", borderLeft: "4px solid var(--n)" }}>
              <div style={{ fontSize: 11, color: "var(--s400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>💵 Ingreso Neto TratoYa</div>
              <div style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, color: "var(--n)" }}>{fmt(neto)}</div>
              <div style={{ fontSize: 12, color: "var(--s600)", marginTop: 4 }}>Transferible a cuentas TratoYa</div>
            </div>
          </div>

          {/* Desglose por método de pago */}
          <div className="card" style={{ padding: "16px 18px", marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, marginBottom: 14 }}>Desglose por método de pago</h3>
            {Object.keys(byMetodo).length === 0
              ? <div style={{ textAlign: "center", padding: 24, color: "var(--s400)", fontSize: 13 }}>Sin transacciones en este período</div>
              : (
                <table>
                  <thead><tr><th>Método</th><th>Transacciones</th><th>Volumen</th><th>% Pasarela</th><th>Costo Pasarela</th><th>Neto Estimado</th></tr></thead>
                  <tbody>
                    {Object.entries(byMetodo).map(([metodo, datos]) => {
                      const tasa = TASAS_PASARELA[metodo] || TASAS_PASARELA.transferencia;
                      const costoStr = tasa.pct > 0 ? `${(tasa.pct * 100).toFixed(1)}%${tasa.fijo > 0 ? ` + $${tasa.fijo.toLocaleString("es-CO")}` : ""}` : "Sin costo";
                      const neto_ = datos.volumen - datos.comision_pasarela;
                      return (
                        <tr key={metodo}>
                          <td style={{ fontWeight: 600 }}>{TASAS_PASARELA[metodo]?.label || metodo}</td>
                          <td style={{ fontFamily: "Syne", fontWeight: 700 }}>{datos.count}</td>
                          <td style={{ fontFamily: "Syne", fontWeight: 700 }}>{fmt(datos.volumen)}</td>
                          <td><span style={{ fontSize: 11.5, color: "var(--or)", fontWeight: 600 }}>{costoStr}</span></td>
                          <td style={{ color: "var(--rd)", fontWeight: 600 }}>−{fmt(datos.comision_pasarela)}</td>
                          <td style={{ color: "var(--g2)", fontWeight: 700 }}>{fmt(neto_ * 0.045)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: "var(--cr)" }}>
                      <td style={{ fontWeight: 800 }}>TOTAL</td>
                      <td style={{ fontFamily: "Syne", fontWeight: 800 }}>{Object.values(byMetodo).reduce((s,v) => s+v.count,0)}</td>
                      <td style={{ fontFamily: "Syne", fontWeight: 800 }}>{fmt(Object.values(byMetodo).reduce((s,v) => s+v.volumen,0))}</td>
                      <td>—</td>
                      <td style={{ color: "var(--rd)", fontWeight: 800 }}>−{fmt(totalDeducciones)}</td>
                      <td style={{ color: "var(--g2)", fontWeight: 800, fontFamily: "Syne" }}>{fmt(neto)}</td>
                    </tr>
                  </tbody>
                </table>
              )
            }
          </div>

          {/* Costos referenciales */}
          <div className="card" style={{ padding: "14px 18px" }}>
            <h3 style={{ fontSize: 13, marginBottom: 10 }}>📋 Costos referenciales de pasarelas (Colombia)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9 }}>
              {Object.entries(TASAS_PASARELA).filter(([, v]) => v.pct > 0 || v.fijo > 0).map(([k, v]) => (
                <div key={k} style={{ background: "var(--s50)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2 }}>{v.label}</div>
                  <div style={{ fontSize: 12, color: "var(--or)", fontWeight: 600 }}>{(v.pct*100).toFixed(1)}%{v.fijo > 0 ? ` + $${v.fijo.toLocaleString("es-CO")}` : ""}</div>
                  <div style={{ fontSize: 10, color: "var(--s400)", marginTop: 2 }}>por transacción</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: "var(--s400)", marginTop: 10 }}>* Tasas aproximadas. Verificar contratos vigentes con cada pasarela para valores exactos.</p>
          </div>
        </>
      )}
    </div>
  );
}

function ActividadEnVivo({ toast }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filtro, setFiltro] = useState("todos");

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      api.get("/admin/actividad-reciente"),
      api.get("/admin/stats"),
    ]).then(([a, s]) => {
      setEventos(a.data || []);
      setStats(s.data || null);
      setLastUpdate(new Date());
    }).catch(() => {}).finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 60000);
    return () => clearInterval(t);
  }, [load]);

  const TIPO_CFG = {
    registro: { ico: "👤", label: "Registro",  color: "var(--g2)", bg: "var(--cr)" },
    trato:    { ico: "🤝", label: "Trato",     color: "var(--n2)", bg: "#E6EBF2" },
    pago:     { ico: "💳", label: "Pago",      color: "var(--or)", bg: "var(--orb)" },
    disputa:  { ico: "⚖️", label: "Disputa",   color: "var(--rd)", bg: "var(--rdb)" },
    kyc:      { ico: "🆔", label: "KYC",       color: "var(--pu)", bg: "var(--pub)" },
  };
  const tipos = ["todos","registro","trato","pago","disputa"];
  const filtrados = eventos.filter(e => filtro === "todos" || e.tipo === filtro);

  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 20 }}>⚡ Transacciones en TR</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--cr)", borderRadius: 20, fontSize: 11.5, fontWeight: 600, color: "var(--g2)" }}>
            <div className="live" /> Actualiza cada 60s
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastUpdate && <span style={{ fontSize: 11, color: "var(--s400)" }}>Última actualización: {lastUpdate.toLocaleTimeString("es-CO")}</span>}
          <button className="btn bg_" onClick={() => load()}>↻ Refrescar</button>
        </div>
      </div>

      {/* Mini KPIs en tiempo real */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 9, marginBottom: 14 }}>
          {[
            { ico: "👥", l: "Usuarios",   v: stats.totalUsers || stats.usuarios || 0, sub: `+${stats.registros_hoy || 0} hoy` },
            { ico: "🤝", l: "Tratos",     v: stats.totalTratos || stats.tratos || 0, sub: `${stats.tratos_hoy || 0} hoy` },
            { ico: "💳", l: "Pagos hoy",  v: stats.pagos_hoy || 0, sub: "transacciones" },
            { ico: "⚖️", l: "Disputas",   v: stats.disputas_abiertas || 0, sub: "abiertas", alert: (stats.disputas_abiertas || 0) > 0 },
            { ico: "🆔", l: "KYC pendiente", v: stats.kyc_pendientes || 0, sub: "por revisar", alert: (stats.kyc_pendientes || 0) > 0 },
          ].map((k, i) => (
            <div key={i} className="stat" style={{ padding: "12px 14px", background: k.alert ? "var(--rdb)" : "#fff" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{k.ico}</div>
              <div style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 800, color: k.alert ? "var(--rd)" : "var(--n)" }}>{k.v}</div>
              <div style={{ fontSize: 10, color: "var(--s400)", textTransform: "uppercase", letterSpacing: ".4px" }}>{k.l}</div>
              <div style={{ fontSize: 10.5, color: k.alert ? "var(--rd)" : "var(--s600)", marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {tipos.map(t => (
          <button key={t} className={`btn bsm ${filtro === t ? "bp" : "bo"}`} onClick={() => setFiltro(t)} style={{ textTransform: "capitalize" }}>
            {t === "todos" ? "🌐 Todos" : `${TIPO_CFG[t]?.ico || ""} ${TIPO_CFG[t]?.label || t}`}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: "14px 18px" }}>
        {loading
          ? <div style={{ textAlign: "center", padding: 40 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></div>
          : filtrados.length === 0
            ? <div style={{ textAlign: "center", padding: 32, color: "var(--s400)", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                Sin actividad reciente — esperando datos...
                <div style={{ fontSize: 11.5, marginTop: 6 }}>Se actualizará automáticamente cuando haya actividad</div>
              </div>
            : filtrados.map((e, i) => {
                const cfg = TIPO_CFG[e.tipo] || { ico: "📋", color: "var(--s400)", bg: "var(--s100)" };
                return (
                  <div key={i} className="log-item">
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{cfg.ico}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 12.5, color: "var(--n)" }}>{e.descripcion}</span>
                          <span className="bdg" style={{ marginLeft: 7, background: cfg.bg, color: cfg.color }}>{cfg.label || e.tipo}</span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--s400)", flexShrink: 0 }}>{timeAgo(e.createdAt)}</span>
                      </div>
                      {e.meta && Object.keys(e.meta).length > 0 && (
                        <div style={{ fontSize: 11, color: "var(--s600)", marginTop: 3, fontFamily: "JetBrains Mono, monospace" }}>
                          {Object.entries(e.meta).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, color: "var(--s400)", marginTop: 1 }}>{new Date(e.createdAt).toLocaleString("es-CO")}</div>
                    </div>
                  </div>
                );
              })
        }
      </div>
    </div>
  );
}

// ─── Usuarios baneados ────────────────────────────────
function Baneados({ toast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); api.get("/admin/users?estado=suspendido").then(r => setUsers(r.data||[])).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(load, []);
  const reactivar = async (id) => {
    try { await api.patch(`/admin/users/${id}/estado`, { estado: "activo" }); toast("Usuario reactivado", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  };
  return (
    <div className="page fi">
      <h1 style={{ fontSize: 20, marginBottom: 14 }}>Usuarios suspendidos</h1>
      {loading ? <div style={{ textAlign: "center", padding: 40 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></div>
        : users.length === 0
          ? <div style={{ textAlign: "center", padding: 40, color: "var(--s400)" }}><div style={{ fontSize: 36, marginBottom: 10 }}>✅</div><div style={{ fontWeight: 700 }}>Sin usuarios suspendidos</div></div>
          : <div className="tw"><table>
              <thead><tr><th>Usuario</th><th>Email</th><th>Motivo</th><th>Fecha</th><th></th></tr></thead>
              <tbody>{users.map(u => <tr key={u.id}><td><div style={{ fontWeight: 600, fontSize: 13 }}>{u.nombre} {u.apellido}</div></td><td style={{ fontSize: 12 }}>{u.email}</td><td style={{ fontSize: 12, color: "var(--s600)" }}>{u.motivo_suspension || "—"}</td><td style={{ fontSize: 11, color: "var(--s400)" }}>{fmtDate(u.updatedAt)}</td><td><button className="btn bp bsm" onClick={() => reactivar(u.id)}>✅ Reactivar</button></td></tr>)}</tbody>
            </table></div>
      }
    </div>
  );
}

// ─── Roles y accesos ─────────────────────────────────
function RolesAdmin({ toast, currentAdmin }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", password: "", rol: "user", estado: "activo" });
  const [credForm, setCredForm] = useState({ nombre: "", apellido: "", email: "", password: "", confirmar: "", rol: "user" });
  const canManage = currentAdmin?.rol === "superadmin";
  const roleWeight = { superadmin: 0, admin: 1, moderador: 2, soporte: 3, user: 4, invitado: 5 };

  const load = () => {
    setLoading(true);
    api.get(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then(r => setUsers((r.data || []).sort((a, b) => (roleWeight[a.rol || "user"] ?? 9) - (roleWeight[b.rol || "user"] ?? 9))))
      .catch(() => toast("Error cargando roles", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const resetForm = () => setForm({ nombre: "", apellido: "", email: "", password: "", rol: "user", estado: "activo" });
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const sc = (k, v) => setCredForm(p => ({ ...p, [k]: v }));

  const crearUsuario = async () => {
    if (!canManage) { toast("Solo un superadmin puede crear usuarios desde esta vista", "error"); return; }
    if (!form.nombre || !form.email || !form.password) { toast("Completa nombre, email y contraseña", "error"); return; }
    if (form.password.length < 6) { toast("La contraseña debe tener mínimo 6 caracteres", "error"); return; }
    setBusy(true);
    try {
      await api.post("/admin/users", form);
      toast(`Usuario ${rolLabel(form.rol)} creado`, "success");
      setModal(null); resetForm(); load();
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const cambiarRol = async () => {
    if (!canManage) { toast("Solo un superadmin puede cambiar roles", "error"); return; }
    if (selected?.id === currentAdmin?.id && !["superadmin", "admin"].includes(form.rol)) {
      toast("No te bajes tus propios permisos críticos desde aquí", "warn"); return;
    }
    setBusy(true);
    try {
      await api.patch(`/admin/users/${selected.id}/rol`, { rol: form.rol });
      toast(`Rol actualizado a ${rolLabel(form.rol)}`, "success");
      setModal(null); setSelected(null); load();
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const revocarSesiones = async (user) => {
    if (!canManage) { toast("Solo un superadmin puede revocar sesiones", "error"); return; }
    if (!window.confirm(`¿Cerrar todas las sesiones de ${user.nombre} ${user.apellido || ""}?`)) return;
    setBusy(true);
    try {
      await api.post(`/admin/users/${user.id}/revoke-sessions`);
      toast("Sesiones revocadas", "success");
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const exigir2FA = async (user) => {
    if (!canManage) { toast("Solo un superadmin puede cambiar seguridad", "error"); return; }
    setBusy(true);
    try {
      await api.patch(`/admin/users/${user.id}/security`, { require_2fa: !user.require_2fa });
      toast(!user.require_2fa ? "2FA obligatorio activado" : "2FA obligatorio desactivado", "success");
      load();
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const openRole = (u) => {
    setSelected(u);
    setForm(p => ({ ...p, rol: u.rol || "user" }));
    setModal("rol");
  };

  const openCredenciales = (u) => {
    setSelected(u);
    setCredForm({
      nombre: u.nombre || "",
      apellido: u.apellido || "",
      email: u.email || "",
      password: "",
      confirmar: "",
      rol: u.rol || "user",
    });
    setModal("credenciales");
  };

  const guardarCredenciales = async () => {
    if (!canManage) { toast("Solo un superadmin puede modificar credenciales", "error"); return; }
    if (!credForm.nombre || !credForm.email) { toast("Nombre y email son requeridos", "error"); return; }
    if (credForm.password || credForm.confirmar) {
      if (credForm.password !== credForm.confirmar) { toast("Las contraseñas no coinciden", "error"); return; }
      if (credForm.password.length < 6) { toast("Contraseña mínimo 6 caracteres", "error"); return; }
    }
    if (selected?.id === currentAdmin?.id && !["superadmin", "admin"].includes(credForm.rol)) {
      toast("No te bajes tus propios permisos críticos desde aquí", "warn"); return;
    }
    setBusy(true);
    try {
      await api.patch(`/admin/users/${selected.id}/credentials`, {
        nombre: credForm.nombre,
        apellido: credForm.apellido,
        email: credForm.email,
        rol: credForm.rol,
        password: credForm.password || undefined,
      });
      toast("Credenciales actualizadas", "success");
      setModal(null); setSelected(null); load();
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const ADMIN_VISIBLE_ROLES = ['superadmin', 'admin', 'moderador', 'soporte', 'invitado'];
  const filtered = users
    .filter(u => u.is_admin || ADMIN_VISIBLE_ROLES.includes(u.rol || 'user'))
    .filter(u => !q || `${u.nombre} ${u.apellido} ${u.email} ${u.rol}`.toLowerCase().includes(q.toLowerCase()));
  const adminUsers = users.filter(u => u.is_admin || ADMIN_VISIBLE_ROLES.includes(u.rol || 'user'));
  const totals = ROLE_OPTIONS.filter(r => r.id !== 'user').map(r => ({ ...r, total: adminUsers.filter(u => (u.rol || "user") === r.id).length }));

  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>Roles y accesos</h1>
          <p style={{ color: "var(--s600)", fontSize: 12.5, marginTop: 2 }}>Control de permisos, creación de usuarios y seguridad administrativa</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="search" style={{ width: 230 }}>🔍 <input placeholder="Buscar usuario o rol…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} /></div>
          <button className="btn bg_" onClick={load}>↻</button>
          <button className="btn bp" onClick={() => { resetForm(); setModal("crear"); }} disabled={!canManage}>➕ Crear usuario</button>
        </div>
      </div>

      {!canManage && (
        <div className="card" style={{ padding: "11px 14px", marginBottom: 14, borderColor: "rgba(224,123,0,.35)", background: "var(--orb)", color: "var(--or)", fontSize: 12.5, fontWeight: 600 }}>
          Estás entrando como {rolLabel(currentAdmin?.rol)}. Puedes revisar la matriz, pero crear usuarios y cambiar roles requiere superadmin.
        </div>
      )}

      <div className="role-grid">
        {totals.map(r => (
          <div className="role-card" key={r.id}>
            <span className={`bdg ${ROLE_BADGE[r.id] || "bg"}`}>{r.total} activos</span>
            <strong>{r.label}</strong>
            <p>{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="g2" style={{ gap: 14, alignItems: "start" }}>
        <div className="card" style={{ padding: "16px 18px" }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>🛡️ Matriz de permisos</h3>
          <div className="perm-grid">
            <div className="perm-cell h">Permiso</div>
            {ROLE_OPTIONS.map(r => <div key={r.id} className="perm-cell h">{r.label}</div>)}
            {PERMISSIONS.map(p => (
              <Fragment key={p.key}>
                <div className="perm-cell k">{p.key}</div>
                {ROLE_OPTIONS.map(r => <div key={`${p.key}-${r.id}`} className="perm-cell">{p[r.id] ? "✓" : "—"}</div>)}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px" }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>✨ Controles pro recomendados</h3>
          {[
            ["2FA obligatorio", "Forzar doble factor a administradores y roles sensibles."],
            ["Sesiones revocables", "Cerrar tokens activos si una cuenta queda comprometida."],
            ["Auditoría immutable", "Guardar quién cambió roles, pagos, KYC o configuraciones."],
            ["Aprobación dual", "Pagos altos o cambios de superadmin requieren segunda aprobación."],
            ["Roles granulares", "Separar permisos por acción en vez de solo por nombre de rol."],
          ].map(([t, d]) => (
            <div key={t} className="log-item">
              <div className="log-dot" style={{ background: "var(--g2)" }} />
              <div><div style={{ fontWeight: 700, fontSize: 13 }}>{t}</div><div style={{ fontSize: 12, color: "var(--s600)" }}>{d}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: "16px 18px", marginTop: 14 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Usuarios y equipo</h3>
        <div className="tw">
          <table>
            <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th><th>2FA</th><th>Último acceso</th><th>Acciones</th></tr></thead>
            <tbody>
              {loading
                ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 32 }}><div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} /></td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "var(--s400)", fontSize: 13 }}>Sin usuarios para mostrar</td></tr>
                  : filtered.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--n)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne", fontWeight: 800, fontSize: 11, color: "var(--g)", flexShrink: 0 }}>{(u.nombre || "?")[0]}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12.5 }}>{u.nombre} {u.apellido}</div>
                            <div style={{ fontSize: 10.5, color: "var(--s400)" }}>ID: {u.id?.slice?.(0,8) || u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{u.email}</td>
                      <td><span className={`bdg ${ROLE_BADGE[u.rol] || "bg"}`}>{rolLabel(u.rol)}</span></td>
                      <td><span className={`bdg ${u.estado === "activo" ? "gn" : u.estado === "suspendido" ? "rd" : "bg"}`}>{u.estado || "activo"}</span></td>
                      <td><span className={`bdg ${u.require_2fa || u.two_factor_enabled ? "gn" : "bg"}`}>{u.require_2fa || u.two_factor_enabled ? "Activo" : "No"}</span></td>
                      <td style={{ fontSize: 11, color: "var(--s400)" }}>{fmtTime(u.last_login_at || u.ultimo_acceso || u.updatedAt)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn bn bsm" onClick={() => openCredenciales(u)} disabled={!canManage || busy}>Credenciales</button>
                          <button className="btn bpu bsm" onClick={() => openRole(u)} disabled={!canManage || busy}>Rol</button>
                          <button className="btn bor bsm" onClick={() => exigir2FA(u)} disabled={!canManage || busy}>2FA</button>
                          <button className="btn brd bsm" onClick={() => revocarSesiones(u)} disabled={!canManage || busy}>Salir</button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {modal === "crear" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 style={{ fontSize: 15 }}>➕ Crear usuario con rol</h3>
              <button className="btn bg_ bsm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-bd">
              <div className="g2">
                <div className="fg"><label className="fl">Nombre</label><input className="inp" value={form.nombre} onChange={e => sf("nombre", e.target.value)} /></div>
                <div className="fg"><label className="fl">Apellido</label><input className="inp" value={form.apellido} onChange={e => sf("apellido", e.target.value)} /></div>
              </div>
              <div className="fg"><label className="fl">Email</label><input className="inp" type="email" value={form.email} onChange={e => sf("email", e.target.value)} placeholder="usuario@tratoya.co" /></div>
              <div className="g2">
                <div className="fg"><label className="fl">Contraseña inicial</label><input className="inp" type="password" value={form.password} onChange={e => sf("password", e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
                <div className="fg"><label className="fl">Rol</label><select className="inp" value={form.rol} onChange={e => sf("rol", e.target.value)}>{ROLE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
              </div>
              <div style={{ background: "var(--s50)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--s600)" }}>
                Recomendación: para admin y superadmin activa 2FA obligatorio después de crear la cuenta.
              </div>
            </div>
            <div className="modal-ft">
              <button className="btn bg_" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn bp" onClick={crearUsuario} disabled={busy}>{busy ? <div className="spin" /> : "Crear usuario"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "rol" && selected && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 style={{ fontSize: 15 }}>🛡️ Cambiar rol</h3>
              <button className="btn bg_ bsm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-bd">
              <div style={{ fontSize: 12.5, color: "var(--s600)", marginBottom: 13 }}>
                Usuario: <strong>{selected.nombre} {selected.apellido}</strong> · {selected.email}
              </div>
              <div className="fg">
                <label className="fl">Nuevo rol</label>
                <select className="inp" value={form.rol} onChange={e => sf("rol", e.target.value)}>
                  {ROLE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div style={{ background: "var(--orb)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--or)" }}>
                Este cambio debe registrarse en auditoría y cerrar sesiones si el usuario pierde permisos.
              </div>
            </div>
            <div className="modal-ft">
              <button className="btn bg_" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn bpu" onClick={cambiarRol} disabled={busy}>{busy ? <div className="spin" /> : "Guardar rol"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "credenciales" && selected && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 style={{ fontSize: 15 }}>🔐 Editar credenciales</h3>
              <button className="btn bg_ bsm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-bd">
              <div style={{ fontSize: 12.5, color: "var(--s600)", marginBottom: 13 }}>
                Cuenta: <strong>{selected.email}</strong>
              </div>
              <div className="g2">
                <div className="fg"><label className="fl">Nombre</label><input className="inp" value={credForm.nombre} onChange={e => sc("nombre", e.target.value)} /></div>
                <div className="fg"><label className="fl">Apellido</label><input className="inp" value={credForm.apellido} onChange={e => sc("apellido", e.target.value)} /></div>
              </div>
              <div className="fg"><label className="fl">Email de acceso</label><input className="inp" type="email" value={credForm.email} onChange={e => sc("email", e.target.value)} /></div>
              <div className="g2">
                <div className="fg"><label className="fl">Nueva contraseña</label><input className="inp" type="password" placeholder="Deja vacío para no cambiar" value={credForm.password} onChange={e => sc("password", e.target.value)} /></div>
                <div className="fg"><label className="fl">Confirmar contraseña</label><input className="inp" type="password" placeholder="Repite la nueva contraseña" value={credForm.confirmar} onChange={e => sc("confirmar", e.target.value)} /></div>
              </div>
              <div className="fg">
                <label className="fl">Rol</label>
                <select className="inp" value={credForm.rol} onChange={e => sc("rol", e.target.value)}>
                  {ROLE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div style={{ background: "var(--orb)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--or)" }}>
                Cambiar email o contraseña cierra las sesiones activas de esa cuenta.
              </div>
            </div>
            <div className="modal-ft">
              <button className="btn bg_" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn bn" onClick={guardarCredenciales} disabled={busy}>{busy ? <div className="spin" /> : "Guardar credenciales"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Admin Login ──────────────────────────────────────
function AdminLogin({ onLogin, toast }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.removeItem("ty_admin_token_v2");
    localStorage.removeItem("ty_admin_refresh_v2");
    localStorage.removeItem("ty_admin_user_v2");
    localStorage.removeItem("ty_admin_token");
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/auth/login", { email: form.email.trim(), password: form.password.trim() });
      const userRol = r.user?.rol || (r.user?.is_admin ? "admin" : "user");
      if (userRol !== "admin" && userRol !== "superadmin") {
        toast("No tienes permisos de administrador", "error"); setLoading(false); return;
      }
      const adminUser = { ...r.user, rol: userRol };
      localStorage.setItem("ty_admin_token_v2", r.token);
      localStorage.setItem("ty_admin_refresh_v2", r.refresh_token || "");
      localStorage.setItem("ty_admin_user_v2", JSON.stringify(adminUser));
      localStorage.removeItem("ty_admin_token");
      onLogin(adminUser);
      toast(`Bienvenido, ${adminUser.nombre}`, "success");
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  return (
    <div className="adm-login">
      <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <a href="/" aria-label="Ir al inicio" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <img src={logo} alt="TratoYa" style={{ width: 176, height: "auto", filter: "drop-shadow(0 18px 24px rgba(0,0,0,.36))" }} />
          </a>
          <div style={{ fontFamily: "Syne", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.4)", letterSpacing: "2px", textTransform: "uppercase" }}>Panel de Administración</div>
        </div>

        <div style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(10px)", borderRadius: 14, border: "1px solid rgba(255,255,255,.08)", padding: "28px 26px" }}>
          <form onSubmit={login}>
            <div className="fg"><label className="fl" style={{ color: "rgba(255,255,255,.6)" }}>Email de administrador</label><input className="inp" type="email" placeholder="admin@tratoya.co" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={{ background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.1)", color: "#fff" }} /></div>
            <div className="fg"><label className="fl" style={{ color: "rgba(255,255,255,.6)" }}>Contraseña</label><input className="inp" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} style={{ background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.1)", color: "#fff" }} /></div>
            <button type="submit" className="btn bp blg" style={{ width: "100%", marginTop: 6 }} disabled={loading}>
              {loading ? <><div className="spin" /> Verificando…</> : "🔐 Acceder al panel"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <a href="/" style={{ fontSize: 12, color: "rgba(255,255,255,.3)", textDecoration: "none" }}>← Volver a TratoYa</a>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────
export default function TratoYaAdmin() {
  const { ts, show, rm } = useToast();
  const toast = useCallback((m, t = "info") => show(m, t), [show]);
  const urlParams = new URLSearchParams(window.location.search);
  const [admin, setAdmin] = useState(() => {
    const tok = localStorage.getItem("ty_admin_token_v2");
    try {
      const u = JSON.parse(localStorage.getItem("ty_admin_user_v2") || "null");
      const userRol = u?.rol || (u?.is_admin ? "admin" : "user");
      return (tok && u && (userRol === "admin" || userRol === "superadmin")) ? { ...u, rol: userRol } : null;
    } catch { return null; }
  });
  const [page, setPage] = useState(() => {
    const requested = urlParams.get("page");
    return NAV.some((n) => n.id === requested) ? requested : "dashboard";
  });
  const [disputasPendientes, setDisputasPendientes] = useState(0);
  const tratoDetailId = urlParams.get("trato");
  const detailFrom = urlParams.get("from");
  const detailBackPage = NAV.some((n) => n.id === detailFrom) ? detailFrom : "dashboard";
  const detailBackHref = `${ADMIN_ENTRY_PATH}?page=${encodeURIComponent(detailBackPage)}`;

  useEffect(() => {
    const onAuthExpired = (e) => {
      setAdmin(null);
      toast(e.detail || "Sesión vencida. Ingresa nuevamente.", "warn");
    };
    window.addEventListener("ty-admin-auth-expired", onAuthExpired);
    return () => window.removeEventListener("ty-admin-auth-expired", onAuthExpired);
  }, [toast]);

  useEffect(() => {
    if (admin) {
      api.get("/admin/stats").then(r => { const s = r.data || r; setDisputasPendientes(s.disputas_abiertas || 0); }).catch(() => {});
    }
  }, [admin]);

  useEffect(() => {
    document.title = tratoDetailId
      ? "Trato YA / Admin / Detalle de trato"
      : `Trato YA / Admin / ${NAV.find(n => n.id === page)?.l || "Inicio"}`;
  }, [page, tratoDetailId]);

  const logout = () => {
    localStorage.removeItem("ty_admin_token_v2");
    localStorage.removeItem("ty_admin_refresh_v2");
    localStorage.removeItem("ty_admin_user_v2");
    localStorage.removeItem("ty_admin_token");
    setAdmin(null);
    toast("Sesión cerrada", "info");
  };

  const goPage = useCallback((next) => {
    const safePage = NAV.some((n) => n.id === next) ? next : "dashboard";
    setPage(safePage);
    const url = safePage === "dashboard" ? ADMIN_ENTRY_PATH : `${ADMIN_ENTRY_PATH}?page=${encodeURIComponent(safePage)}`;
    window.history.replaceState(null, "", url);
  }, []);

  const PAGES = {
    dashboard:      <AdminDashboard toast={toast} setPage={goPage} />,
    actividad:      <ActividadEnVivo toast={toast} />,
    usuarios:       <Usuarios toast={toast} />,
    roles:          <RolesAdmin toast={toast} currentAdmin={admin} />,
    kyc:            <KYCVerificaciones toast={toast} />,
    baneos:         <Baneados toast={toast} />,
    tratos:         <TratosAdmin toast={toast} />,
    pagos:          <PagosAdmin toast={toast} />,
    comisiones:     <ComisionesPanel toast={toast} />,
    resenas:        <ResenasAdmin toast={toast} />,
    disputas:       <Disputas toast={toast} />,
    tickets:        <Tickets toast={toast} />,
    notificaciones: <Notificaciones toast={toast} />,
    configuracion:  <Configuracion toast={toast} />,
    logs:           <Logs toast={toast} />,
  };

  return (
    <>
      <style>{FONTS}{CSS}</style>
      <div className="toast-wrap">{ts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => rm(t.id)} />)}</div>

      {!admin ? (
        <AdminLogin onLogin={setAdmin} toast={toast} />
      ) : tratoDetailId ? (
        <div className="admin-main" style={{ minHeight: "100vh", marginLeft: 0 }}>
          <div className="topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <a href={detailBackHref} className="btn admin-back-btn" style={{ textDecoration: "none" }}>← Atrás</a>
              <span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 14 }}>Detalle completo del trato</span>
            </div>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
              <a href="/" style={{ fontSize: 12.5, color: "var(--s600)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }} target="_blank" rel="noreferrer">🌐 Ver plataforma</a>
              <button className="btn bg_ bsm" onClick={logout}>🚪 Salir</button>
            </div>
          </div>
          <TratoAdminFullPage tratoId={tratoDetailId} toast={toast} backHref={detailBackHref} />
        </div>
      ) : (
        <div className="admin-shell">
          <Sidebar page={page} setPage={goPage} admin={admin} disputasPendientes={disputasPendientes} />
          <div className="admin-main">
            <div className="topbar">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 14 }}>{NAV.find(n => n.id === page)?.l || "Inicio"}</span>
              </div>
              <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                <a href="/" style={{ fontSize: 12.5, color: "var(--s600)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }} target="_blank" rel="noreferrer">🌐 Ver plataforma</a>
                <button className="btn bg_ bsm" onClick={logout}>🚪 Salir</button>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 11px", background: "var(--s50)", borderRadius: 8, border: "1px solid var(--s100)" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--n)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne", fontWeight: 800, fontSize: 10, color: "var(--g)" }}>{(admin?.nombre || "A")[0]}</div>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{admin?.nombre}</span>
                  <span className={`bdg ${ROLE_BADGE[admin?.rol] || "nb"}`} style={{ fontSize: 9 }}>{rolLabel(admin?.rol || "admin")}</span>
                </div>
              </div>
            </div>
            <div key={page}>{PAGES[page] || PAGES.dashboard}</div>
          </div>
        </div>
      )}
    </>
  );
}
