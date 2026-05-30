import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BagPicker } from '../components/BagPicker'
import { BagGapChart } from '../components/BagGapChart'
import { PageHeader } from '../components/PageHeader'
import { ThrowDistanceMeasure, type ThrowMeasureResult } from '../components/ThrowDistanceMeasure'
import { recommend } from '../lib/recommend'
import { createBag, listBags, listDiscsInBag } from '../lib/bags'
import {
  buildDiscCoverage,
  chartMaxRangeFt,
  createPracticeThrow,
  findBagGaps,
  PracticeThrow,
} from '../lib/bagGaps'
import { clampThrowDistanceFeet } from '../lib/geo'
import { Bag, BagDisc, Hole, ThrowStyle } from '../types'

const FIELD_HOLE: Hole = {
  distance: 300,
  direction: 'straight',
  elevation: 'flat',
  terrain: 'flat',
  treeCoverage: 'open',
  treeLayouts: [],
  mandos: [],
  teeBearing: 'north',
  windDirection: 'none',
  windSpeed: 0,
}

const SESSION_KEY = 'disc-caddy:practice-throws'

function loadSessionThrows(): PracticeThrow[] {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as PracticeThrow[]) : []
  } catch {
    return []
  }
}

function saveSessionThrows(throws: PracticeThrow[]) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(throws))
  } catch {
    // ignore
  }
}

