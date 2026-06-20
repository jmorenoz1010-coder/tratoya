const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "tratoya.com" || host === "www.tratoya.com") return "https://api.tratoya.com/api";
  }
  return "/api";
};

export const API_URL = getApiUrl();

const SESSION_KEYS = ["ty_token", "ty_refresh", "ty_user"];
const sessionStore = () => window.localStorage;

export const clearLegacySession = () =>
  SESSION_KEYS.forEach((k) => window.sessionStorage.removeItem(k));

export const saveSession = (token, refresh, user) => {
  clearLegacySession();
  sessionStore().setItem("ty_token", token);
  sessionStore().setItem("ty_refresh", refresh || "");
  sessionStore().setItem("ty_user", JSON.stringify(user));
};

export const clearSession = () => {
  SESSION_KEYS.forEach((k) => sessionStore().removeItem(k));
  clearLegacySession();
};

export const getSavedUser = () => {
  try {
    return JSON.parse(sessionStore().getItem("ty_user") || "null");
  } catch {
    return null;
  }
};

export const api = {
  _tok: () => sessionStore().getItem("ty_token"),
  _refresh: () => sessionStore().getItem("ty_refresh"),

  async req(method, path, body = null, isForm = false) {
    const h = {};
    const tok = this._tok();
    if (tok) h["Authorization"] = `Bearer ${tok}`;
    if (!isForm) h["Content-Type"] = "application/json";
    let r;
    try {
      r = await fetch(`${API_URL}${path}`, {
        method,
        headers: h,
        body: body ? (isForm ? body : JSON.stringify(body)) : null,
      });
    } catch {
      throw new Error(
        "No se pudo conectar con el servidor de TratoYA. Intenta de nuevo en unos segundos."
      );
    }
    const d = await r
      .json()
      .catch(() => ({ success: false, message: "Error de conexión" }));
    if (!r.ok) {
      if (r.status === 401 && tok && this._refresh() && path !== "/auth/refresh") {
        try {
          const rr = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: this._refresh() }),
          });
          const rd = await rr.json().catch(() => ({}));
          if (rr.ok && rd.token) {
            sessionStore().setItem("ty_token", rd.token);
            if (rd.refresh_token) sessionStore().setItem("ty_refresh", rd.refresh_token);
            return this.req(method, path, body, isForm);
          }
        } catch { /* sigue al cierre de sesión */ }
      }
      // express-validator devuelve { errors: [{msg, path}] } sin campo message
      let msg = d.message;
      if (!msg && Array.isArray(d.errors) && d.errors.length > 0) {
        msg = d.errors.map((e) => e.msg).join(". ");
      }
      const err = new Error(msg || `Error ${r.status}`);
      err.status = r.status;
      if (r.status === 401 && tok) {
        clearSession();
        setTimeout(() => {
          window.location.href = "/";
        }, 250);
      }
      throw err;
    }
    return d;
  },

  get: (p) => api.req("GET", p),
  post: (p, b) => api.req("POST", p, b),
  put: (p, b) => api.req("PUT", p, b),
  delete: (p, b) => api.req("DELETE", p, b),
  del: (p, b) => api.req("DELETE", p, b),
  upload: (p, f) => api.req("POST", p, f, true),
};
