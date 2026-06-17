import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { fmt, fmtDate, timeAgo, ESTADO, TIPO_ICO, calcularComisionUI, parseCopAmount, publicTratoUrl } from "../lib/utils";
import CommissionBreakdown from "../components/CommissionBreakdown";
import DealProgress from "../components/DealProgress";
import StarRating from "../components/StarRating";
import Avatar from "../components/Avatar";
import ManualPaymentBox from "../components/ManualPaymentBox";
import CaducidadAviso from "../components/CaducidadAviso";
import { ShieldIcon, ScaleIcon, CashIcon, LockIcon, PersonIcon, BoltIcon, FlagIcon } from "../components/LandingIcons";

function ReviewBox({ tratoId, reviews, user, toast, onSaved }) {
  const mine = reviews.find((r) => r.autor_id === user?.id);
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
      <textarea className="inp" rows="3" style={{ marginTop: 10 }} placeholder="Escribe un comentario corto sobre tu experiencia..." value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      <button className="btn bp" style={{ width: "100%", marginTop: 10 }} onClick={submit} disabled={busy || !rating}>
        {busy ? <div className="spin" /> : mine ? "Actualizar reseña" : "Publicar reseña"}
      </button>
      {reviews.length > 0 && (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {reviews.map((r) => (
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

export default function TratoDetalle({ tratoId, setPage, setDisputeTratoId, user, toast, onStatusUpdate }) {
  const [trato, setTrato] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [guia, setGuia] = useState({ guia: "", transportadora: "", medio_envio: "servientrega", numero_contacto: "", punto_encuentro: "" });
  const [pruebaFotos, setPruebaFotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [paymentReport, setPaymentReport] = useState(null);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [chatOpen, setChatOpen] = useState(() => typeof window !== "undefined" && window.innerWidth > 860);
  const previousEstadoRef = useRef(null);
  const chatEndRef = useRef(null);
  const actionRef = useRef(null);
  const reviewRef = useRef(null);

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
      setTrato(nextTrato);
      setMsgs(m.data || []);
      setReviews(rv.data || []);
    } catch (e) {
      if (!silent) toast(e.message, "error");
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    previousEstadoRef.current = null;
    load();
    const t = setInterval(() => load(true), 14000);
    return () => clearInterval(t);
  }, [tratoId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const sendMsg = async () => {
    if (!msg.trim()) return;
    try {
      const r = await api.post(`/messages/${tratoId}`, { contenido: msg });
      setMsg("");
      if (r?.censored) toast("Por tu seguridad ocultamos datos de contacto. Mantén el trato dentro de TratoYa.", "warn");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  const action = async (fn, successMsg) => {
    setBusy(true);
    try { await fn(); toast(successMsg, "success"); load(); }
    catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const reportarPagoManual = async ({ method, transactionRef, transferConcept, receipt, notes }) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("dealId", tratoId);
      fd.append("method", method);
      fd.append("transactionRef", transactionRef);
      fd.append("transferConcept", transferConcept || "");
      fd.append("notes", notes || "");
      if (receipt) fd.append("receipt", receipt);
      const r = await api.upload(`/payments/manual/report`, fd);
      setPaymentReport(r.data || r);
      toast("Pago reportado. Lo revisaremos en máximo 1 hora.", "success");
      load();
      setTimeout(() => setPage("pagos"), 650);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const abrirDisputa = () => {
    setDisputeTratoId?.(tratoId);
    setPage("disputas");
  };

  if (loading) return (
    <div className="page" style={{ textAlign: "center", padding: 60 }}>
      <div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} />
    </div>
  );
  if (!trato) return <div className="page"><p>Trato no encontrado</p></div>;

  const ec = ESTADO[trato.estado] || ESTADO.borrador;
  const esV = trato.vendedor?.id === user?.id;
  const esC = trato.comprador?.id === user?.id;
  const cp = esV ? trato.comprador : trato.vendedor;
  const montoTrato = parseCopAmount(trato.monto);
  const quienComision = trato.quien_paga_comision || "comprador";
  const commissionCalc = calcularComisionUI(montoTrato, quienComision);
  const neto = commissionCalc.vendedorRecibe;
  const entrega = trato.metadata?.datos_entrega || {};
  const medioEnvio = entrega.medio_envio || trato.metadata?.medio_envio;
  const telefonoDomiciliario = entrega.numero_contacto || trato.metadata?.numero_contacto_domiciliario;
  const puntoEncuentro = entrega.punto_encuentro || trato.metadata?.punto_encuentro;

  const steps = [
    { l: "Trato creado",   s: "Condiciones aceptadas", done: true },
    { l: "Pago protegido", s: `${fmt(montoTrato)} seguro`, done: ["pago_retenido","en_entrega","confirmado","completado"].includes(trato.estado), active: trato.estado === "pago_retenido" },
    { l: "En entrega",    s: trato.guia_envio ? (medioEnvio === "en_persona" ? `📍 ${puntoEncuentro || "En persona"}` : medioEnvio === "domiciliario" ? `🛵 ${telefonoDomiciliario || "contacto"}` : `Guía ${trato.guia_envio}`) : "Pendiente", done: ["en_entrega","confirmado","completado"].includes(trato.estado), active: trato.estado === "en_entrega" },
    { l: "Confirmación",  s: "Comprador verifica", done: ["confirmado","completado"].includes(trato.estado), active: trato.estado === "confirmado" },
    { l: "Pago liberado", s: `${fmt(neto)} al vendedor`, done: trato.estado === "completado" },
  ];

  const canPay = esC && trato.estado === "activo";
  const canConfirm = esC && ["en_entrega","pendiente_confirmacion"].includes(trato.estado);
  const canShip = esV && trato.estado === "pago_retenido";

  return (
    <div className="page fi">
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
          <button className="btn bg_ bsm" onClick={() => setPage("tratos")}>← Volver</button>
          <div style={{ height: 14, width: 1, background: "var(--s200)" }} />
          <span style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 12.5, color: "var(--g2)" }}>{trato.codigo}</span>
          <span className={`bdg ${ec.c}`}>{ec.l}</span>
        </div>
        <CaducidadAviso trato={trato} />
        {/* ── Guía de próximo paso ────────────────────────── */}
        {!guideDismissed && (() => {
          // Definición de guías por estado + rol
          const PASO = {
            borrador: {
              V: { Icon: BoltIcon, titulo: "Comparte el link del trato", desc: "Cópiale el link al comprador para que lo acepte y realice el pago. Sin ese paso, el trato no avanza.", cta: "Copiar link", ctaType: "copy" },
              C: { Icon: ShieldIcon, titulo: "Acepta el trato para continuar", desc: "Debes aceptar este trato antes de poder pagar. Es el primer paso para proteger tu dinero.", cta: "Aceptar trato", ctaType: "accept" },
            },
            activo: {
              V: { Icon: PersonIcon, titulo: "Esperando el pago del comprador", desc: "El comprador recibió el link. Cuando realice la transferencia y la reporte, verás el trato avanzar." },
              C: { Icon: CashIcon, titulo: "¡Realiza el pago para activar el trato!", desc: "Transfiere el monto exacto con la referencia indicada y sube el comprobante. Verificamos en menos de 1 hora.", cta: "Ir a pagar", ctaType: "scroll" },
            },
            pago_pendiente: {
              V: { Icon: ScaleIcon, titulo: "Verificando el pago del comprador", desc: "El comprador ya reportó el pago. Nuestro equipo lo está revisando. Te notificamos en cuanto esté confirmado." },
              C: { Icon: ScaleIcon, titulo: "Tu pago está siendo verificado", desc: "Estamos revisando tu transferencia. Tiempo estimado: menos de 1 hora. Recibirás notificación cuando esté listo. No necesitas hacer nada más." },
            },
            pago_retenido: {
              V: { Icon: LockIcon, titulo: "¡Dinero protegido — ya puedes entregar!", desc: "El pago está en custodia de TratoYa. Registra el envío con guía, datos del domiciliario o punto de encuentro.", cta: "Registrar envío", ctaType: "scroll" },
              C: { Icon: ShieldIcon, titulo: "El dinero está protegido en TratoYa", desc: "El vendedor procederá a entregar el producto o servicio. Recibirás notificación cuando registre el envío." },
            },
            en_entrega: {
              V: { Icon: BoltIcon, titulo: "Entrega registrada — esperando confirmación", desc: "Ya registraste el envío. Cuando el comprador reciba el producto y lo confirme, el pago será liberado automáticamente." },
              C: { Icon: ShieldIcon, titulo: "¿Ya recibiste el producto?", desc: "El vendedor registró la entrega. Cuando lo tengas en tus manos y todo esté bien, confírmalo para liberar el pago.", cta: "Confirmar entrega", ctaType: "scroll" },
            },
            pendiente_confirmacion: {
              V: { Icon: PersonIcon, titulo: "Esperando que el comprador confirme", desc: `El comprador tiene hasta ${trato.dias_inspeccion || 7} días para confirmar la recepción. Puedes recordárselo por el chat del trato.` },
              C: { Icon: ShieldIcon, titulo: "¡Confirma para liberar el pago al vendedor!", desc: "El vendedor marcó la entrega como realizada. Si recibiste todo lo acordado en perfecto estado, confírmalo ahora.", cta: "Confirmar recepción", ctaType: "scroll" },
            },
            confirmado: {
              V: { Icon: ShieldIcon, titulo: "¡El comprador confirmó — pago siendo liberado!", desc: "Tu pago está en proceso de liberación. Lo recibirás en máximo 24 horas hábiles." },
              C: { Icon: ShieldIcon, titulo: "¡Trato casi completado!", desc: "Confirmaste la entrega. El pago al vendedor está siendo procesado." },
            },
            completado: {
              all: { Icon: ShieldIcon, titulo: "¡Trato completado con éxito!", desc: "Todo salió bien. Si quieres, deja una reseña para que otros usuarios conozcan tu experiencia.", cta: "Dejar reseña", ctaType: "scroll-review" },
            },
            disputado: {
              all: { Icon: ScaleIcon, titulo: "En revisión por disputa", desc: "Nuestro equipo está analizando la situación. Te notificaremos cuando haya una resolución. Mantén disponible cualquier evidencia." },
            },
            cancelado: {
              all: { Icon: FlagIcon, titulo: "Trato cancelado", desc: "Este trato no se completó. Si necesitas hacer una nueva transacción, puedes crear un nuevo trato." },
            },
            expirado: {
              all: { Icon: PersonIcon, titulo: "Trato vencido", desc: "Este trato venció sin completarse. Coordina con tu contraparte y crea uno nuevo si lo necesitan." },
            },
          };
          const rol = esV ? "V" : "C";
          const guiasEstado = PASO[trato.estado];
          if (!guiasEstado) return null;
          const guia = guiasEstado[rol] || guiasEstado.all;
          if (!guia) return null;
          const GuiaIcon = guia.Icon;

          const isActive = !["completado","cancelado","disputado","expirado"].includes(trato.estado);
          const isWaiting = ["pago_pendiente","confirmado"].includes(trato.estado)
            || (trato.estado === "activo" && esV)
            || (trato.estado === "en_entrega" && esV)
            || (trato.estado === "pago_retenido" && esC)
            || (trato.estado === "pendiente_confirmacion" && esV);
          const isUrgent = guia.cta && !isWaiting;

          const scrollToAction = () => {
            if (guia.ctaType === "scroll-review") {
              reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            } else {
              actionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              // Efecto de highlight
              if (actionRef.current) {
                actionRef.current.classList.add("nsg-highlight");
                setTimeout(() => actionRef.current?.classList.remove("nsg-highlight"), 1800);
              }
            }
          };

          const handleCta = () => {
            if (guia.ctaType === "copy") {
              navigator.clipboard.writeText(publicTratoUrl(trato.link_compartir))
                .then(() => toast("Link copiado ✓", "success"))
                .catch(() => toast("No pudimos copiar. Copia el link manualmente.", "error"));
            } else if (guia.ctaType === "accept") {
              action(() => api.put(`/tratos/${tratoId}/activar`), "Trato aceptado. Ya puedes pagar.");
            } else {
              scrollToAction();
            }
          };

          return (
            <div className={`nsg-card banner-dark ${isUrgent ? "nsg-urgent" : isWaiting ? "nsg-waiting" : "nsg-neutral"}`}>
              <button className="nsg-close" onClick={() => setGuideDismissed(true)} aria-label="Cerrar guía">×</button>
              <div className="nsg-head">
                <span className="nsg-ico">{GuiaIcon ? <GuiaIcon /> : null}</span>
                <div>
                  <div className="nsg-label">{isUrgent ? "Tu próximo paso" : isWaiting ? "Estado actual" : "Información"}</div>
                  <div className="nsg-title">{guia.titulo}</div>
                </div>
              </div>
              <p className="nsg-desc">{guia.desc}</p>
              {guia.cta && (
                <button className="nsg-cta" onClick={handleCta}>{guia.cta}</button>
              )}
            </div>
          );
        })()}

        {/* La descripción del estado solo aparece si la guía fue cerrada (evita texto duplicado) */}
        {guideDismissed && ec.desc && (
          <div style={{ background: "var(--cr)", border: "1px solid var(--s100)", borderRadius: 10, padding: "10px 13px" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--n)", lineHeight: 1.55 }}>{ec.desc}</p>
          </div>
        )}
      </div>

      <div className="td-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {/* Info del trato */}
          <div className="card td-card">
            <div className="td-strip">
              <div className="td-strip-ico">{TIPO_ICO[trato.tipo] || "📋"}</div>
              <div className="td-strip-info">
                <h2>{trato.titulo}</h2>
                <div className="td-strip-cp">
                  {cp
                    ? <><Avatar name={`${cp.nombre} ${cp.apellido}`} size={18} /> {esV ? "Comprador" : "Vendedor"}: <b>{cp.nombre} {cp.apellido}</b></>
                    : <span style={{ color: "var(--or)" }}>⚠ Esperando que alguien acepte el trato</span>}
                </div>
              </div>
              <div className="td-strip-amount">{fmt(montoTrato)}</div>
            </div>

            {/* Progreso visual */}
            <DealProgress steps={steps} />

            <details className="td-comm-toggle">
              <summary>Ver detalles del trato</summary>
              <div className="td-details-body">
                {trato.descripcion && (
                  <p className="td-details-desc">{trato.descripcion}</p>
                )}
                <div className="td-details-meta">
                  <div><span>Código</span><b>{trato.codigo}</b></div>
                  <div><span>Creado</span><b>{fmtDate(trato.createdAt)}</b></div>
                  <div><span>Días de inspección</span><b>{trato.dias_inspeccion || 7}</b></div>
                </div>
                <CommissionBreakdown monto={montoTrato} quien={quienComision} />
              </div>
            </details>

            {/* Acciones del vendedor: envío */}
            {canShip && (
              <div ref={actionRef} style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📦 Registrar envío</div>
                <div className="fg">
                  <label className="fl">Medio de envío</label>
                  <select className="inp" value={guia.medio_envio} onChange={(e) => setGuia((g) => ({ ...g, medio_envio: e.target.value }))}>
                    <option value="servientrega">Transportadora (Servientrega, Envia, etc.)</option>
                    <option value="domiciliario">Domiciliario</option>
                    <option value="en_persona">Entrega en persona</option>
                  </select>
                </div>
                {guia.medio_envio === "servientrega" && (
                  <div className="g2" style={{ gap: 9 }}>
                    <div className="fg"><label className="fl">Número de guía</label><input className="inp" placeholder="TRA1234567" value={guia.guia} onChange={(e) => setGuia((g) => ({ ...g, guia: e.target.value }))} /></div>
                    <div className="fg"><label className="fl">Transportadora</label><input className="inp" placeholder="Servientrega" value={guia.transportadora} onChange={(e) => setGuia((g) => ({ ...g, transportadora: e.target.value }))} /></div>
                  </div>
                )}
                {guia.medio_envio === "domiciliario" && (
                  <div className="fg"><label className="fl">Número de contacto del domiciliario</label><input className="inp" placeholder="300 123 4567" value={guia.numero_contacto} onChange={(e) => setGuia((g) => ({ ...g, numero_contacto: e.target.value }))} /></div>
                )}
                {guia.medio_envio === "en_persona" && (
                  <div className="fg"><label className="fl">Punto de encuentro</label><input className="inp" placeholder="Ej: Centro Comercial El Tesoro, entrada principal" value={guia.punto_encuentro} onChange={(e) => setGuia((g) => ({ ...g, punto_encuentro: e.target.value }))} /></div>
                )}
                <div className="fg">
                  <label className="fl">Fotos de prueba de entrega <span style={{ color: "var(--re)", fontWeight: 600 }}>*</span> <span style={{ color: "var(--s400)", fontWeight: 400 }}>(mín. 1, máx. 5)</span></label>
                  <label htmlFor={`prueba-input-${tratoId}`} className="uz" style={{ cursor: "pointer", display: "block" }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>📷</div>
                    <div style={{ fontSize: 13, color: "var(--s600)" }}>
                      {pruebaFotos.length > 0
                        ? `${pruebaFotos.length} foto(s) seleccionada(s) — toca para cambiar`
                        : "Toca para adjuntar fotos del producto o empaque"}
                    </div>
                  </label>
                  <input
                    id={`prueba-input-${tratoId}`}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => setPruebaFotos(Array.from(e.target.files))}
                  />
                  {pruebaFotos.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {pruebaFotos.map((f, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          <img src={URL.createObjectURL(f)} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--s100)" }} />
                          <button
                            onClick={() => setPruebaFotos((p) => p.filter((_, j) => j !== i))}
                            style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "var(--re)", color: "#fff", border: "none", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="btn bp"
                  style={{ width: "100%" }}
                  disabled={busy || pruebaFotos.length === 0}
                  onClick={async () => {
                    if (pruebaFotos.length === 0) { toast("Debes adjuntar al menos 1 foto de prueba de entrega.", "error"); return; }
                    setBusy(true);
                    try {
                      const fd = new FormData();
                      pruebaFotos.forEach((f, i) => fd.append(`foto_${i}`, f));
                      await api.upload(`/tratos/${tratoId}/prueba-entrega`, fd).catch(() => {});
                      await api.post(`/tratos/${tratoId}/registrar-guia`, guia);
                      toast("Envío registrado ✓", "success");
                      load();
                    } catch (e) { toast(e.message, "error"); }
                    setBusy(false);
                  }}
                >
                  {busy ? <div className="spin" /> : "📦 Confirmar envío"}
                </button>
              </div>
            )}

            {/* Info vendedor: link para compartir */}
            {esV && ["borrador","activo"].includes(trato.estado) && (
              <div style={{ marginTop: 11, background: "var(--cr)", padding: 13, borderRadius: 10, fontSize: 13, color: "var(--s600)" }}>
                <div style={{ fontWeight: 700, color: "var(--n)", marginBottom: 4 }}>Comparte este link con tu contraparte para que acepte y pague.</div>
                <div style={{ display: "flex", gap: 9, marginTop: 10, flexWrap: "wrap" }}>
                  <button className="btn bo bsm" onClick={() => { navigator.clipboard.writeText(publicTratoUrl(trato.link_compartir)); toast("Link copiado ✓", "success"); }}>🔗 Copiar link del trato</button>
                  <button className="btn bo bsm" onClick={() => {
                    const txt = `Hola, te comparto el link de nuestro trato seguro en TratoYa:%0A%0A🔒 *${trato.titulo || trato.codigo}*%0A💰 Monto del trato: ${encodeURIComponent(fmt(montoTrato))}%0A%0A👉 ${encodeURIComponent(publicTratoUrl(trato.link_compartir))}`;
                    window.open(`https://wa.me/?text=${txt}`, "_blank");
                  }}>📲 WhatsApp</button>
                </div>
              </div>
            )}

            {/* Acción del comprador: pagar */}
            {canPay && (
              <div ref={actionRef} style={{ marginTop: 11 }}>
                <ManualPaymentBox amount={commissionCalc.totalPagar} reference={trato.codigo} busy={busy} onReport={reportarPagoManual} toast={(m, t) => toast(m, t || "error")} />
                {paymentReport?.reference && (
                  <div style={{ fontSize: 11, color: "var(--s600)", marginTop: 8 }}>Reporte: {paymentReport.reference}</div>
                )}
              </div>
            )}

            {/* Acción del comprador: confirmar */}
            {canConfirm && (
              <div ref={actionRef} style={{ marginTop: 11, display: "flex", gap: 9 }}>
                <button className="btn bp" style={{ flex: 1 }} onClick={() => action(() => api.post(`/tratos/${tratoId}/confirmar`), "¡Entrega confirmada! El pago será liberado.")} disabled={busy}>
                  {busy ? <div className="spin" /> : "✅ Confirmar que lo recibí"}
                </button>
                <button className="btn bdd" onClick={abrirDisputa}>Disputar</button>
              </div>
            )}

            {/* Completado */}
            {trato.estado === "completado" && (
              <div style={{ marginTop: 14, background: "var(--cr)", borderRadius: 11, padding: "13px 15px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>🎉</div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--g2)" }}>¡Trato completado con éxito!</div>
              </div>
            )}
          </div>

          {/* Reseña */}
          {trato.estado === "completado" && (
            <div ref={reviewRef}>
              <ReviewBox tratoId={tratoId} reviews={reviews} user={user} toast={toast} onSaved={() => load(true)} />
            </div>
          )}
        </div>

        {/* Columna derecha: chat + acciones */}
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div className={`card chat-card ${chatOpen ? "" : "chat-card--closed"}`}>
            <button type="button" className="td-chat-head" onClick={() => setChatOpen((v) => !v)} aria-expanded={chatOpen}>
              <Avatar name={cp ? `${cp.nombre} ${cp.apellido}` : "?"} size={28} />
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{cp ? `${cp.nombre} ${cp.apellido}` : "Sin contraparte"}</div>
                <div style={{ fontSize: 10.5, color: "var(--s400)" }}>
                  Chat del trato{msgs.length > 0 ? ` · ${msgs.length} mensaje${msgs.length === 1 ? "" : "s"}` : ""}
                </div>
              </div>
              <span className={`td-chat-chev ${chatOpen ? "open" : ""}`} aria-hidden="true">▾</span>
            </button>
            {chatOpen && (
              <>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
                  {msgs.length === 0 && (
                    <div style={{ textAlign: "center", color: "var(--s400)", fontSize: 13, marginTop: 18 }}>Sin mensajes aún.</div>
                  )}
                  {msgs.map((m, i) => {
                    const mine = m.remitente_id === user?.id;
                    return (
                      <div key={i} style={{ maxWidth: "85%", alignSelf: mine ? "flex-end" : "flex-start" }}>
                        <div style={{ background: mine ? "var(--n)" : "var(--s50)", color: mine ? "#fff" : "var(--n)", borderRadius: mine ? "11px 11px 3px 11px" : "11px 11px 11px 3px", padding: "8px 12px", fontSize: 13, border: mine ? "none" : "1px solid var(--s100)" }}>
                          {m.contenido}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--s400)", marginTop: 2, textAlign: mine ? "right" : "left" }}>
                          {timeAgo(m.createdAt)}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                {cp && (
                  <div style={{ display: "flex", gap: 6, paddingTop: 9, borderTop: "1px solid var(--s100)", marginTop: 7 }}>
                    <input
                      className="inp"
                      style={{ height: 34, fontSize: 13 }}
                      placeholder="Escribe un mensaje..."
                      value={msg}
                      onChange={(e) => setMsg(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMsg()}
                    />
                    <button className="btn bp bsm" onClick={sendMsg}>→</button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="td-quick-actions">
            <button className="btn bo bsm" onClick={() => { navigator.clipboard.writeText(publicTratoUrl(trato.link_compartir)); toast("Link copiado ✓", "success"); }}>
              🔗 Copiar link
            </button>
            {!["disputado","completado","cancelado"].includes(trato.estado) && (
              <button className="btn bg_ bsm td-dispute-link" onClick={abrirDisputa}>
                ⚖️ Abrir disputa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
