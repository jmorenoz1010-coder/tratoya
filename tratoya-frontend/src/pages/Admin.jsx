import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { API_URL } from "../lib/api";

const fmt = (value) => Number(value || 0).toLocaleString("es-CO");

export default function WaitlistAdmin() {
  const [key, setKey] = useState(() => localStorage.getItem("ty_waitlist_admin_key") || "");
  const [draftKey, setDraftKey] = useState(key);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cantidad, setCantidad] = useState(50);

  const headers = useMemo(() => ({ "X-Admin-Key": key }), [key]);

  useEffect(() => {
    document.title = "Trato YA / Admin waitlist";
  }, []);

  useEffect(() => {
    if (key) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/waitlist/admin/dashboard`, { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "No pudimos cargar el panel.");
      setData(json);
    } catch (err) {
      setError(err.message);
      if (err.message.toLowerCase().includes("clave")) {
        localStorage.removeItem("ty_waitlist_admin_key");
        setKey("");
      }
    } finally {
      setLoading(false);
    }
  }

  function submitKey(e) {
    e.preventDefault();
    localStorage.setItem("ty_waitlist_admin_key", draftKey);
    setKey(draftKey);
  }

  async function activateNext() {
    const n = Number(cantidad);
    if (!n || n < 1) return;
    if (!window.confirm(`¿Activar los próximos ${n} usuarios de la lista?`)) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/waitlist/admin/activar`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad: n }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "No se pudo activar usuarios.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    setError("");
    try {
      const res = await fetch(`${API_URL}/waitlist/admin/export`, { headers });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "No se pudo exportar CSV.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tratoya-waitlist.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!key) {
    return (
      <main className="wait-admin-login">
        <form onSubmit={submitKey}>
          <p>TratoYA Waitlist</p>
          <h1>Panel de administración</h1>
          <label>
            Clave de acceso
            <input type="password" value={draftKey} onChange={(e) => setDraftKey(e.target.value)} autoFocus />
          </label>
          <button>Entrar</button>
          {error && <span>{error}</span>}
        </form>
      </main>
    );
  }

  const maxCity = Math.max(...(data?.registros_por_ciudad || []).map((item) => Number(item.count || 0)), 1);

  return (
    <main className="wait-admin">
      <header>
        <div>
          <p>TratoYA Waitlist</p>
          <h1>Lista de espera</h1>
        </div>
        <div className="wait-admin-actions">
          <button onClick={load} disabled={loading}>Actualizar</button>
          <button onClick={() => { localStorage.removeItem("ty_waitlist_admin_key"); setKey(""); }}>Salir</button>
        </div>
      </header>

      {error && <div className="wait-admin-error">{error}</div>}
      {!data && loading ? <div className="wait-admin-loading">Cargando métricas...</div> : null}

      {data && (
        <>
          <section className="wait-admin-metrics">
            <Metric label="Total registrados" value={data.total_registrados} />
            <Metric label="Hoy" value={data.registros_hoy} />
            <Metric label="Esta semana" value={data.registros_semana} />
            <Metric label="Activados" value={data.total_activados} />
            <Metric label="Fundadores" value={data.total_fundadores} />
          </section>

          <section className="wait-admin-panel wait-admin-chart">
            <div className="wait-admin-panel-head">
              <h2>Registros por día</h2>
              <div>
                <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                <button onClick={activateNext} disabled={loading}>Activar próximos N usuarios</button>
                <button onClick={exportCsv}>Exportar CSV</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.registros_por_dia || []}>
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#F5A623" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="wait-admin-grid">
            <TablePanel title="Top 20 referidores">
              <table>
                <thead><tr><th>Nombre</th><th>Email</th><th>Referidos</th><th>Posición</th></tr></thead>
                <tbody>
                  {(data.top_referidores || []).map((row) => (
                    <tr key={row.email}><td>{row.nombre}</td><td>{row.email}</td><td>{fmt(row.referidos_count)}</td><td>#{fmt(row.posicion)}</td></tr>
                  ))}
                </tbody>
              </table>
            </TablePanel>

            <TablePanel title="Registros por ciudad">
              <div className="wait-city-list">
                {(data.registros_por_ciudad || []).map((row) => (
                  <div key={row.ciudad}>
                    <span>{row.ciudad}</span><strong>{fmt(row.count)}</strong>
                    <i style={{ width: `${(Number(row.count || 0) / maxCity) * 100}%` }} />
                  </div>
                ))}
              </div>
            </TablePanel>
          </section>

          <section className="wait-admin-panel">
            <h2>Últimos 20 registros</h2>
            <table>
              <thead><tr><th>Nombre</th><th>Email</th><th>Ciudad</th><th>Posición</th><th>Fecha</th></tr></thead>
              <tbody>
                {(data.ultimos_registros || []).map((row) => (
                  <tr key={`${row.email}-${row.created_at}`}>
                    <td>{row.nombre}</td>
                    <td>{row.email}</td>
                    <td>{row.ciudad || "Otra"}</td>
                    <td>#{fmt(row.posicion)}</td>
                    <td>{new Date(row.created_at).toLocaleString("es-CO")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}

function Metric({ label, value }) {
  return <article><span>{label}</span><strong>{fmt(value)}</strong></article>;
}

function TablePanel({ title, children }) {
  return <section className="wait-admin-panel"><h2>{title}</h2>{children}</section>;
}
