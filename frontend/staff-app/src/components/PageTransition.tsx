import React from 'react';

interface Props {
  children: React.ReactNode;
  pageKey: string;
}

export default function PageTransition({ children, pageKey }: Props) {
  return (
    <div key={pageKey} className="page-wrap">
      {children}
    </div>
  );
}
