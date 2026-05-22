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
import {
  endRound,
  getActiveRound,
  listThrowsForRound,
  logThrow,
  startRound,
} from '../lib/rounds'
import {
  Bag,
  BagDisc,
  Course,
  CourseHole,
  Hole,
  Recommendation as Rec,
  RoundThrow,
} from '../types'

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
  const savedRound = localState.loadRound()

  const [bags, setBags] = useState<Bag[]>([])
  const [activeBagId, setActiveBagId] = useState<string | null>(null)
  const [discs, setDiscs] = useState<BagDisc[]>([])
  const [hole, setHole] = useState<Hole>(() => localState.loadHole() ?? DEFAULT_HOLE)

  const [pickedCourse, setPickedCourse] = useState<Course | null>(null)
  const [pickedCourseId, setPickedCourseId] = useState<string | null>(
    () => savedRound?.courseId ?? null,
  )
  const [pickedHoleNumber, setPickedHoleNumber] = useState<number | null>(
    () => savedRound?.holeNumber ?? null,
  )

  const [roundId, setRoundId] = useState<string | null>(
    () => savedRound?.roundId ?? null,
  )
  const [roundActive, setRoundActive] = useState(savedRound?.active ?? false)
  const [roundThrows, setRoundThrows] = useState<RoundThrow[]>([])
  const [roundBusy, setRoundBusy] = useState(false)

  const isPro = me?.isPro ?? false

  useEffect(() => localState.saveHole(hole), [hole])

  useEffect(() => {
    if (pickedCourseId == null && pickedHoleNumber == null && !roundActive) {
      localState.clearRound()
      return
    }
    localState.saveRound({
      courseId: pickedCourseId,
      holeNumber: pickedHoleNumber,
      roundId,
      active: roundActive,
    })
  }, [pickedCourseId, pickedHoleNumber, roundId, roundActive])

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

  useEffect(() => {
    if (!user || !isPro) return
    let cancelled = false
    getActiveRound()
      .then(async active => {
        if (cancelled || !active) return
        setRoundId(active.id)
        setRoundActive(true)
        if (active.course_id) {
          setPickedCourseId(active.course_id)
        }
        const throws = await listThrowsForRound(active.id)
        if (!cancelled) setRoundThrows(throws)
      })
      .catch(err => console.error('[home] restore active round failed', err))
    return () => {
      cancelled = true
    }
  }, [user, isPro])

  useEffect(() => {
    if (!roundId || !roundActive) {
      setRoundThrows([])
      return
    }
    listThrowsForRound(roundId)
      .then(setRoundThrows)
      .catch(err => console.error('[home] load round throws failed', err))
  }, [roundId, roundActive])

  const loggedHoleNumber = useMemo(() => {
    if (pickedHoleNumber == null) return null
    const logged = roundThrows.some(t => t.holeNumber === pickedHoleNumber)
    return logged ? pickedHoleNumber : null
  }, [pickedHoleNumber, roundThrows])

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
      setPickedCourse(course)
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

  const handleStartRound = useCallback(async () => {
    if (!pickedCourseId || !activeBagId || !isPro) return
    setRoundBusy(true)
    try {
      const id = await startRound({
        courseId: pickedCourseId,
        bagId: activeBagId,
      })
      setRoundId(id)
      setRoundActive(true)
      setRoundThrows([])
    } catch (err) {
      console.error('[home] start round failed', err)
      alert(err instanceof Error ? err.message : 'Could not start round')
    } finally {
      setRoundBusy(false)
    }
  }, [pickedCourseId, activeBagId, isPro])

  const handleEndRound = useCallback(async () => {
    if (!roundId) {
      setRoundActive(false)
      return
    }
    setRoundBusy(true)
    try {
      await endRound(roundId)
      setRoundId(null)
      setRoundActive(false)
      setRoundThrows([])
    } catch (err) {
      console.error('[home] end round failed', err)
      alert(err instanceof Error ? err.message : 'Could not end round')
    } finally {
      setRoundBusy(false)
    }
  }, [roundId])

  const handleLogThrow = useCallback(
    async (rec: Rec) => {
      if (!roundId || pickedHoleNumber == null) return
      try {
        const t = await logThrow({
          roundId,
          holeNumber: pickedHoleNumber,
          bagDiscId: rec.bagDisc.id,
          discName: rec.bagDisc.discName,
          throwStyle: rec.throwStyle,
          recommendedRank: rec.rank,
        })
        setRoundThrows(prev => [...prev, t])
      } catch (err) {
        console.error('[home] log throw failed', err)
        alert(err instanceof Error ? err.message : 'Could not log throw')
      }
    },
    [roundId, pickedHoleNumber],
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
        roundActive={roundActive}
        throwCount={roundThrows.length}
        isPro={isPro}
        roundBusy={roundBusy}
        onStartRound={handleStartRound}
        onEndRound={handleEndRound}
      />
      <HoleInput
        hole={hole}
        onChange={setHole}
        locked={locked}
        courseLat={pickedCourse?.lat ?? null}
        courseLon={pickedCourse?.lon ?? null}
        isPro={isPro}
      />
      <Recommendation
        recommendations={recommendations}
        roundActive={roundActive && pickedCourseId != null}
        isPro={isPro}
        loggedHoleNumber={loggedHoleNumber}
        currentHoleNumber={pickedHoleNumber}
        onLogThrow={handleLogThrow}
      />
    </div>
  )
}
