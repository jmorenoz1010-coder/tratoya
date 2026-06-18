import { fmt, calcularComisionUI, COMMISSION_PAYER_LABEL } from "../lib/utils";

export default function CommissionBreakdown({ monto, quien = "comprador", note = "", variant = "light" }) {
  if (!monto) return null;
  const payer = quien === "por_definir" ? "comprador" : quien;
  const calc = calcularComisionUI(monto, payer);

  return (
    <div className={`commbox${variant === "dark" ? " commbox--dark" : ""}`}>
      <div className="cr"><span>Monto del trato</span><span>{fmt(monto)}</span></div>
      <div className="cr"><span>Comision TratoYA + costos operativos ({calc.label})</span><span>{fmt(calc.comision)}</span></div>
      <div className="cr"><span>Quien paga la comision</span><span>{COMMISSION_PAYER_LABEL[quien] || quien}</span></div>
      <div className="cr"><span>Comision pagada por comprador</span><span>{fmt(calc.compradorComision)}</span></div>
      <div className="cr"><span>Comision descontada al vendedor</span><span>{fmt(calc.vendedorComision)}</span></div>
      {payer === "compartida" && (
        <div className="cr-note">
          Comision compartida: el comprador transfiere {fmt(calc.totalPagar)} y el vendedor recibe {fmt(calc.vendedorRecibe)}. La diferencia cubre su 50% de comision y costos operativos.
        </div>
      )}
      <div className="cr tot"><span>Total que paga comprador</span><span>{fmt(calc.totalPagar)}</span></div>
      <div className="cr tot"><span>Vendedor recibe</span><span>{fmt(calc.vendedorRecibe)}</span></div>
      {note && (
        <div className="cr-note">{note}</div>
      )}
    </div>
  );
}
