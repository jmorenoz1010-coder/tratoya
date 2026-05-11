import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export default function Reputacion({ user, setUser, toast }) {
  const [me, setMe] = useState(user);

  const load = useCallback(async (silent = false) => {
    try {
      const r = await api.get("/auth/me");
      setMe(r.data);
      setUser?.(r.data);
    } catch (e) {
      if (!silent) toast(e.message, "error");
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const total = Number(me?.total_tratos || 0);
  const exitosos = Number(me?.tratos_exitosos || 0);
  const rep = Number(me?.reputacion || 0);
  const tasa = total ? Math.round((exitosos / total) * 100) : 0;
  const nivel = rep >= 4.8 ? "Platino" : rep >= 4.4 ? "Oro" : rep >= 4 ? "Plata" : total >= 1 ? "En crecimiento" : "Nuevo";

  const gaugeColor = rep >= 4 ? "var(--g2)" : rep >= 3 ? "var(--or)" : "var(--re)";
  const gaugePct = Math.round((rep / 5) * 100);

  return (
    <div className="page fi">
      <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 18 }}>Reputación</h1>

      <div className="g2" style={{ gap: 14, marginBottom: 14 }}>
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--s400)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>
            Puntaje TratoYA
          </div>

          {/* Gauge visual */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 14 }}>
            <div style={{ fontFamily: "Manrope", fontSize: 52, fontWeight: 800, lineHeight: 1, color: gaugeColor }}>
              {rep.toFixed(1)}<span style={{ fontSize: 22 }}>★</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, background: "var(--s100)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${gaugePct}%`, background: gaugeColor, borderRadius: 99, transition: "width 1s ease" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--s400)", marginTop: 5 }}>Nivel: <strong style={{ color: gaugeColor }}>{nivel}</strong></div>
            </div>
          </div>

          <p style={{ color: "var(--s600)", fontSize: 13, lineHeight: 1.6 }}>
            El puntaje sube con transacciones completadas sin disputa y pagos liberados correctamente.
          </p>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div className="g2">
            {[
              ["Tratos totales", total],
              ["Exitosos", exitosos],
              ["Tasa de éxito", `${tasa}%`],
              ["KYC", me?.kyc_estado || "pendiente"],
            ].map(([k, v]) => (
              <div key={k} style={{ background: "var(--s50)", borderRadius: 10, padding: "13px 14px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--s400)", textTransform: "uppercase", marginBottom: 4 }}>{k}</div>
                <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 18 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "17px 19px" }}>
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Cómo se calcula</h2>
        <div className="g3">
          {[
            ["✅", "Pago liberado suma experiencia positiva"],
            ["📋", "Cada trato completado mejora la confianza"],
            ["⚖️", "Disputas y cancelaciones no suman al éxito"],
          ].map(([ic, t]) => (
            <div key={t} style={{ background: "var(--cr2)", borderRadius: 10, padding: "12px 13px", fontSize: 13, color: "var(--s800)", fontWeight: 600, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{ic}</span> {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
