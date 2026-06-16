import { useState, useCallback, useEffect } from "react";
import TratoYaAdmin from "./Admin";
import { clearLegacySession, getSavedUser, saveSession, API_URL } from "./lib/api";
import { useToast, Toast } from "./components/Toast";
import AppShell from "./pages/AppShell";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Espera from "./pages/Espera";
import WaitlistAdmin from "./pages/Admin";
import PublicTratoPage from "./pages/PublicTratoPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import LegalPage from "./pages/LegalPage";
import ResetPassword from "./pages/ResetPassword";
import { ADMIN_ENTRY_PATH } from "./lib/routes";
import "./styles/main.css";

export default function TratoYaApp() {
  clearLegacySession();
  const { toasts, show, remove } = useToast();
  const [session, setSession] = useState(() => {
    const u = getSavedUser();
    const t = window.localStorage.getItem("ty_token");
    return u && t ? { user: u, token: t } : null;
  });
  const [authMode, setAuthMode] = useState(null);
  const toast = useCallback((m, type = "info") => show(m, type), [show]);

  // Mensaje de cierre de sesión (se setea antes del redirect duro en logout).
  useEffect(() => {
    try {
      const msg = window.sessionStorage.getItem("ty_logout_msg");
      if (msg) { window.sessionStorage.removeItem("ty_logout_msg"); show(msg, "info"); }
    } catch { /* noop */ }
  }, [show]);

  const pathname = window.location.pathname;
  const isAdminRoute = pathname === ADMIN_ENTRY_PATH || pathname.startsWith(`${ADMIN_ENTRY_PATH}/`);
  const isWaitlistRoute = pathname === "/espera";
  const isWaitlistAdminRoute = pathname === "/admin/waitlist";
  const publicMatch = pathname.match(/^\/t\/([^/]+)/);
  const isPayResult = ["/pagos/respuesta", "/pago/resultado"].includes(pathname);
  const legalMatch = pathname.match(/^\/legal\/(terminos|privacidad|cookies)$/);
  const isResetPassword = pathname === "/reset-password";
  const isAuthCallback = pathname === "/auth/callback";

  useEffect(() => {
    if (isWaitlistRoute) document.title = "Trato YA / Lista de espera";
    else if (isWaitlistAdminRoute) document.title = "Trato YA / Admin waitlist";
    else if (isAdminRoute) document.title = "Trato YA / Admin";
    else if (publicMatch) document.title = "Trato YA / Trato público";
    else if (isPayResult) document.title = "Trato YA / Resultado de pago";
    else if (legalMatch) {
      const legalTitles = { terminos: "Términos", privacidad: "Privacidad", cookies: "Cookies" };
      document.title = `Trato YA / ${legalTitles[legalMatch[1]] || "Legal"}`;
    }
    else if (!session && authMode) document.title = `Trato YA / ${authMode === "register" ? "Registro" : "Inicio de sesión"}`;
    else if (!session) document.title = "Trato YA / Inicio";
  }, [isWaitlistRoute, isWaitlistAdminRoute, isAdminRoute, publicMatch, isPayResult, legalMatch, isResetPassword, session, authMode]);

  const toastNodes = toasts.map((t) => <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />);

  if (isAdminRoute) return <TratoYaAdmin />;
  if (isWaitlistRoute) return <Espera />;
  if (isWaitlistAdminRoute) return <WaitlistAdmin />;

  if (publicMatch) return (
    <>
      {toastNodes}
      {authMode && !session
        ? <Auth setSession={setSession} toast={toast} initialMode={authMode} />
        : <PublicTratoPage link={publicMatch[1]} session={session} goAuth={setAuthMode} toast={toast} />}
    </>
  );

  if (isPayResult) return (
    <>
      {toastNodes}
      {authMode && !session
        ? <Auth setSession={setSession} toast={toast} initialMode={authMode} />
        : <PaymentResultPage session={session} goAuth={setAuthMode} toast={toast} />}
    </>
  );

  if (isAuthCallback) return <AuthCallback setSession={setSession} toast={toast} />;

  if (legalMatch) return (
    <>
      {toastNodes}
      <LegalPage type={legalMatch[1]} />
    </>
  );

  if (isResetPassword) return (
    <>
      {toastNodes}
      <ResetPassword />
    </>
  );

  return (
    <>
      {toastNodes}
      {session
        ? <AppShell session={session} setSession={setSession} toast={toast} />
        : authMode
          ? <Auth setSession={setSession} toast={toast} initialMode={authMode} />
          : <Landing goAuth={setAuthMode} />}
    </>
  );
}

function AuthCallback({ setSession, toast }) {
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (!code) throw new Error("No se pudo completar el inicio de sesión social.");
        const res = await fetch(`${API_URL}/auth/oauth/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token || !data.user) {
          throw new Error(data.message || "No se pudo completar el inicio de sesión social.");
        }
        saveSession(data.token, data.refresh_token, data.user);
        setSession({ user: data.user, token: data.token });
        toast(`Bienvenido, ${data.user.nombre || "TratoYa"}!`, "success");
        window.history.replaceState(null, "", "/");
      } catch (e) {
        toast(e.message || "No se pudo completar el inicio de sesión social.", "error");
        window.history.replaceState(null, "", "/");
      }
    })();
  }, [setSession, toast]);

  return (
    <main className="auth-callback-screen">
      <div className="spin" />
      <p>Conectando tu cuenta segura...</p>
    </main>
  );
}
