export default function DealProgress({ steps, variant = "light" }) {
  return (
    <div className={`deal-progress${variant === "dark" ? " deal-progress--dark" : ""}`}>
      {steps.map((step, i) => (
        <div
          key={i}
          className={`dp-step ${step.done ? "done" : step.active ? "active" : ""}`}
        >
          <div className={`dp-dot ${step.done ? "done" : step.active ? "active" : ""}`}>
            {step.done ? "✓" : i + 1}
          </div>
          <div className={`dp-label ${step.done ? "done" : step.active ? "active" : ""}`}>
            {step.l}
          </div>
          {step.s && (
            <div className="dp-sub" title={step.s}>
              {step.s}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
