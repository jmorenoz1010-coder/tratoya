import Av from "./Avatar";
import logo from "../assets/tratoya-logo.png";
import { ShieldIcon, ScaleIcon, BoltIcon, CashIcon, CoinIcon, PersonIcon, FlagIcon } from "./LandingIcons";

const NAV = [
  ["dashboard", ShieldIcon, "Inicio"],
  ["tratos",    ScaleIcon, "Mis Tratos"],
  ["crear",     BoltIcon, "Crear trato"],
  ["pagos",     CoinIcon, "Pagos"],
  ["disputas",  ScaleIcon, "Disputas"],
];
const BOT = [["reputacion", FlagIcon, "Reputación"], ["perfil", PersonIcon, "Perfil"]];

export default function Sidebar({ page, setPage, user, onLogout, onMenuOpen, hasPendingTratos = false }) {
  const nom = user ? `${user.nombre} ${user.apellido}` : "";
  return (
    <aside className="sb">
      <div className="sb-logo">
        <a className="sb-brand-link" href="/" aria-label="Ir al inicio">
          <img src={logo} alt="TratoYa" />
        </a>
        <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, color: "var(--g)", background: "rgba(168,196,0,.15)", padding: "2px 6px", borderRadius: 6 }}>
          BETA
        </span>
      </div>

      <nav className="sb-nav">
        <div className="nav-lbl">Principal</div>
        {NAV.map(([id, Icon, l]) => (
          <div
            key={id}
            className={`ni ${id === "pagos" ? "nav-pagos" : ""} ${id === "crear" ? "nav-create" : ""} ${id === "disputas" ? "nav-disputas" : ""} ${page === id ? "act" : ""}`}
            onClick={() => setPage(id)}
            title={id === "tratos" && hasPendingTratos ? "Tienes tratos sin concretar" : undefined}
          >
            <span className="nav-ico" aria-hidden="true"><Icon /></span>
            <span className="nav-text">{l}</span>
            {id === "tratos" && hasPendingTratos && (
              <span className="nav-bubble" aria-label="Tienes tratos sin concretar">!</span>
            )}
          </div>
        ))}
        <div className="nav-lbl" style={{ marginTop: 8 }}>Cuenta</div>
        {BOT.map(([id, Icon, l]) => (
          <div
            key={id}
            className={`ni nav-perfil ${page === id ? "act" : ""}`}
            onClick={() => setPage(id)}
          >
            <span className="nav-ico" aria-hidden="true"><Icon /></span> {l}
          </div>
        ))}
        <div className="ni nav-logout" onClick={onLogout} style={{ marginTop: 6 }}>
          <span className="nav-ico nav-ico--logout" aria-hidden="true">↗</span> Cerrar sesión
        </div>
        {/* Hamburger — solo visible en mobile nav */}
        <div className="ni nav-menu" onClick={onMenuOpen} role="button" aria-label="Abrir menú">
          <span className="nav-menu-ico">☰</span>
          <span className="nav-text">Más</span>
        </div>
      </nav>

      <div className="sb-usr">
        <Av name={nom} />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nom || "Usuario"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            {user?.kyc_nivel === "premium" || user?.kyc_nivel === "verificado" ? (
              <>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, background: "#1877F2", borderRadius: "50%", color: "#fff", fontSize: 10, fontWeight: 900, lineHeight: 1, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,.55)", fontWeight: 600 }}>
                  {user?.kyc_nivel === "premium" ? "Premium" : "Verificado"}
                </span>
              </>
            ) : user?.kyc_nivel === "basico" ? (
              <>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>✓</span>
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,.45)" }}>Básico</span>
              </>
            ) : (
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,.3)" }}>Sin verificar</span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
