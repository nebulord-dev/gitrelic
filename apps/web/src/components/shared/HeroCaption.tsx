interface HeroCaptionProps {
  primary: string;
  subtitle?: string;
}

export function HeroCaption({ primary, subtitle }: HeroCaptionProps) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '10px 16px',
        borderTop: '1px solid var(--border-primary)',
        background: 'var(--surface-primary)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{primary}</div>
      {subtitle && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            marginTop: 3,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
