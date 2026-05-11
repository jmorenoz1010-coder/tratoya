export default function EpaycoMark({ compact = false }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: compact ? 4 : 7, fontWeight: 800, letterSpacing: "-.4px" }}>
      <span style={{ color: "#111", fontStyle: "italic" }}>e</span>
      <span style={{ color: "#f15a24", fontStyle: "italic" }}>Payco</span>
    </span>
  );
}
