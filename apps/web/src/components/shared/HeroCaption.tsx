interface HeroCaptionProps {
  primary: string;
  subtitle?: string;
}

export function HeroCaption({ primary, subtitle }: HeroCaptionProps) {
  return (
    <div className="shrink-0 px-4 py-2.5 border-t border-border-primary bg-surface-primary">
      <div className="text-xs text-text-secondary">{primary}</div>
      {subtitle && (
        <div className="text-[11px] text-text-tertiary mt-[3px]">
          {subtitle}
        </div>
      )}
    </div>
  );
}
