import Av from "./Avatar";
import NotificationBell from "./NotificationBell";

export default function Topbar({ title, user, page, setPage, onMenuOpen, onBack, onProfile, setTratoId }) {
  const nom = `${user?.nombre || ""} ${user?.apellido || ""}`.trim();
  const goBack = onBack || (() => {
    if (page === "dashboard") window.location.href = "/";
    else setPage("dashboard");
  });

  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <button
          className={`btn bg_ back-mini app-back-mini${page === "crear" ? " topbar-cancel-btn" : ""}`}
          onClick={goBack}
          title={page === "crear" ? "Cancelar" : page === "dashboard" ? "Volver al inicio" : "Volver"}
          aria-label={page === "crear" ? "Cancelar" : page === "dashboard" ? "Volver al inicio" : "Volver"}
        >
          &larr;
        </button>
        <span style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <NotificationBell setPage={setPage} setTratoId={setTratoId} />
        <button
          className="user-chip topbar-user-chip"
          onClick={onProfile || onMenuOpen}
          aria-label="Ir a mi perfil"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 11px", background: "var(--s50)", borderRadius: 9, border: "1px solid var(--s100)", cursor: "pointer" }}
        >
          <Av name={nom} size={26} />
          <span className="topbar-user-name" style={{ fontSize: 13, fontWeight: 600 }}>{user?.nombre || "—"}</span>
          {(user?.kyc_nivel === "premium" || user?.kyc_nivel === "verificado") && (
            <span
              title={user?.kyc_nivel === "premium" ? "Usuario Premium" : "Usuario Verificado"}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, background: "#1877F2", borderRadius: "50%", color: "#fff", fontSize: 11, fontWeight: 900, lineHeight: 1, flexShrink: 0 }}
            >✓</span>
          )}
          <span className="topbar-menu-arrow" aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
