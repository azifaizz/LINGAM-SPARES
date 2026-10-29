import React from 'react';

interface Props {
  icon: string;
  title: string;
  description?: string;
}

export default function EmptyState({ icon, title, description }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <ion-icon name={icon} />
      </div>
      <h3 className="text-card-title" style={{ marginBottom: 'var(--sp-2)', color: 'var(--color-text)' }}>{title}</h3>
      {description && (
        <p className="text-body" style={{ color: 'var(--color-text-sub)', maxWidth: 260 }}>{description}</p>
      )}
    </div>
  );
}
