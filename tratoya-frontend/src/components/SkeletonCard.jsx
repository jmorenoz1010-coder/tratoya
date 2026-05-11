// Skeleton loaders para estados de carga

export function SkeletonKpiGrid() {
  return (
    <div className="kpi-grid">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="kpi">
          <div className="skeleton sk-avatar" style={{ width: 32, height: 32, borderRadius: 9, marginBottom: 8 }} />
          <div className="skeleton sk-line xshort" />
          <div className="skeleton sk-line short" style={{ height: 22 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTratoCard() {
  return (
    <div className="tc" style={{ cursor: "default" }}>
      <div className="skeleton sk-avatar" style={{ width: 40, height: 40, borderRadius: 10 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton sk-line short" style={{ marginBottom: 6 }} />
        <div className="skeleton sk-line xshort" style={{ height: 10 }} />
      </div>
      <div style={{ textAlign: "right", minWidth: 80 }}>
        <div className="skeleton sk-line" style={{ height: 16, marginBottom: 6 }} />
        <div className="skeleton sk-badge" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 4 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTratoCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="skeleton sk-title" />
          <div className="skeleton sk-line short" style={{ height: 11 }} />
        </div>
      </div>
      <SkeletonKpiGrid />
      <SkeletonList count={3} />
    </div>
  );
}
