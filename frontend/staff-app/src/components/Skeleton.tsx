import React from 'react';

interface Props {
  type: 'attendance-card' | 'calendar-grid' | 'payroll' | 'profile' | 'list';
  count?: number;
}

function SkeletonLine({ width = '100%', height = 14, style = {} }: { width?: string | number; height?: number; style?: React.CSSProperties }) {
  return <div className="skeleton skeleton-line" style={{ width, height, marginBottom: 8, ...style }} />;
}

export default function Skeleton({ type, count = 3 }: Props) {
  if (type === 'attendance-card') {
    return (
      <div style={{ padding: 'var(--sp-6)', maxWidth: 600, margin: '0 auto' }}>
        <SkeletonLine width="60%" height={28} style={{ marginBottom: 16 }} />
        <SkeletonLine width="40%" height={14} style={{ marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 260, borderRadius: 20, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="skeleton" style={{ height: 80, borderRadius: 20 }} />
          <div className="skeleton" style={{ height: 80, borderRadius: 20 }} />
        </div>
      </div>
    );
  }

  if (type === 'calendar-grid') {
    return (
      <div style={{ padding: 'var(--sp-6)', maxWidth: 600, margin: '0 auto' }}>
        <div className="skeleton" style={{ height: 48, borderRadius: 12, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10 }} />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'payroll') {
    return (
      <div style={{ padding: 'var(--sp-6)', maxWidth: 600, margin: '0 auto' }}>
        <div className="skeleton" style={{ height: 48, borderRadius: 12, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 160, borderRadius: 20, marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 72, borderRadius: 16 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 200, borderRadius: 20 }} />
      </div>
    );
  }

  if (type === 'profile') {
    return (
      <div style={{ padding: 'var(--sp-6)', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div className="skeleton skeleton-circle" style={{ width: 80, height: 80, marginBottom: 16 }} />
          <SkeletonLine width="50%" height={20} />
          <SkeletonLine width="30%" height={14} />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 20, marginBottom: 16 }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div className="skeleton skeleton-circle" style={{ width: 44, height: 44, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <SkeletonLine width="70%" height={14} />
            <SkeletonLine width="40%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
