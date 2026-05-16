import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { normalizeHandle, DOC_TYPES, FINANCIAL_ENTITIES, getBankType, BREB_ENTITY } from "../lib/utils";
import Avatar from "../components/Avatar";

export default function Perfil({ user, setUser, toast }) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    nombre: user?.nombre || "",
    apellido: user?.apellido || "",
    telefono: user?.telefono || "",
    ciudad: user?.ciudad || "",
    usuario_unico: user?.usuario_unico || "",
    tipo_identificacion: user?.tipo_identificacion || "CC",
    cedula: user?.cedula || "",
  });
  const [bank, setBank] = useState({ banco: "", tipo: "ahorros", numero: "", titular: `${user?.nombre || ""} ${user?.apellido || ""}`.trim() });
  const bankKind = getBankType(bank.banco); // "bank" | "wallet" | "breb"
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    api.get("/users/bank-accounts").then((r) => setAccounts(r.data || [])).catch(() => {});
  }, []);

  const sp = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const sb = (k, v) => setBank((p) => ({ ...p, [k]: v }));

  const saveProfile = async () => {
    const handle = normalizeHandle(profile.usuario_unico);
    if (!/^[a-z0-9]{5,24}$/.test(handle)) { toast("El nombre de usuario debe tener de 5 a 24 letras/números.", "error"); return; }
    setLoading(true);
    try {
      const r = await api.put("/users/profile", { ...profile, usuario_unico: handle });
      const updated = r.data || { ...user, ...profile, usuario_unico: handle };
      setUser(updated);
      import("../lib/api").then(({ saveSession }) => {});
      window.localStorage.setItem("ty_user", JSON.stringify(updated));
      setProfile((p) => ({ ...p, usuario_unico: handle }));
      toast("Perfil actualizado", "success");
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  const saveBank = async () => {
    if (!bank.banco) { toast("Selecciona la entidad financiera.", "error"); return; }
    if (bankKind === "breb" && !bank.numero) { toast("Ingresa tu llave Bre-B.", "error"); return; }
    if (bankKind !== "breb" && !bank.numero) { toast("Escribe el número de cuenta o teléfono.", "error"); return; }
    const payload = {
      ...bank,
      tipo: bankKind === "breb" ? "breb" : bankKind === "wallet" ? bank.banco.toLowerCase().replace(/[^a-z]/g, "").slice(0, 10) : bank.tipo,
    };
    // Fix tipo to match valid enum values
    if (!["ahorros","corriente","nequi","daviplata","breb"].includes(payload.tipo)) {
      payload.tipo = "nequi"; // wallet genérico
    }
    setLoading(true);
    try {
      const r = await api.post("/users/bank-accounts", payload);
      setAccounts((p) => [r.data, ...p]);
      setBank({ banco: "", tipo: "ahorros", numero: "", titular: `${user?.nombre || ""} ${user?.apellido || ""}`.trim() });
      toast("Información bancaria registrada", "success");
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  return (
    <div className="page fi">
      <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 18 }}>Perfil</h1>
      <div className="g2" style={{ gap: 14 }}>
        <div>
          <div className="card" style={{ padding: "18px 20px", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 13, marginBottom: 16 }}>
              <Avatar name={`${user?.nombre || ""} ${user?.apellido || ""}`} size={52} />
              <div>
                <h3 style={{ fontSize: 16, marginBottom: 5 }}>{user?.nombre} {user?.apellido}</h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className={`bdg ${user?.kyc_nivel !== "ninguno" ? "gn" : "or"}`}>{user?.kyc_nivel !== "ninguno" ? "✓ Verificado" : "Sin verificar"}</span>
                  <span className="bdg nb">{user?.plan || "gratuito"}</span>
                </div>
              </div>
            </div>
            <div className="g2" style={{ gap: 10 }}>
              {[["Email", user?.email], ["Nombre de usuario", user?.usuario_unico ? `@${user.usuario_unico}` : "—"], ["Teléfono", user?.telefono || "—"], ["Reputación", `${parseFloat(user?.reputacion || 0).toFixed(1)}★`]].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: "var(--s400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: "18px 20px" }}>
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Datos de cuenta</h3>
            <div className="g2" style={{ gap: 10 }}>
              <div className="fg"><label className="fl">Nombre</label><input className="inp" value={profile.nombre} onChange={(e) => sp("nombre", e.target.value)} /></div>
              <div className="fg"><label className="fl">Apellido</label><input className="inp" value={profile.apellido} onChange={(e) => sp("apellido", e.target.value)} /></div>
            </div>
            <div className="fg">
              <label className="fl">Nombre de usuario</label>
              <input className="inp" value={profile.usuario_unico} onChange={(e) => sp("usuario_unico", normalizeHandle(e.target.value))} placeholder="letrasynumeros" />
              <div className="fh">5 a 24 letras/números. Sirve para recibir tratos directos (ej. @{profile.usuario_unico || "tunombre"}).</div>
            </div>
            <div className="g2" style={{ gap: 10 }}>
              <div className="fg">
                <label className="fl">Tipo de identificación</label>
                <select className="inp" value={profile.tipo_identificacion} onChange={(e) => sp("tipo_identificacion", e.target.value)}>
                  {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="fl">Número</label>
                <input className="inp" value={profile.cedula || ""} onChange={(e) => sp("cedula", e.target.value.replace(/[^\w.-]/g, ""))} />
              </div>
            </div>
            <div className="g2" style={{ gap: 10 }}>
              <div className="fg"><label className="fl">WhatsApp</label><input className="inp" value={profile.telefono || ""} onChange={(e) => sp("telefono", e.target.value)} /></div>
              <div className="fg"><label className="fl">Ciudad</label><input className="inp" value={profile.ciudad || ""} onChange={(e) => sp("ciudad", e.target.value)} /></div>
            </div>
            <button className="btn bp" style={{ width: "100%" }} onClick={saveProfile} disabled={loading}>
              {loading ? <><div className="spin" /> Guardando...</> : "Guardar perfil"}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <h3 style={{ fontSize: 14, marginBottom: 5 }}>Información bancaria</h3>
          <p style={{ fontSize: 13, color: "var(--s600)", marginBottom: 14 }}>
            Registra dónde quieres recibir liberaciones futuras. Para Nequi/Daviplata usa tu número celular.
          </p>
          <div className="fg">
            <label className="fl">Entidad financiera</label>
            <select className="inp" value={bank.banco} onChange={(e) => {
              sb("banco", e.target.value);
              if (e.target.value === "Nequi") sb("tipo", "nequi");
              if (e.target.value === "Daviplata") sb("tipo", "daviplata");
            }}>
              <option value="">Seleccionar entidad</option>
              {FINANCIAL_ENTITIES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {bankKind === "bank" && (
            <div className="g2" style={{ gap: 10 }}>
              <div className="fg">
                <label className="fl">Tipo de cuenta</label>
                <select className="inp" value={bank.tipo} onChange={(e) => sb("tipo", e.target.value)}>
                  <option value="ahorros">Cuenta de ahorros</option>
                  <option value="corriente">Cuenta corriente</option>
                </select>
              </div>
              <div className="fg">
                <label className="fl">Número de cuenta</label>
                <input className="inp" value={bank.numero} onChange={(e) => sb("numero", e.target.value.replace(/[^\d]/g, ""))} placeholder="123456789" />
              </div>
            </div>
          )}
          {bankKind === "wallet" && (
            <div className="fg">
              <label className="fl">Número de teléfono</label>
              <input className="inp" value={bank.numero} onChange={(e) => sb("numero", e.target.value.replace(/[^\d]/g, ""))} placeholder="3001234567" />
            </div>
          )}
          {bankKind === "breb" && (
            <div className="fg">
              <label className="fl">Llave Bre-B</label>
              <input className="inp" value={bank.numero} onChange={(e) => sb("numero", e.target.value)} placeholder="@ingresa tu llave" style={{ color: bank.numero ? undefined : "var(--s400)" }} />
              <div className="fh">Puede ser tu celular, email o alias con @</div>
            </div>
          )}
          <div className="fg">
            <label className="fl">Titular</label>
            <input className="inp" value={bank.titular} onChange={(e) => sb("titular", e.target.value)} />
          </div>
          <button className="btn bp" style={{ width: "100%" }} onClick={saveBank} disabled={loading}>
            {loading ? <><div className="spin" /> Guardando...</> : "Guardar información bancaria"}
          </button>
          {accounts.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {accounts.map((a) => (
                <div key={a.id} style={{ background: "var(--s50)", border: "1px solid var(--s100)", borderRadius: 9, padding: "10px 12px", marginTop: 8, fontSize: 13 }}>
                  <b>{a.banco}</b> · {a.tipo} · {String(a.numero || "").replace(/\d(?=\d{4})/g, "*")}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
