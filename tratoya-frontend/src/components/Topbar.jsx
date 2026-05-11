import Av from "./Avatar";

export default function Topbar({ title, user, page, setPage }) {
  const nom = `${user?.nombre || ""} ${user?.apellido || ""}`.trim();
  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        {page !== "dashboard" && (
          <button
            className="btn bg_ back-mini"
            onClick={() => setPage("dashboard")}
            title="Volver"
          >
            ←
          </button>
        )}
        <span style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
      </div>
      <div
        className="user-chip"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 11px", background: "var(--s50)", borderRadius: 9, border: "1px solid var(--s100)" }}
      >
        <Av name={nom} size={26} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{user?.nombre || "—"}</span>
      </div>
    </div>
  );
}
