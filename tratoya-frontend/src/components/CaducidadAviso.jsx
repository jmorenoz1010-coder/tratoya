import { useState, useEffect } from "react";
import { caducidadTrato, formatCuentaRegresiva } from "../lib/utils";

const DOS_DIAS = 2 * 24 * 60 * 60 * 1000;

// Muestra una cuenta regresiva en vivo solo cuando al trato le quedan 2 días
// o menos para caducar (tratos sin concretar se cancelan a los 5 días).
export default function CaducidadAviso({ trato, compact = false }) {
  const target = caducidadTrato(trato);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!target) return null;
  const ms = target - now;
  if (ms <= 0 || ms > DOS_DIAS) return null;

  const txt = formatCuentaRegresiva(ms);

  if (compact) {
    return (
      <span className="caduca-chip" title="Tiempo restante para que el trato caduque">
        ⏳ Caduca en {txt}
      </span>
    );
  }

  return (
    <div className="caduca-aviso" role="status" aria-live="polite">
      <span className="caduca-aviso-ico" aria-hidden="true">⏳</span>
      <div className="caduca-aviso-txt">
        <strong>A este trato le quedan {txt} para caducar</strong>
        <span>Complétalo antes de que expire. Los tratos sin concretar se cancelan automáticamente.</span>
      </div>
    </div>
  );
}
