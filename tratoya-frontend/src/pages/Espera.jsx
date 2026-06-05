import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../lib/api";

const cities = ["Bogotá", "Medellín", "Barranquilla", "Cartagena", "Cali", "Otra"];

const format = (value) => Number(value || 0).toLocaleString("es-CO");

function shareText(link) {
  return `¡Me acabo de unir a TratoYA, el primer servicio de tratos seguros de Colombia! Únete con mi link y ambos subimos posiciones: ${link}`;
}

export default function Espera() {
  const [stats, setStats] = useState({ total_registrados: 0 });
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", ciudad: "Bogotá" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const referralCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("ref") || "").trim().toUpperCase();
  }, []);

  useEffect(() => {
    document.title = "Trato YA / Lista de espera";
    fetch(`${API_URL}/waitlist/stats`)
      .then((res) => res.json())
      .then((data) => setStats(data || {}))
      .catch(() => {});
  }, []);

  const referralLink = result?.referral_code
    ? `${window.location.origin}/espera?ref=${encodeURIComponent(result.referral_code)}`
    : "";

  async function submit(e) {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/waitlist/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, referral_code: referralCode || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No pudimos registrarte. Intenta de nuevo.");
      setResult({ ...data, nombre: form.nombre });
      setStats((prev) => ({ ...prev, total_registrados: Number(prev.total_registrados || 0) + 1 }));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copy(value, label = "Copiado") {
    await navigator.clipboard.writeText(value);
    setMessage(label);
  }

  return (
    <main className="wait-page">
      <section className="wait-hero">
        <div className="wait-glow wait-glow-one" />
        <div className="wait-glow wait-glow-two" />
        <div className="wait-wrap wait-grid">
          <div className="wait-copy">
            <p className="wait-kicker">Pre-lanzamiento Colombia</p>
            <h1>Trato<span>YA</span></h1>
            <h2>El primer servicio de tratos seguros de Colombia</h2>
            <p className="wait-subtitle">
              Compra, vende y contrata sin miedo. Tu dinero protegido hasta que el trato se cumpla.
            </p>
            <div className="wait-counter" aria-label="Personas registradas">
              <strong>{format(stats.total_registrados)}</strong>
              <small>personas ya pidieron su lugar</small>
            </div>
          </div>

          <div className="wait-card">
            {!result ? (
              <form onSubmit={submit} className="wait-form">
                <div>
                  <p className="wait-form-label">Lista de espera</p>
                  <h3>Reserva tu lugar</h3>
                  {referralCode && (
                    <div className="wait-invite">Fuiste invitado/a por un miembro de TratoYA 🎉</div>
                  )}
                </div>
                <label>
                  Nombre completo
                  <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required placeholder="Tu nombre" />
                </label>
                <label>
                  Email
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="tu@correo.com" />
                </label>
                <label>
                  Teléfono
                  <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+57 300 123 4567" />
                </label>
                <label>
                  Ciudad
                  <select value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })}>
                    {cities.map((city) => <option key={city}>{city}</option>)}
                  </select>
                </label>
                <button className="wait-primary" disabled={loading}>{loading ? "Guardando..." : "Quiero mi lugar"}</button>
                <p className="wait-note">Gratis. Sin tarjeta. Sin compromisos.</p>
                {message && <p className="wait-message">{message}</p>}
              </form>
            ) : (
              <div className="wait-success">
                <p className="wait-form-label">Registro confirmado</p>
                <h3>¡Listo, {result.nombre}! Eres el #{format(result.posicion)}</h3>
                {result.es_fundador && (
                  <div className="wait-founder">🏆 Eres Fundador TratoYA — 0% comisión por 6 meses</div>
                )}
                <div className="wait-ref">
                  <span>Sube de posición</span>
                  <code>{referralLink}</code>
                  <button onClick={() => copy(referralLink, "Link copiado")}>Copiar link</button>
                </div>
                <div className="wait-share">
                  <a href={`https://wa.me/?text=${encodeURIComponent(shareText(referralLink))}`} target="_blank" rel="noreferrer">WhatsApp</a>
                  <button onClick={() => copy(shareText(referralLink), "Texto copiado para Instagram")}>Instagram</button>
                  <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Acabo de unirme a @TratoYA 🇨🇴 El servicio de tratos seguros que Colombia necesitaba. Únete aquí: ${referralLink} #TratoYA #Fintech #Colombia`)}`} target="_blank" rel="noreferrer">X</a>
                </div>
                <div className="wait-benefits">
                  <div><strong>Top 1.000</strong><span>0% comisión por 6 meses + badge Fundador</span></div>
                  <div><strong>Resto de la lista</strong><span>Acceso anticipado según posición</span></div>
                </div>
                {message && <p className="wait-message">{message}</p>}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="wait-section wait-wrap">
        <p className="wait-kicker">Cómo funciona</p>
        <h2>Una forma más tranquila de cerrar negocios</h2>
        <div className="wait-steps">
          <article><WaitIcon type="deal" /><h3>Crea un Trato</h3><p>Describes los términos, el monto y lo que debe cumplirse.</p></article>
          <article><WaitIcon type="pay" /><h3>Paga con garantía</h3><p>Tu dinero queda protegido por TratoYA mientras avanza el acuerdo.</p></article>
          <article><WaitIcon type="done" /><h3>Recibe cuando se cumple</h3><p>Confirmas la entrega y el dinero se libera de forma clara.</p></article>
        </div>
      </section>

      <section className="wait-section wait-problem">
        <div className="wait-wrap wait-problem-grid">
          <div>
            <p className="wait-kicker">Por qué TratoYA</p>
            <h2>El 34% de las transacciones informales en Colombia termina en disputa</h2>
            <p>Ese espacio de incertidumbre es justo donde TratoYA quiere ayudar: acuerdos claros, pagos protegidos y seguimiento para ambas partes.</p>
          </div>
          <div className="wait-lists">
            <div>
              <h3>Hoy duele</h3>
              <p>Pagos por adelantado sin garantía.</p>
              <p>Conversaciones dispersas por chats.</p>
              <p>Poca claridad si alguien incumple.</p>
            </div>
            <div>
              <h3>Con TratoYA</h3>
              <p>Condiciones visibles desde el inicio.</p>
              <p>Dinero protegido hasta cumplir.</p>
              <p>Historial y soporte para decidir mejor.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="wait-footer">
        <div className="wait-wrap">
          <strong>Trato<span>YA</span></strong>
          <a href="mailto:hola@tratoya.com">hola@tratoya.com</a>
          <small>© 2026 TratoYA. Todos los derechos reservados.</small>
        </div>
      </footer>
    </main>
  );
}

function WaitIcon({ type }) {
  if (type === "deal") {
    return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 12h22a4 4 0 0 1 4 4v21H9V16a4 4 0 0 1 4-4Z" /><path d="M16 20h16M16 27h11" /></svg>;
  }
  if (type === "pay") {
    return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 16h30a4 4 0 0 1 4 4v16H9z" /><path d="M9 22h34M31 31h6" /></svg>;
  }
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6 38 12v10c0 10-6 16-14 20-8-4-14-10-14-20V12z" /><path d="m17 24 5 5 10-11" /></svg>;
}
