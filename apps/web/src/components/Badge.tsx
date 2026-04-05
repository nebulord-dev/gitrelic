import { badgeStyles, type BadgeVariant } from './theme';

export default function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  const style = badgeStyles[variant];
  return (
    <span style={{ backgroundColor: style.bg, color: style.fg }}
      className="inline-block text-[10px] font-medium px-[7px] py-[2px] rounded-[3px] tracking-[0.02em]">
      {children}
    </span>
  );
}
