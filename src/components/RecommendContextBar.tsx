import { Hole } from '../types'
import { HoleProgressStatus } from '../lib/holeShots'
import { summarizeHoleLayout } from '../lib/holeLabels'

interface Props {
  mode: 'course' | 'custom'
  courseName?: string | null
  holeNumber?: number | null
  hole: Hole
  roundActive?: boolean
  remainingDistance?: number
  shotCount?: number
  shotProgressStatus?: HoleProgressStatus
  overshootFt?: number
}

export function RecommendContextBar({
  mode,
  courseName,
  holeNumber,
  hole,
  roundActive = false,
  remainingDistance,
  shotCount = 0,
  shotProgressStatus = 'playing',
  overshootFt,
}: Props) {
  const layout = summarizeHoleLayout(hole)
  const lieNote =
    shotCount > 0 && shotProgressStatus === 'playing' && remainingDistance != null
      ? `${remainingDistance.toLocaleString()} ft left after ${shotCount} throw${shotCount === 1 ? '' : 's'}`
      : shotCount > 0 && shotProgressStatus === 'past_basket' && overshootFt != null
        ? `Past basket by ${overshootFt.toLocaleString()} ft after ${shotCount} throw${shotCount === 1 ? '' : 's'}`
        : shotCount > 0 && shotProgressStatus === 'at_basket'
          ? `At the basket after ${shotCount} throw${shotCount === 1 ? '' : 's'}`
          : null

  if (mode === 'course' && courseName && holeNumber != null) {
    return (
      <div className="recommend-context recommend-context-course">
        <div className="recommend-context-main">
          <span className="recommend-context-badge">Course hole</span>
          {roundActive && (
            <span className="pill small recommend-context-live">Live round</span>
          )}
          <strong>
            {courseName} · Hole {holeNumber}
          </strong>
          <span className="muted small">{layout}</span>
          {lieNote && <span className="recommend-context-lie">{lieNote}</span>}
        </div>
        <p className="muted small recommend-context-note">
          Recommendations follow this hole from the course stepper above. Adjust wind
          below — layout stays tied to the course until you leave or switch holes.
        </p>
      </div>
    )
  }

  return (
    <div className="recommend-context recommend-context-custom">
      <div className="recommend-context-main">
        <span className="recommend-context-badge">Custom hole</span>
        <strong>One-off hole setup</strong>
        <span className="muted small">{layout}</span>
        {lieNote && <span className="recommend-context-lie">{lieNote}</span>}
      </div>
      <p className="muted small recommend-context-note">
        Recommendations use the custom hole panel below — not a saved course. Pick a
        course above to step through a full round with live scoring.
      </p>
    </div>
  )
}
