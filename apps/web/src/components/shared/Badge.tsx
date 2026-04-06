import type { ReactNode } from 'react';

import { type BadgeVariant, badgeStyles } from '../theme';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
}

export default function Badge({ variant, children }: BadgeProps) {
  const style = badgeStyles[variant] ?? badgeStyles.stale;
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        padding: '2px 7px',
        borderRadius: 3,
        fontWeight: 500,
        letterSpacing: '0.02em',
        background: style.bg,
        color: style.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
