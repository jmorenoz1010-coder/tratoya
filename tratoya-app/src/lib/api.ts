/**
 * Cliente API de TratoYa — consume el mismo backend que la web
 * (https://api.tratoya.com/api). Tokens en SecureStore (cifrado por el SO).
 */
import * as SecureStore from 'expo-secure-store';

export const API_URL = 'https://api.tratoya.com/api';

const KEY_TOKEN = 'ty_token';
const KEY_REFRESH = 'ty_refresh';
const KEY_USER = 'ty_user';

// Cache en memoria para no golpear SecureStore en cada request
let _token: string | null = null;
let _refresh: string | null = null;
let _user: TyUser | null = null;

export type TyUser = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  usuario_unico?: string;
  telefono?: string | null;
  reputacion?: number;
  kyc_nivel?: string;
  email_verificado?: boolean;
  rol?: string;
  [k: string]: unknown;
};

type ApiResponse<T = unknown> = {
  success?: boolean;
  message?: string;
  data?: T;
  token?: string;
  refresh_token?: string;
  user?: TyUser;
  [k: string]: unknown;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Listeners para reaccionar al cierre de sesión forzado (401 definitivo). */
const sessionListeners = new Set<() => void>();
export const onSessionExpired = (fn: () => void) => {
  sessionListeners.add(fn);
  return () => sessionListeners.delete(fn);
};

export async function loadSession(): Promise<{ token: string; user: TyUser } | null> {
  try {
    const [tok, ref, userRaw] = await Promise.all([
      SecureStore.getItemAsync(KEY_TOKEN),
      SecureStore.getItemAsync(KEY_REFRESH),
      SecureStore.getItemAsync(KEY_USER),
    ]);
    _token = tok;
    _refresh = ref;
    _user = userRaw ? (JSON.parse(userRaw) as TyUser) : null;
    return tok && _user ? { token: tok, user: _user } : null;
  } catch {
    return null;
  }
}

export async function saveSession(token: string, refresh: string | null, user: TyUser) {
  _token = token;
  _refresh = refresh ?? _refresh;
  _user = user;
  await Promise.all([
    SecureStore.setItemAsync(KEY_TOKEN, token),
    refresh ? SecureStore.setItemAsync(KEY_REFRESH, refresh) : Promise.resolve(),
    SecureStore.setItemAsync(KEY_USER, JSON.stringify(user)),
  ]);
}

export async function updateSavedUser(user: TyUser) {
  _user = user;
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(user));
}

export async function clearSession() {
  _token = null;
  _refresh = null;
  _user = null;
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_TOKEN),
    SecureStore.deleteItemAsync(KEY_REFRESH),
    SecureStore.deleteItemAsync(KEY_USER),
  ]);
}

export const getSavedUser = () => _user;
export const hasToken = () => Boolean(_token);

async function request<T = unknown>(
  method: string,
  path: string,
  body: unknown = null,
  isForm = false,
  isRetry = false,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (_token) headers.Authorization = `Bearer ${_token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? ((isForm ? body : JSON.stringify(body)) as BodyInit) : null,
    });
  } catch {
    throw new ApiError('Sin conexión con TratoYa. Revisa tu internet e intenta de nuevo.', 0);
  }

  const data = (await res.json().catch(() => ({ success: false, message: 'Error de conexión' }))) as ApiResponse<T>;

  if (!res.ok) {
    // Refresh automático del token (una sola vez por request)
    if (res.status === 401 && _token && _refresh && path !== '/auth/refresh' && !isRetry) {
      try {
        const rr = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: _refresh }),
        });
        const rd = (await rr.json().catch(() => ({}))) as ApiResponse;
        if (rr.ok && rd.token) {
          _token = rd.token;
          await SecureStore.setItemAsync(KEY_TOKEN, rd.token);
          if (rd.refresh_token) {
            _refresh = rd.refresh_token;
            await SecureStore.setItemAsync(KEY_REFRESH, rd.refresh_token);
          }
          return request<T>(method, path, body, isForm, true);
        }
      } catch { /* cae al cierre de sesión */ }
    }

    let msg = data.message;
    if (!msg && Array.isArray((data as { errors?: { msg: string }[] }).errors)) {
      msg = (data as { errors: { msg: string }[] }).errors.map((e) => e.msg).join('. ');
    }
    if (res.status === 401 && _token) {
      await clearSession();
      sessionListeners.forEach((fn) => fn());
    }
    throw new ApiError(msg || `Error ${res.status}`, res.status);
  }

  return data;
}

export const api = {
  get: <T = unknown>(p: string) => request<T>('GET', p),
  post: <T = unknown>(p: string, b?: unknown) => request<T>('POST', p, b),
  put: <T = unknown>(p: string, b?: unknown) => request<T>('PUT', p, b),
  del: <T = unknown>(p: string, b?: unknown) => request<T>('DELETE', p, b),
  upload: <T = unknown>(p: string, form: FormData) => request<T>('POST', p, form, true),
};
