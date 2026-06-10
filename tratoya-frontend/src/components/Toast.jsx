import { useEffect, useState, useCallback } from "react";

export function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";

  return (
    <div className={`toast ${type}`} role="alert">
      {icon} {message}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((t) => {
      const clean = t.filter((x) => x.message !== message || x.type !== type);
      return [...clean.slice(-2), { id, message, type }];
    });
  }, []);

  const remove = useCallback(
    (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    []
  );

  return { toasts, show, remove };
}
