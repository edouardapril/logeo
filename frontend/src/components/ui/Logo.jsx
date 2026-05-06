const SIZES = {
  sm: { box: 'h-7 w-7', text: 'text-lg' },
  md: { box: 'h-9 w-9', text: 'text-2xl' },
  lg: { box: 'h-12 w-12', text: 'text-3xl' },
}

export default function Logo({ size = 'md', showText = true, className = '' }) {
  const cfg = SIZES[size] || SIZES.md
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 38 38"
        className={cfg.box}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Logeo"
        role="img"
      >
        <rect width="38" height="38" rx="7" fill="#EA580C" />
        <rect x="9" y="7" width="7" height="24" rx="2" fill="#FFFFFF" />
        <rect x="9" y="25" width="20" height="7" rx="2" fill="#FFFFFF" />
      </svg>
      {showText && (
        <span className={`font-medium tracking-tight text-current ${cfg.text}`}>
          Logeo
        </span>
      )}
    </span>
  )
}
