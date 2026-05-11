import Av from "./Avatar";

const NAV = [
  ["dashboard", "🏠", "Dashboard"],
  ["tratos",    "📋", "Mis Tratos"],
  ["crear",     "➕", "Crear trato"],
  ["pagos",     "💳", "Pagos"],
  ["disputas",  "⚖️", "Disputas"],
  ["reputacion","⭐", "Reputación"],
];
const BOT = [["perfil", "👤", "Perfil"]];

export default function Sidebar({ page, setPage, user, onLogout }) {
  const nom = user ? `${user.nombre} ${user.apellido}` : "";
  return (
    <aside className="sb">
      <div className="sb-logo">
        <div className="sb-mk">T</div>
        <span style={{ fontFamily: "Manrope", fontSize: 18, fontWeight: 800, color: "#fff" }}>
          Trato<span style={{ color: "var(--g)" }}>Ya</span>
        </span>
        <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, color: "var(--g)", background: "rgba(168,196,0,.15)", padding: "2px 6px", borderRadius: 6 }}>
          BETA
        </span>
      </div>

      <nav className="sb-nav">
        <div className="nav-lbl">Principal</div>
        {NAV.map(([id, ic, l]) => (
          <div
            key={id}
            className={`ni ${page === id ? "act" : ""}`}
            onClick={() => setPage(id)}
          >
            <span style={{ fontSize: 15 }}>{ic}</span> {l}
          </div>
        ))}
        <div className="nav-lbl" style={{ marginTop: 8 }}>Cuenta</div>
        {BOT.map(([id, ic, l]) => (
          <div
            key={id}
            className={`ni ${page === id ? "act" : ""}`}
            onClick={() => setPage(id)}
          >
            <span style={{ fontSize: 15 }}>{ic}</span> {l}
          </div>
        ))}
        <div className="ni" onClick={onLogout} style={{ marginTop: 6 }}>
          <span style={{ fontSize: 15 }}>🚪</span> Cerrar sesión
        </div>
      </nav>

      <div className="sb-usr">
        <Av name={nom} />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nom || "Usuario"}
          </div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.35)" }}>
            {user?.kyc_nivel !== "ninguno" ? "✓ Verificado" : "⚠ Sin verificar"}
          </div>
        </div>
      </div>
    </aside>
  );
}
