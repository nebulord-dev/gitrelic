import type { ReactNode } from 'react';

import { type BadgeVariant, badgeStyles } from '../theme';
import { Tooltip } from './Tooltip';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  title?: string;
}

export default function Badge({ variant, children, title }: BadgeProps) {
  const style = badgeStyles[variant] ?? badgeStyles.stale;
  const badge = (
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

  if (!title) return badge;

  const names = title.split(', ');
  return (
    <Tooltip
      content={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {names.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      }
    >
      {badge}
    </Tooltip>
  );
}
