import { fmt, calcularComisionUI, COMMISSION_PAYER_LABEL } from "../lib/utils";

export default function CommissionBreakdown({ monto, quien = "comprador", note = "" }) {
  if (!monto) return null;
  const payer = quien === "por_definir" ? "comprador" : quien;
  const calc = calcularComisionUI(monto, payer);
  return (
    <div className="commbox">
      <div className="cr"><span>Monto del trato</span><span>{fmt(monto)}</span></div>
      <div className="cr"><span>Comisión TratoYa ({calc.label})</span><span>{fmt(calc.comision)}</span></div>
      <div className="cr"><span>Quién paga la comisión</span><span>{COMMISSION_PAYER_LABEL[quien] || quien}</span></div>
      <div className="cr"><span>Comisión pagada por comprador</span><span>{fmt(calc.compradorComision)}</span></div>
      <div className="cr"><span>Comisión descontada al vendedor</span><span>{fmt(calc.vendedorComision)}</span></div>
      <div className="cr tot"><span>Total que paga comprador</span><span>{fmt(calc.totalPagar)}</span></div>
      <div className="cr tot"><span>Vendedor recibe</span><span>{fmt(calc.vendedorRecibe)}</span></div>
      {note && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--s600)", lineHeight: 1.45 }}>{note}</div>
      )}
    </div>
  );
}
