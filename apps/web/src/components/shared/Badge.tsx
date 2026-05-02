import type { ReactNode } from 'react';

import { badgeClasses } from '../../utils/classMaps';
import { cn } from '../../utils/cn';
import { type BadgeVariant } from '../theme';
import { Tooltip } from './Tooltip';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  title?: string;
}

export default function Badge({ variant, children, title }: BadgeProps) {
  const classes = badgeClasses[variant] ?? badgeClasses.stale;
  const badge = (
    <span
      className={cn(
        'inline-block text-[10px] px-[7px] py-[2px] rounded-[3px] font-medium tracking-[0.02em] whitespace-normal break-words',
        classes,
      )}
    >
      {children}
    </span>
  );

  if (!title) return badge;

  const names = title.split(', ');
  return (
    <Tooltip
      content={
        <div className="flex flex-col gap-0.5">
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
