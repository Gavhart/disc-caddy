interface Props {
  /** Display height in px. Width scales from the image aspect ratio. */
  height?: number
  className?: string
}

/** Disc Caddy brand logo (DC mark + wordmark). */
export function Logo({ height = 40, className = '' }: Props) {
  return (
    <span className={`logo ${className}`.trim()}>
      <img
        src="/logo.png"
        alt="Disc Caddy"
        className="logo-img"
        height={height}
        decoding="async"
      />
    </span>
  )
}
