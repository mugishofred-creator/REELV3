type StarProps = {
  size?: number | string;
  className?: string;
  /** Purely decorative by default; give it a title only when it carries meaning. */
  title?: string;
};

/** The house sigil's smaller half: a four-point star, cut concave. */
export function Star({ size = 16, className, title }: StarProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <defs>
        <linearGradient id="lfm-star" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor="#b6b6ba" />
          <stop offset="58%" stopColor="#7a7a80" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <path
        d="M50 0 Q54 46 100 50 Q54 54 50 100 Q46 54 0 50 Q46 46 50 0 Z"
        fill="url(#lfm-star)"
      />
    </svg>
  );
}
