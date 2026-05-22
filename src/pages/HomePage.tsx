import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { PlayerSetup, PerTypeDistancePatch } from '../components/PlayerSetup'
import { BagSummary } from '../components/BagSummary'
import { HoleInput } from '../components/HoleInput'
import { Recommendation } from '../components/Recommendation'
import { BagPicker } from '../components/BagPicker'
import { CourseSelector } from '../components/CourseSelector'
import { recommend } from '../lib/recommend'
import { updateMaxDistance, updatePlayer } from '../lib/profile'
import { localState } from '../lib/storage'
import { createBag, listBags, listDiscsInBag } from '../lib/bags'
import { Bag, BagDisc, Course, CourseHole, Hole } from '../types'

const DEFAULT_HOLE: Hole = {
  distance: 300,
  direction: 'straight',
  elevation: 'flat',
  terrain: 'flat',
  treeCoverage: 'open',
  treeLayout: 'none',
  windDirection: 'none',
  windSpeed: 0,
}

export function HomePage() {
  const { user, me, refreshMe } = useAuth()
  const [bags, setBags] = useState<Bag[]>([])
  const [activeBagId, setActiveBagId] = useState<string | null>(null)
  const [discs, setDiscs] = useState<BagDisc[]>([])
  const [hole, setHole] = useState<Hole>(() => localState.loadHole() ?? DEFAULT_HOLE)

  const [pickedCourseId, setPickedCourseId] = useState<string | null>(
    () => localState.loadRound()?.courseId ?? null,
  )
  const [pickedHoleNumber, setPickedHoleNumber] = useState<number | null>(
    () => localState.loadRound()?.holeNumber ?? null,
  )

  useEffect(() => localState.saveHole(hole), [hole])

  useEffect(() => {
    if (pickedCourseId == null && pickedHoleNumber == null) {
      localState.clearRound()
      return
    }
    localState.saveRound({
      courseId: pickedCourseId,
      holeNumber: pickedHoleNumber,
    })
  }, [pickedCourseId, pickedHoleNumber])

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
        setActiveBagId(def.id)
      }
    }
    load().catch(err => console.error('[home] load bags failed', err))
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
      .catch(err => console.error('[home] load discs failed', err))
  }, [activeBagId])

  const handleMaxDistanceChange = useCallback(
    async (newMax: number) => {
      if (!user) return
      try {
        await updateMaxDistance(user.id, newMax)
        await refreshMe()
      } catch (err) {
        console.error('[home] update max distance failed', err)
      }
    },
    [user, refreshMe],
  )

  const handlePerTypeChange = useCallback(
    async (patch: PerTypeDistancePatch) => {
      if (!user) return
      try {
        await updatePlayer(user.id, patch)
        await refreshMe()
      } catch (err) {
        console.error('[home] update per-type distances failed', err)
      }
    },
    [user, refreshMe],
  )

  const handlePickCourseHole = useCallback(
    (course: Course | null, ch: CourseHole | null) => {
      setPickedCourseId(course?.id ?? null)
      setPickedHoleNumber(ch?.number ?? null)
      if (ch) {
        setHole(prev => ({
          ...prev,
          distance: ch.distance,
          direction: ch.direction,
          elevation: ch.elevation,
          terrain: ch.terrain,
          treeCoverage: ch.treeCoverage,
          treeLayout: ch.treeLayout,
        }))
      }
    },
    [],
  )

  const recommendations = useMemo(() => {
    if (!me) return []
    return recommend({
      bag: discs,
      hole,
      playerMaxDistance: me.maxDistance,
      playerPutterDistance: me.putterMaxDistance,
      playerMidrangeDistance: me.midrangeMaxDistance,
      playerFairwayDistance: me.fairwayMaxDistance,
      playerForehandDistance: me.forehandMaxDistance,
      hand: me.dominantHand,
      throwsForehand: me.throwsForehand,
      primaryThrow: me.primaryThrow,
    })
  }, [discs, hole, me])

  const activeBag = bags.find(b => b.id === activeBagId) ?? null
  const locked = pickedHoleNumber !== null

  return (
    <div className="container">
      <div className="card bag-picker-card">
        <BagPicker
          bags={bags}
          activeBagId={activeBagId}
          onSelect={setActiveBagId}
          compact
        />
        <BagSummary bagName={activeBag?.name ?? null} discCount={discs.length} />
      </div>
      <PlayerSetup
        maxDistance={me?.maxDistance ?? 280}
        putterMaxDistance={me?.putterMaxDistance ?? Math.round((me?.maxDistance ?? 280) * 0.5)}
        midrangeMaxDistance={me?.midrangeMaxDistance ?? Math.round((me?.maxDistance ?? 280) * 0.7)}
        fairwayMaxDistance={me?.fairwayMaxDistance ?? Math.round((me?.maxDistance ?? 280) * 0.85)}
        onChange={handleMaxDistanceChange}
        onPerTypeChange={me ? handlePerTypeChange : undefined}
      />
      <CourseSelector
        courseId={pickedCourseId}
        holeNumber={pickedHoleNumber}
        onPickHole={handlePickCourseHole}
      />
      <HoleInput hole={hole} onChange={setHole} locked={locked} />
      <Recommendation recommendations={recommendations} />
    </div>
  )
}