export function PracticePage() {
  const { me } = useAuth()

  const [bags, setBags] = useState<Bag[]>([])
  const [activeBagId, setActiveBagId] = useState<string | null>(null)
  const [discs, setDiscs] = useState<BagDisc[]>([])
  const [throws, setThrows] = useState<PracticeThrow[]>(() => loadSessionThrows())
  const [selectedDiscId, setSelectedDiscId] = useState<string | null>(null)
  const [distanceInput, setDistanceInput] = useState('')
  const [throwStyle, setThrowStyle] = useState<ThrowStyle>('backhand')
  const [showEstimates, setShowEstimates] = useState(true)
  const [logError, setLogError] = useState<string | null>(null)

  useEffect(() => {
    saveSessionThrows(throws)
  }, [throws])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const list = await listBags()
      if (cancelled) return
      if (list.length === 0) {
        const starter = await createBag('My Bag', true)
        setBags([starter])
        setActiveBagId(starter.id)
      } else {
        setBags(list)
        const def = list.find(b => b.isDefault) ?? list[0]
        setActiveBagId(def?.id ?? null)
      }
    }
    load().catch(err => console.error('[practice] load bags failed', err))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activeBagId) {
      setDiscs([])
      return
    }
    listDiscsInBag(activeBagId)
      .then(setDiscs)
      .catch(err => console.error('[practice] load discs failed', err))
  }, [activeBagId])

  const selectedDisc = discs.find(d => d.id === selectedDiscId) ?? null

  const playerMaxDistance = me?.maxDistance ?? 300

  const estimatedByDiscId = useMemo(() => {
    if (!discs.length) return new Map<string, number>()
    const profilePrimary = me?.primaryThrow ?? 'backhand'
    const recs = recommend({
      bag: discs,
      hole: FIELD_HOLE,
      playerMaxDistance,
      playerPutterDistance: me?.putterMaxDistance,
      playerMidrangeDistance: me?.midrangeMaxDistance,
      playerFairwayDistance: me?.fairwayMaxDistance,
      playerForehandDistance: me?.forehandMaxDistance,
      hand: me?.dominantHand ?? 'right',
      throwsForehand:
        (me?.throwsForehand ?? false) || profilePrimary === 'forehand',
      primaryThrow: profilePrimary,
    })
    const map = new Map<string, number>()
    for (const r of recs) {
      const prev = map.get(r.bagDisc.id)
      if (prev == null || r.effDistance > prev) map.set(r.bagDisc.id, r.effDistance)
    }
    return map
  }, [discs, me, playerMaxDistance])

  const coverage = useMemo(
    () => buildDiscCoverage(discs, throws, estimatedByDiscId),
    [discs, throws, estimatedByDiscId],
  )

  const maxRangeFt = useMemo(
    () => chartMaxRangeFt(coverage, playerMaxDistance),
    [coverage, playerMaxDistance],
  )

  const gaps = useMemo(
    () => findBagGaps(coverage, { maxRangeFt }),
    [coverage, maxRangeFt],
  )

  function applyMeasuredDistance(result: ThrowMeasureResult | number) {
    const ft = typeof result === 'number' ? result : result.distanceFt
    setDistanceInput(String(ft))
    setLogError(null)
  }

  function logThrow() {
    if (!selectedDisc) {
      setLogError('Pick a disc from your bag first.')
      return
    }
    const parsed = Number(distanceInput.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setLogError('Enter a throw distance in feet, or measure with GPS.')
      return
    }
    const distanceFt = clampThrowDistanceFeet(parsed)
    setThrows(prev => [
      ...prev,
      createPracticeThrow({
        bagDiscId: selectedDisc.id,
        discName: selectedDisc.discName,
        distanceFt,
        throwStyle,
      }),
    ])
    setDistanceInput('')
    setLogError(null)
  }

  function clearSession() {
    setThrows([])
    setDistanceInput('')
    setLogError(null)
  }

  return (
    <div className="container practice-page">
      <PageHeader
        title="Field practice"
        description="Pick a disc, measure how far it went, and see where your bag has distance gaps — no course or basket required."
        backTo="/library"
        backLabel="Library"
      />

      <section className="card">
        <BagPicker
          bags={bags}
          activeBagId={activeBagId}
          onSelect={setActiveBagId}
          compact
        />
        {discs.length === 0 && (
          <p className="muted small">
            This bag is empty.{' '}
            <Link to="/bags" className="link-button">
              Add discs
            </Link>{' '}
            first.
          </p>
        )}
      </section>

      {discs.length > 0 && (
        <>
          <section className="card practice-log-card">
            <h2>Log a throw</h2>
            <p className="muted small practice-log-intro">
              Tap the disc you threw, then measure with GPS or type the distance.
            </p>

            <div className="practice-disc-grid" role="list">
              {discs.map(d => {
                const measured = coverage.find(c => c.bagDiscId === d.id)?.measuredMaxFt
                const active = selectedDiscId === d.id
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="listitem"
                    className={'practice-disc-chip' + (active ? ' practice-disc-chip-active' : '')}
                    onClick={() => {
                      setSelectedDiscId(d.id)
                      setLogError(null)
                    }}
                  >
                    <span className="practice-disc-chip-name">{d.discName}</span>
                    {measured != null && (
                      <span className="practice-disc-chip-max muted small">{measured} ft best</span>
                    )}
                  </button>
                )
              })}
            </div>

            {selectedDisc && (
              <div className="practice-throw-form">
                <p className="practice-selected-disc">
                  Throwing <strong>{selectedDisc.discName}</strong>
                </p>

                <div className="practice-style-toggle">
                  <span className="muted small">Style</span>
                  <div className="segmented-toggle">
                    <button
                      type="button"
                      className={throwStyle === 'backhand' ? 'active' : ''}
                      onClick={() => setThrowStyle('backhand')}
                    >
                      Backhand
                    </button>
                    <button
                      type="button"
                      className={throwStyle === 'forehand' ? 'active' : ''}
                      onClick={() => setThrowStyle('forehand')}
                    >
                      Forehand
                    </button>
                  </div>
                </div>

                <ThrowDistanceMeasure onMeasured={applyMeasuredDistance} />

                <label className="practice-distance-field">
                  <span className="muted small">Distance (ft)</span>
                  <div className="practice-distance-input-row">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 285"
                      value={distanceInput}
                      onChange={e => {
                        setDistanceInput(e.target.value)
                        setLogError(null)
                      }}
                    />
                    <span className="muted small">ft</span>
                  </div>
                </label>

                <div className="practice-throw-actions">
                  <button type="button" className="btn-primary" onClick={logThrow}>
                    Log throw
                  </button>
                </div>

                {logError && <p className="practice-log-error muted small">{logError}</p>}
              </div>
            )}
          </section>

          {throws.length > 0 && (
            <section className="card">
              <div className="practice-session-head">
                <h2>Session ({throws.length})</h2>
                <button type="button" className="link-button small" onClick={clearSession}>
                  Clear session
                </button>
              </div>
              <ul className="practice-throw-list">
                {[...throws].reverse().map(t => (
                  <li key={t.id}>
                    <strong>{t.discName}</strong>
                    <span className="muted small">
                      {' '}
                      · {t.distanceFt} ft · {t.throwStyle === 'forehand' ? 'FH' : 'BH'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <div className="practice-gap-head">
              <h2>Bag distance map</h2>
              <label className="practice-estimates-toggle muted small">
                <input
                  type="checkbox"
                  checked={showEstimates}
                  onChange={e => setShowEstimates(e.target.checked)}
                />
                Include profile estimates
              </label>
            </div>
            <p className="muted small">
              Gaps show where no disc in your bag comfortably reaches — measured throws override
              estimates when you log them.
            </p>
            <BagGapChart
              coverage={coverage}
              gaps={gaps}
              maxRangeFt={maxRangeFt}
              showEstimates={showEstimates}
            />
          </section>
        </>
      )}
    </div>
  )
}
