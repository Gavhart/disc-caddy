import { Hole } from '../types'
import { summarizeHoleLayout } from '../lib/holeLabels'

interface Props {
  mode: 'course' | 'custom'
  courseName?: string | null
  holeNumber?: number | null
  hole: Hole
  roundActive?: boolean
}

export function RecommendContextBar({
  mode,
  courseName,
  holeNumber,
  hole,
  roundActive = false,
}: Props) {
  const layout = summarizeHoleLayout(hole)

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
      </div>
      <p className="muted small recommend-context-note">
        Recommendations use the custom hole panel below — not a saved course. Pick a
        course above to step through a full round with live scoring.
      </p>
    </div>
  )
}
