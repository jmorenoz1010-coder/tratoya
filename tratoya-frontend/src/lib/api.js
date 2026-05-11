export const API_URL = import.meta.env.VITE_API_URL || "/api";

const SESSION_KEYS = ["ty_token", "ty_refresh", "ty_user"];
const sessionStore = () => window.sessionStorage;

export const clearLegacySession = () =>
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));

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
      const err = new Error(d.message || `Error ${r.status}`);
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
  upload: (p, f) => api.req("POST", p, f, true),
};
