import React from 'react';

interface Props {
  status: string;
}

const config: Record<string, { label: string; cls: string; dot: string }> = {
  PRESENT:   { label: 'Present',   cls: 'badge-present', dot: '#10B981' },
  FULL_DAY:  { label: 'Present',   cls: 'badge-present', dot: '#10B981' },
  ABSENT:    { label: 'Absent',    cls: 'badge-absent',  dot: '#EF4444' },
  HALF_DAY:  { label: 'Half Day',  cls: 'badge-halfday', dot: '#EA580C' },
  LEAVE:     { label: 'Leave',     cls: 'badge-leave',   dot: '#2563EB' },
  SICK_LEAVE:{ label: 'Sick Leave',cls: 'badge-leave',   dot: '#2563EB' },
  PERMISSION:{ label: 'Permission',cls: 'badge-pending', dot: '#F59E0B' },
  PENDING:   { label: 'Pending',   cls: 'badge-pending', dot: '#F59E0B' },
};

export default function StatusBadge({ status }: Props) {
  const c = config[status] || { label: status, cls: '', dot: '#94A3B8' };
  return (
    <span className={`badge ${c.cls}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      {c.label}
    </span>
  );
}
