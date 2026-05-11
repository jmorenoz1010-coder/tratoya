import { useState, useCallback } from "react";
import TratoYaAdmin from "./Admin";
import { clearLegacySession, getSavedUser, saveSession, clearSession } from "./lib/api";
import { useToast, Toast } from "./components/Toast";
import AppShell from "./pages/AppShell";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import PublicTratoPage from "./pages/PublicTratoPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import "./styles/main.css";

export default function TratoYaApp() {
  clearLegacySession();
  const { toasts, show, remove } = useToast();
  const [session, setSession] = useState(() => {
    const u = getSavedUser();
    const t = window.sessionStorage.getItem("ty_token");
    return u && t ? { user: u, token: t } : null;
  });
  const [authMode, setAuthMode] = useState(null);
  const toast = useCallback((m, type = "info") => show(m, type), [show]);

  const isAdminRoute = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");
  const publicMatch  = window.location.pathname.match(/^\/t\/([^/]+)/);
  const isPayResult  = ["/pagos/respuesta", "/pago/resultado"].includes(window.location.pathname);

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
