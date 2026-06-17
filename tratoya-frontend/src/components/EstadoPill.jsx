import { ESTADO, estadoIconKey } from "../lib/utils";
import { STEP_ICONS } from "./LandingIcons";

export default function EstadoPill({ estado, label, icon, tone, className = "" }) {
  const text = label || ESTADO[estado]?.l || estado || "";
  const iconKey = icon || estadoIconKey(estado);
  const Icon = STEP_ICONS[iconKey] || STEP_ICONS.bolt;
  const toneClass = tone ? ` tone-${tone}` : "";
  return (
    <span className={`estado-pill${className ? ` ${className}` : ""}`}>
      <span className="estado-pill-ico" aria-hidden="true"><Icon /></span>
      <span className={`estado-pill-txt${toneClass}`}>{text}</span>
    </span>
  );
}
