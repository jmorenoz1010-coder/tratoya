export const ADMIN_ENTRY_PATH = "/operaciones-ty-7q4m9";

export const AUTH_LOGIN_PATHS = ["/login", "/entrar"];
export const AUTH_REGISTER_PATHS = ["/register", "/registro", "/crear-cuenta"];

export function authModeFromPath(pathname) {
  if (AUTH_LOGIN_PATHS.includes(pathname)) return "login";
  if (AUTH_REGISTER_PATHS.includes(pathname)) return "register";
  return null;
}

export function pathForAuthMode(mode) {
  return mode === "register" ? "/register" : "/login";
}
