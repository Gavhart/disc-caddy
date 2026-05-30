import { HoleShot, holeProgress } from '../lib/holeShots'
import {
  THROW_PHASE_COLORS,
  throwPhaseLabel,
  type ThrowPhase,
} from '../lib/throwPhase'
import { TeeBearing, TEE_BEARING_DEG } from '../types'

const W = 220
const H = 300
const TEE = { x: W / 2, y: H - 36 }
const BASKET = { x: W / 2, y: 36 }

function pinAlongLine(fraction: number): { x: number; y: number } {
  const t = Math.max(0, Math.min(1, fraction))
  return {
    x: TEE.x + (BASKET.x - TEE.x) * t,
    y: TEE.y + (BASKET.y - TEE.y) * t,
  }
}

export function HoleProgressMap({
  holeDistance,
  shots,
  teeBearing = 'north',
}: {
  holeDistance: number
  shots: HoleShot[]
  teeBearing?: TeeBearing
}) {
  const progress = holeProgress(holeDistance, shots)
  const rotation = TEE_BEARING_DEG[teeBearing] ?? 0

  let traveled = 0
  const pins = shots.map((shot, i) => {
    traveled += shot.distanceFt
    const fraction = holeDistance > 0 ? traveled / holeDistance : 0
    const pos = pinAlongLine(fraction)
    return {
      key: shot.id,
      num: i + 1,
      phase: shot.throwPhase ?? 'approach',
      pos,
      discName: shot.discName,
    }
  })

  const remainingFraction =
    progress.status === 'playing' && holeDistance > 0
      ? progress.remaining / holeDistance
      : 0

  return (
    <div className="hole-progress-map-wrap">
      <div className="hole-progress-map-head">
        <strong>Hole map</strong>
        <span className="muted small">Tee → basket · pins show where each throw landed</span>
      </div>
      <svg
        className="hole-progress-map"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Hole progress map with ${shots.length} throw${shots.length === 1 ? '' : 's'}`}
      >
        <g transform={`rotate(${rotation} ${TEE.x} ${TEE.y})`}>
          <line
            x1={TEE.x}
            y1={TEE.y}
            x2={BASKET.x}
            y2={BASKET.y}
            className="hole-progress-map-fairway"
          />
          {progress.status === 'playing' && remainingFraction > 0 && (
            <line
              x1={pinAlongLine(1 - remainingFraction).x}
              y1={pinAlongLine(1 - remainingFraction).y}
              x2={BASKET.x}
              y2={BASKET.y}
              className="hole-progress-map-remaining"
            />
          )}
          <circle cx={TEE.x} cy={TEE.y} r={10} className="hole-progress-map-tee" />
          <text x={TEE.x} y={TEE.y + 22} textAnchor="middle" className="hole-progress-map-label">
            Tee
          </text>
          <g transform={`translate(${BASKET.x}, ${BASKET.y})`}>
            <circle r={12} className="hole-progress-map-basket" />
            <text y={24} textAnchor="middle" className="hole-progress-map-label">
              Basket
            </text>
          </g>
          {pins.map(pin => (
            <g key={pin.key} transform={`translate(${pin.pos.x}, ${pin.pos.y})`}>
              <circle
                r={11}
                fill={THROW_PHASE_COLORS[pin.phase as ThrowPhase]}
                className="hole-progress-map-pin"
              />
              <text y={4} textAnchor="middle" className="hole-progress-map-pin-num">
                {pin.num}
              </text>
              <title>
                Throw {pin.num}: {throwPhaseLabel(pin.phase as ThrowPhase)}
                {pin.discName ? ` · ${pin.discName}` : ''}
              </title>
            </g>
          ))}
        </g>
      </svg>
      <div className="hole-progress-map-legend">
        {(['drive', 'approach', 'putt'] as const).map(phase => (
          <span key={phase} className="hole-progress-map-legend-item">
            <span
              className="hole-progress-map-legend-dot"
              style={{ background: THROW_PHASE_COLORS[phase] }}
            />
            {throwPhaseLabel(phase)}
          </span>
        ))}
      </div>
    </div>
  )
}
