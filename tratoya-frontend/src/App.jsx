import { useState, useCallback, useEffect } from "react";
import TratoYaAdmin from "./Admin";
import { clearLegacySession, getSavedUser, saveSession } from "./lib/api";
import { useToast, Toast } from "./components/Toast";
import AppShell from "./pages/AppShell";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import PublicTratoPage from "./pages/PublicTratoPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import LegalPage from "./pages/LegalPage";
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

  const pathname = window.location.pathname;
  const isAdminRoute = pathname === ADMIN_ENTRY_PATH || pathname.startsWith(`${ADMIN_ENTRY_PATH}/`);
  const publicMatch = pathname.match(/^\/t\/([^/]+)/);
  const isPayResult = ["/pagos/respuesta", "/pago/resultado"].includes(pathname);
  const legalMatch = pathname.match(/^\/legal\/(terminos|privacidad|cookies)$/);
  const isAuthCallback = pathname === "/auth/callback";

  useEffect(() => {
    if (isAdminRoute) document.title = "Trato YA / Admin";
    else if (publicMatch) document.title = "Trato YA / Trato público";
    else if (isPayResult) document.title = "Trato YA / Resultado de pago";
    else if (legalMatch) {
      const legalTitles = { terminos: "Términos", privacidad: "Privacidad", cookies: "Cookies" };
      document.title = `Trato YA / ${legalTitles[legalMatch[1]] || "Legal"}`;
    }
    else if (!session && authMode) document.title = `Trato YA / ${authMode === "register" ? "Registro" : "Inicio de sesión"}`;
    else if (!session) document.title = "Trato YA / Inicio";
  }, [isAdminRoute, publicMatch, isPayResult, legalMatch, session, authMode]);

  const Toasts = () => toasts.map((t) => <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />);

  if (isAdminRoute) return <TratoYaAdmin />;

  if (publicMatch) return (
    <>
      <Toasts />
      {authMode && !session
        ? <Auth setSession={setSession} toast={toast} initialMode={authMode} />
        : <PublicTratoPage link={publicMatch[1]} session={session} goAuth={setAuthMode} toast={toast} />}
    </>
  );

  if (isPayResult) return (
    <>
      <Toasts />
      {authMode && !session
        ? <Auth setSession={setSession} toast={toast} initialMode={authMode} />
        : <PaymentResultPage session={session} goAuth={setAuthMode} toast={toast} />}
    </>
  );

  if (isAuthCallback) return <AuthCallback setSession={setSession} toast={toast} />;

  if (legalMatch) return (
    <>
      <Toasts />
      <LegalPage type={legalMatch[1]} />
    </>
  );

  return (
    <>
      <Toasts />
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
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const refresh = params.get("refresh");
      const encodedUser = params.get("user");
      if (!token || !encodedUser) throw new Error("No se pudo completar el inicio de sesión social.");
      const user = JSON.parse(atob(encodedUser.replace(/-/g, "+").replace(/_/g, "/")));
      saveSession(token, refresh, user);
      setSession({ user, token });
      toast(`Bienvenido, ${user.nombre || "TratoYa"}!`, "success");
      window.history.replaceState(null, "", "/");
    } catch (e) {
      toast(e.message || "No se pudo completar el inicio de sesión social.", "error");
      window.history.replaceState(null, "", "/");
    }
  }, [setSession, toast]);

  return (
    <main className="auth-callback-screen">
      <div className="spin" />
      <p>Conectando tu cuenta segura...</p>
    </main>
  );
}
