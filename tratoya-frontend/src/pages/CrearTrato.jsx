import { useState } from "react";
import { api } from "../lib/api";
import { fmt, normalizeHandle, calcularComisionUI, MONTO_MINIMO_TRATO, publicTratoUrl } from "../lib/utils";
import CommissionBreakdown from "../components/CommissionBreakdown";

const TIPOS = [
  ["producto", "📦", "Producto"],
  ["servicio", "🛠️", "Servicio"],
  ["reserva",  "📅", "Reserva"],
  ["vehiculo", "🚗", "Vehículo"],
];

export default function CrearTrato({ setPage, toast, user }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [f, setF_] = useState({ tipo: "producto", titulo: "", descripcion: "", monto: "", dias: "7", quien: "por_definir", notas: "", directo: false, contraparte: "" });
  const [lookup, setLookup] = useState({ loading: false, data: null, error: "" });
  const sf = (k, v) => setF_((p) => ({ ...p, [k]: v }));
  const monto = parseInt((f.monto || "").replace(/\D/g, "")) || 0;

  const buscarContraparte = async () => {
    const handle = normalizeHandle(f.contraparte);
    if (!handle || handle.length < 5) {
      setLookup({ loading: false, data: null, error: "El usuario debe tener mínimo 5 letras/números." });
      return;
    }
    setLookup({ loading: true, data: null, error: "" });
    try {
      const r = await api.get(`/users/lookup/${encodeURIComponent(handle)}`);
      setLookup({ loading: false, data: r.data, error: "" });
      sf("contraparte", handle);
    } catch (e) {
      setLookup({ loading: false, data: null, error: e.message });
    }
  };

  const create = async () => {
    if (f.directo && !lookup.data) { toast("Busca y confirma el nombre de usuario de tu contraparte.", "error"); return; }
    if (monto < MONTO_MINIMO_TRATO) { toast(`El monto mínimo es ${fmt(MONTO_MINIMO_TRATO)}`, "error"); return; }
    if (!["comprador", "vendedor", "compartida"].includes(f.quien)) { toast("Define quién paga la comisión.", "error"); setStep(2); return; }
    setLoading(true);
    try {
      const res = await api.post("/tratos", {
        titulo: f.titulo,
        descripcion: f.descripcion,
        tipo: f.tipo,
        monto,
        dias_inspeccion: parseInt(f.dias),
        quien_paga_comision: f.quien,
        notas: f.notas,
        contraparte_usuario_unico: f.directo ? f.contraparte : undefined,
      });
      setDone(res.data);
      toast("¡Trato creado!", "success");
    } catch (e) {
      toast(e.message, "error");
    }
    setLoading(false);
  };

  const qrUrl = done
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicTratoUrl(done.link_compartir))}&format=png&bgcolor=ffffff&color=07192F&qzone=2`
    : null;
  const createdLink = done ? publicTratoUrl(done.link_compartir) : "";

  if (done) return (
    <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 480 }}>
      <div className="popi" style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ width: 68, height: 68, borderRadius: "50%", background: "var(--cr)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 30 }}>✅</div>
        <h2 style={{ fontSize: 24, marginBottom: 7 }}>¡Trato creado!</h2>
        <p style={{ color: "var(--s600)", marginBottom: 16, lineHeight: 1.6, fontSize: 14 }}>
          {done.comprador_id ? "Tu contraparte recibió una notificación directa. También puedes compartir el link." : "Comparte el link o el código QR con tu contraparte."}
        </p>
        <div style={{ background: "var(--n)", color: "var(--g)", borderRadius: 9, padding: "9px 15px", fontFamily: "Manrope", fontWeight: 800, fontSize: 17, marginBottom: 12 }}>
          {done.codigo}
        </div>
        <div style={{ background: "var(--s50)", borderRadius: 9, padding: "9px 13px", display: "flex", alignItems: "center", gap: 8, marginBottom: 14, border: "1.5px dashed var(--s200)" }}>
          <span style={{ fontSize: 11.5, color: "var(--s600)", flex: 1, wordBreak: "break-all", fontFamily: "monospace" }}>
            {createdLink}
          </span>
          <button className="btn bo bsm" onClick={() => { navigator.clipboard.writeText(createdLink); toast("Link copiado ✓", "success"); }}>
            Copiar
          </button>
        </div>
        <div className="qr-card" style={{ background: "#fff", borderRadius: 14, padding: 16, margin: "0 auto 14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh)", border: "1px solid var(--s100)" }}>
          {qrUrl && <img src={qrUrl} alt="QR Trato" style={{ width: 180, height: 180, display: "block" }} />}
          <div style={{ fontSize: 10.5, color: "var(--s400)", marginTop: 6 }}>⏱ Válido 12 h · Expira al aceptarse</div>
        </div>
        <div className="share-actions">
          <button className="btn bp share-wa" onClick={() => {
            const waMsj = `Hola, te comparto el link de nuestro trato seguro en TratoYa:%0A%0A🔒 *${done.titulo || done.codigo}*%0A💰 Monto: ${done.monto_fmt || ""}%0A%0A👉 ${encodeURIComponent(createdLink)}`;
            window.open(`https://wa.me/?text=${waMsj}`, "_blank");
          }}>
            <span>📲</span><span>Compartir por WhatsApp</span>
          </button>
          <button className="btn bo share-copy" onClick={() => { navigator.clipboard.writeText(createdLink); toast("Link copiado ✓", "success"); }}>
            <span>🔗</span><span>Copiar</span>
          </button>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button className="btn bp" style={{ flex: 1 }} onClick={() => setPage("tratos")}>Ver tratos</button>
          <button className="btn bo" onClick={() => { setDone(null); setStep(1); setLookup({ loading: false, data: null, error: "" }); setF_({ tipo: "producto", titulo: "", descripcion: "", monto: "", dias: "7", quien: "por_definir", notas: "", directo: false, contraparte: "" }); }}>
            Crear otro
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
        <button className="btn bg_ bsm" onClick={() => setPage("dashboard")}>✕ Cancelar</button>
        <div style={{ flex: 1 }} />
        <div className="wz">
          {["Detalles", "Condiciones", "Confirmar"].map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className={`wz-c ${step > i + 1 ? "d" : step === i + 1 ? "a" : ""}`}>
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <span className={`wz-l ${step === i + 1 ? "a" : ""}`}>{l}</span>
              </div>
              {i < 2 && <div className={`wz-ln ${step > i + 1 ? "d" : ""}`} />}
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
                {TIPOS.map(([id, ic, l]) => (
                  <div
                    key={id}
                    onClick={() => sf("tipo", id)}
                    style={{ border: `2px solid ${f.tipo === id ? "var(--g)" : "var(--s100)"}`, background: f.tipo === id ? "var(--cr)" : "#fff", borderRadius: 10, padding: "11px 7px", textAlign: "center", cursor: "pointer", transition: "all .15s" }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{ic}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: f.tipo === id ? "var(--g2)" : "var(--s600)" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="fg">
              <label className="fl">Título *</label>
              <input className="inp" placeholder="Ej: iPhone 13 Pro Max 256GB azul" value={f.titulo} onChange={(e) => sf("titulo", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">Descripción detallada</label>
              <textarea className="inp" rows="3" placeholder="Describe el producto o servicio con detalle..." value={f.descripcion} onChange={(e) => sf("descripcion", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <span>Monto en COP *</span>
                <span style={{ color: "var(--s400)", fontSize: 11.5, fontWeight: 600 }}>Monto mínimo permitido: {fmt(MONTO_MINIMO_TRATO)}</span>
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--s400)", fontSize: 14 }}>$</span>
                <input
                  className="inp"
                  style={{ paddingLeft: 26 }}
                  placeholder="0"
                  value={f.monto}
                  onChange={(e) => sf("monto", e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, "."))}
                />
              </div>
            </div>
            {monto > 0 && <CommissionBreakdown monto={monto} quien={f.quien} />}
            <div className="fg" style={{ marginTop: 14 }}>
              <label className="fl">Notas adicionales</label>
              <textarea className="inp" rows="2" placeholder="Condiciones especiales, detalles del envío, etc." value={f.notas} onChange={(e) => sf("notas", e.target.value)} maxLength={500} />
            </div>
            <button
              className="btn bp blg"
              style={{ width: "100%", marginTop: 6 }}
              onClick={() => {
                if (!f.titulo || f.titulo.trim().length < 5) { toast("El título debe tener mínimo 5 caracteres", "error"); return; }
                if (monto < MONTO_MINIMO_TRATO) { toast(`El monto mínimo es ${fmt(MONTO_MINIMO_TRATO)}`, "error"); return; }
                setStep(2);
              }}
            >
              Continuar →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="fi">
            <button className="btn bg_ bsm" style={{ marginBottom: 16 }} onClick={() => setStep(1)}>← Atrás</button>
            <h2 style={{ fontSize: 21, marginBottom: 16 }}>Condiciones del trato</h2>
            <div className="fg">
              <label className="fl">¿Quién paga la comisión de TratoYa?</label>
              <select className="inp" value={f.quien} onChange={(e) => sf("quien", e.target.value)}>
                <option value="por_definir" disabled>Por definir</option>
                <option value="comprador">La paga el comprador (más común)</option>
                <option value="vendedor">La asume el vendedor</option>
                <option value="compartida">50% / 50% compartida</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">Días de inspección para el comprador</label>
              <select className="inp" value={f.dias} onChange={(e) => sf("dias", e.target.value)}>
                {[1, 2, 3, 5, 7].map((d) => (
                  <option key={d} value={d}>{d} día{d > 1 ? "s" : ""}</option>
                ))}
              </select>
              <div className="fh">Tiempo que tiene el comprador para confirmar recepción antes de liberar el pago automáticamente.</div>
            </div>
            <div className="fg" style={{ marginTop: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
                <input type="checkbox" checked={f.directo} onChange={(e) => sf("directo", e.target.checked)} style={{ width: 16, height: 16 }} />
                <span className="fl" style={{ marginBottom: 0 }}>Invitar por ID de usuario</span>
              </label>
            </div>
            {f.directo && (
              <div className="fg fi">
                <label className="fl">Nombre de Usuario</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="inp"
                    placeholder="Ingresar usuario"
                    value={f.contraparte}
                    onChange={(e) => sf("contraparte", normalizeHandle(e.target.value))}
                    onKeyDown={(e) => e.key === "Enter" && buscarContraparte()}
                  />
                  <button className="btn bn" onClick={buscarContraparte} disabled={lookup.loading}>
                    {lookup.loading ? <div className="spin" /> : "Buscar"}
                  </button>
                </div>
                {lookup.error && <div style={{ color: "var(--re)", fontSize: 12, marginTop: 4 }}>{lookup.error}</div>}
                {lookup.data && (
                  <div style={{ background: "var(--cr)", borderRadius: 9, padding: "10px 13px", marginTop: 8, fontSize: 13 }}>
                    ✅ Contraparte encontrada: <strong>{lookup.data.nombre_mascarado || "Usuario verificado"}</strong>
                  </div>
                )}
              </div>
            )}
            <CommissionBreakdown monto={monto} quien={f.quien} />
            <button className="btn bp blg" style={{ width: "100%", marginTop: 14 }} onClick={() => {
              if (!["comprador", "vendedor", "compartida"].includes(f.quien)) { toast("Define quién paga la comisión.", "error"); return; }
              setStep(3);
            }}>
              Continuar →
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="fi">
            <button className="btn bg_ bsm" style={{ marginBottom: 16 }} onClick={() => setStep(2)}>← Atrás</button>
            <h2 style={{ fontSize: 21, marginBottom: 16 }}>Confirmar trato</h2>
            <div className="card" style={{ padding: "18px 20px", marginBottom: 14 }}>
              {[["Tipo", f.tipo], ["Título", f.titulo], ["Monto", fmt(monto)], ["Comisión", f.quien === "comprador" ? "La paga el comprador" : f.quien === "vendedor" ? "La asume el vendedor" : "50% / 50% compartida"], ["Días de inspección", `${f.dias} días`]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--s100)", fontSize: 13 }}>
                  <span style={{ color: "var(--s600)" }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <CommissionBreakdown monto={monto} quien={f.quien} />
            <div style={{ marginTop: 14, display: "flex", gap: 9 }}>
              <button className="btn bo blg" style={{ flex: 1 }} onClick={() => setStep(1)}>Editar</button>
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
