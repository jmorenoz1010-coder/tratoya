import { useState, useCallback, useEffect } from "react";
import TratoYaAdmin from "./Admin";
import { clearLegacySession, getSavedUser, saveSession, clearSession } from "./lib/api";
import { useToast, Toast } from "./components/Toast";
import AppShell from "./pages/AppShell";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import PublicTratoPage from "./pages/PublicTratoPage";
import PaymentResultPage from "./pages/PaymentResultPage";
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

  const isAdminRoute = window.location.pathname === ADMIN_ENTRY_PATH || window.location.pathname.startsWith(`${ADMIN_ENTRY_PATH}/`);
  const publicMatch  = window.location.pathname.match(/^\/t\/([^/]+)/);
  const isPayResult  = ["/pagos/respuesta", "/pago/resultado"].includes(window.location.pathname);

  useEffect(() => {
    if (isAdminRoute) document.title = "Panel Admin · TratoYA";
    else if (publicMatch) document.title = "Trato público · TratoYA";
    else if (isPayResult) document.title = "Resultado de pago · TratoYA";
    else if (!session && authMode) document.title = "Acceso · TratoYA";
    else if (!session) document.title = "TratoYA";
  }, [isAdminRoute, publicMatch, isPayResult, session, authMode]);

  const Toasts = () => toasts.map((t) => <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />);

  if (isAdminRoute) return <TratoYaAdmin />;

  if (publicMatch) return (
    <>
      <Toasts />
      {authMode && !session
        ? <Auth setSession={setSession} toast={toast} />
        : <PublicTratoPage link={publicMatch[1]} session={session} goAuth={setAuthMode} toast={toast} />}
    </>
  );

  if (isPayResult) return (
    <>
      <Toasts />
      {authMode && !session
        ? <Auth setSession={setSession} toast={toast} />
        : <PaymentResultPage session={session} goAuth={setAuthMode} toast={toast} />}
    </>
  );

  return (
    <>
      <Toasts />
      {session
        ? <AppShell session={session} setSession={setSession} toast={toast} />
        : authMode
          ? <Auth setSession={setSession} toast={toast} />
          : <Landing goAuth={setAuthMode} />}
    </>
  );
}
