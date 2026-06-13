import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { fmtDate, ESTADO, DISPUTA_ESTADO } from "../lib/utils";

export default function Disputas({ toast, initialTratoId, clearInitialTratoId, setPage, setTratoId }) {
  const [d, setD] = useState([]);
  const [tratos, setTratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    trato_id: initialTratoId || "",
    tipo: "no_recibido",
    motivo: "",
    descripcion: "",
  });

  useEffect(() => {
    if (initialTratoId) {
      setF((p) => ({ ...p, trato_id: initialTratoId }));
      clearInitialTratoId?.();
    }
    Promise.all([
      api.get("/disputes").catch(() => ({ data: [] })),
      api.get("/tratos?limit=50").catch(() => ({ data: [] })),
    ]).then(([dis, tr]) => {
      setD(dis.data || []);
      setTratos((tr.data || []).filter((t) => !["cancelado","expirado","disputado"].includes(t.estado)));
    }).finally(() => setLoading(false));
  }, [initialTratoId]);

  const crear = async () => {
    if (!f.trato_id || !f.motivo || !f.descripcion) {
      toast("Completa todos los campos", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/disputes`, { trato_id: f.trato_id, tipo: f.tipo, motivo: f.motivo, descripcion: f.descripcion });
      toast("Disputa abierta. Un mediador revisará en 72h.", "success");
      setF({ trato_id: "", tipo: "no_recibido", motivo: "", descripcion: "" });
      const res = await api.get("/disputes").catch(() => ({ data: [] }));
      setD(res.data || []);
    } catch (e) {
      toast(e.message, "error");
    }
    setSaving(false);
  };

  return (
    <div className="page fi">
      <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 18 }}>Disputas</h1>

      <div className="card" style={{ padding: "18px 20px", marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>⚖️ Abrir nueva disputa</h2>
        <div className="g2" style={{ gap: 10 }}>
          <div className="fg">
            <label className="fl">Trato</label>
            <select className="inp" value={f.trato_id} onChange={(e) => setF((p) => ({ ...p, trato_id: e.target.value }))}>
              <option value="">— Seleccionar trato —</option>
              {tratos.map((t) => (
                <option key={t.id} value={t.id}>{t.codigo} · {t.titulo} · {ESTADO[t.estado]?.l || t.estado}</option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label className="fl">Tipo</label>
            <select className="inp" value={f.tipo} onChange={(e) => setF((p) => ({ ...p, tipo: e.target.value }))}>
              <option value="no_recibido">No recibido</option>
              <option value="producto_danado">Producto dañado</option>
              <option value="diferente">Diferente a lo acordado</option>
              <option value="servicio_incompleto">Servicio incompleto</option>
              <option value="fraude">Posible fraude</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>
        <div className="fg">
          <label className="fl">Motivo</label>
          <input className="inp" placeholder="Ej: El vendedor no entregó el producto" value={f.motivo} onChange={(e) => setF((p) => ({ ...p, motivo: e.target.value }))} />
        </div>
        <div className="fg">
          <label className="fl">Descripción</label>
          <textarea className="inp" rows="3" placeholder="Cuenta qué pasó, fechas, acuerdos y evidencia disponible..." value={f.descripcion} onChange={(e) => setF((p) => ({ ...p, descripcion: e.target.value }))} />
        </div>
        <button className="btn bdd" onClick={crear} disabled={saving || !f.trato_id}>
          {saving ? <div className="spin" /> : "⚖️ Crear disputa"}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} />
        </div>
      ) : d.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">⚖️</div>
          <div className="empty-t">Sin disputas</div>
          <div className="empty-d">¡Excelente! Todos tus tratos están en orden.</div>
        </div>
      ) : (
        d.map((x, i) => (
          <div key={i} className="card" style={{ padding: "15px 17px", marginBottom: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 11, color: "var(--g2)", marginBottom: 3 }}>{x.Trato?.codigo || ""}</div>
                <div className="wrap-any" style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{x.motivo}</div>
                <div className="wrap-any" style={{ fontSize: 12, color: "var(--s600)" }}>{x.descripcion?.slice(0, 160)}{x.descripcion?.length > 160 ? "..." : ""}</div>
              </div>
                <span className={`bdg ${DISPUTA_ESTADO[x.estado]?.c || "or"}`}>{DISPUTA_ESTADO[x.estado]?.l || x.estado}</span>
            </div>
            <div className="g4" style={{ marginTop: 12, gap: 8 }}>
              {[
                ["Abierta", fmtDate(x.createdAt), true],
                ["En revisión", x.estado !== "abierta" ? "Activa" : "Pendiente", ["en_revision","esperando_info","resuelta","cerrada"].includes(x.estado)],
                ["Resolución", x.resolucion || "Pendiente", ["resuelta","cerrada"].includes(x.estado)],
                ["Límite SLA", fmtDate(x.fecha_limite), true],
              ].map(([k, v, on]) => (
                <div key={k} style={{ background: on ? "var(--cr2)" : "var(--s50)", borderRadius: 9, padding: "9px 10px" }}>
                  <div style={{ fontSize: 10, color: "var(--s400)", fontWeight: 700, textTransform: "uppercase" }}>{k}</div>
                  <div className="wrap-any" style={{ fontSize: 12, fontWeight: 700, color: on ? "var(--n)" : "var(--s400)" }}>{v}</div>
                </div>
              ))}
            </div>
            {x.notas_mediador && (
              <div className="wrap-any" style={{ marginTop: 10, background: "var(--cr)", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "var(--s800)" }}>
                Resolución: {x.notas_mediador}
              </div>
            )}
            {["resuelta", "cerrada"].includes(x.estado) && x.resolucion === "favor_comprador" && (
              <div style={{ marginTop: 10, background: "#eef8ff", border: "1px solid #b8d9f5", borderRadius: 9, padding: "9px 11px", fontSize: 12, color: "var(--n)" }}>
                Si había pago retenido, iniciamos la devolución. Revisa el estado en <button type="button" className="btn bo bsm" style={{ marginLeft: 4 }} onClick={() => setPage?.("pagos")}>Pagos</button>.
              </div>
            )}
            {x.Trato?.id && (
              <button className="btn bo bsm" style={{ marginTop: 10 }} onClick={() => { setTratoId?.(x.Trato.id); setPage?.("detalle"); }}>
                Ver trato
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
