import { BagGap, DiscCoverage } from '../lib/bagGaps'

interface Props {
  coverage: DiscCoverage[]
  gaps: BagGap[]
  maxRangeFt: number
  showEstimates: boolean
}

function pct(distanceFt: number, maxRangeFt: number): number {
  return Math.min(100, Math.max(0, (distanceFt / maxRangeFt) * 100))
}

export function BagGapChart({ coverage, gaps, maxRangeFt, showEstimates }: Props) {
  const markers = coverage
    .filter(c => {
      if (c.effectiveMaxFt <= 0) return false
      if (!showEstimates && c.source === 'estimated') return false
      return true
    })
    .sort((a, b) => a.effectiveMaxFt - b.effectiveMaxFt)

  const visibleGaps = gaps.filter(g => g.toFt <= maxRangeFt + 20)

  if (markers.length === 0) {
    return (
      <p className="muted small">
        Log a throw or turn on profile estimates to see your bag distance map.
      </p>
    )
  }

  const ticks = [0, 100, 200, 300, 400].filter(t => t <= maxRangeFt)
  if (!ticks.includes(maxRangeFt) && maxRangeFt > 400) ticks.push(maxRangeFt)

  return (
    <div className="bag-gap-chart">
      <div className="bag-gap-track-wrap">
        <div className="bag-gap-track" style={{ ['--bag-gap-max' as string]: `${maxRangeFt}` }}>
          {visibleGaps.map(gap => (
            <div
              key={`${gap.fromFt}-${gap.toFt}`}
              className="bag-gap-zone"
              style={{
                left: `${pct(gap.fromFt, maxRangeFt)}%`,
                width: `${Math.max(2, pct(gap.sizeFt, maxRangeFt))}%`,
              }}
              title={gap.label}
            />
          ))}
          {markers.map(c => (
            <div
              key={c.bagDiscId}
              className={
                'bag-gap-marker' +
                (c.source === 'measured' || c.source === 'both' ? ' bag-gap-marker-measured' : '')
              }
              style={{ left: `${pct(c.effectiveMaxFt, maxRangeFt)}%` }}
              title={`${c.discName} · ${c.effectiveMaxFt} ft`}
            >
              <span className="bag-gap-marker-dot" />
              <span className="bag-gap-marker-label">{c.discName}</span>
              <span className="bag-gap-marker-ft muted small">{c.effectiveMaxFt} ft</span>
            </div>
          ))}
        </div>
        <div className="bag-gap-axis">
          {ticks.map(t => (
            <span key={t} style={{ left: `${pct(t, maxRangeFt)}%` }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <ul className="bag-gap-legend muted small">
        <li>
          <span className="bag-gap-swatch bag-gap-swatch-measured" /> Measured in this session
        </li>
        {showEstimates && (
          <li>
            <span className="bag-gap-swatch bag-gap-swatch-estimated" /> From your profile
            estimates
          </li>
        )}
        <li>
          <span className="bag-gap-swatch bag-gap-swatch-gap" /> Gap ≥ 40 ft between discs
        </li>
      </ul>

      {visibleGaps.length > 0 ? (
        <ul className="bag-gap-list">
          {visibleGaps.map(gap => (
            <li key={`${gap.fromFt}-${gap.toFt}`}>
              <strong>{gap.sizeFt} ft gap</strong>
              <span className="muted small">
                {' '}
                · {gap.fromFt}–{gap.toFt} ft — {gap.label}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bag-gap-ok muted small">
          No major gaps — your measured discs stack within ~40 ft of each other.
        </p>
      )}
    </div>
  )
}
