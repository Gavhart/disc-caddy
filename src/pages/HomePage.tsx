import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { PlayerSetup } from '../components/PlayerSetup'
import { MyBag } from '../components/MyBag'
import { HoleInput } from '../components/HoleInput'
import { Recommendation } from '../components/Recommendation'
import { BagPicker } from '../components/BagPicker'
import { CourseSelector } from '../components/CourseSelector'
import { recommend } from '../lib/recommend'
import { updateMaxDistance } from '../lib/profile'
import { localState } from '../lib/storage'
import {
  addDiscToBag,
  createBag,
  listBags,
  listDiscsInBag,
  removeDiscFromBag,
  renameBag,
  updateBagDisc,
} from '../lib/bags'
import { Bag, BagDisc, Course, CourseHole, Hole } from '../types'

const DEFAULT_HOLE: Hole = {
  distance: 300,
  direction: 'straight',
  elevation: 'flat',
  windDirection: 'None',
  windSpeed: 0,
}

export function HomePage() {
  const { user, me, refreshMe } = useAuth()
  const [bags, setBags] = useState<Bag[]>([])
  const [activeBagId, setActiveBagId] = useState<string | null>(null)
  const [discs, setDiscs] = useState<BagDisc[]>([])
  const [hole, setHole] = useState<Hole>(() => localState.loadHole() ?? DEFAULT_HOLE)
  const [busy, setBusy] = useState(false)

  // Course/hole pick: when set, the HoleInput is locked to the course-hole values.
  const [pickedCourseId, setPickedCourseId] = useState<string | null>(null)
  const [pickedHoleNumber, setPickedHoleNumber] = useState<number | null>(null)

  useEffect(() => localState.saveHole(hole), [hole])

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

  const handleCreateBag = useCallback(async (name: string) => {
    const newBag = await createBag(name)
    setBags(prev => [...prev, newBag])
    setActiveBagId(newBag.id)
  }, [])

  const handleRenameBag = useCallback(async (bagId: string, name: string) => {
    setBags(prev => prev.map(b => (b.id === bagId ? { ...b, name } : b)))
    try {
      await renameBag(bagId, name)
    } catch (err) {
      console.error('[home] rename bag failed', err)
      const fresh = await listBags()
      setBags(fresh)
    }
  }, [])

  const handleAddDisc = useCallback(async () => {
    if (!activeBagId) return
    setBusy(true)
    try {
      const created = await addDiscToBag(activeBagId, {
        discName: '',
        plastic: 'Premium',
        weight: 'Standard',
        wear: 'New',
        position: discs.length,
      })
      setDiscs(prev => [...prev, created])
    } finally {
      setBusy(false)
    }
  }, [activeBagId, discs.length])

  const handleUpdateDisc = useCallback(
    async (id: string, patch: Partial<BagDisc>) => {
      setDiscs(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)))
      try {
        await updateBagDisc(id, patch)
      } catch (err) {
        console.error('[home] update disc failed', err)
      }
    },
    [],
  )

  const handleRemoveDisc = useCallback(async (id: string) => {
    setDiscs(prev => prev.filter(d => d.id !== id))
    try {
      await removeDiscFromBag(id)
    } catch (err) {
      console.error('[home] remove disc failed', err)
    }
  }, [])

  const handlePhotoChange = useCallback((id: string, newPath: string | null) => {
    setDiscs(prev =>
      prev.map(d => (d.id === id ? { ...d, photoPath: newPath } : d)),
    )
  }, [])

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

  // When the user picks a course hole, fold its values into the Hole input.
  // Wind stays a per-throw override the player can still change.
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
      playerForehandDistance: me.forehandMaxDistance,
      hand: me.dominantHand,
      throwsForehand: me.throwsForehand,
    })
  }, [discs, hole, me])

  const locked = pickedHoleNumber !== null

  return (
    <div className="container">
      <BagPicker
        bags={bags}
        activeBagId={activeBagId}
        onSelect={setActiveBagId}
        onCreate={handleCreateBag}
        onRename={handleRenameBag}
      />
      <PlayerSetup
        maxDistance={me?.maxDistance ?? 280}
        onChange={handleMaxDistanceChange}
      />
      <MyBag
        discs={discs}
        busy={busy}
        onAdd={handleAddDisc}
        onUpdate={handleUpdateDisc}
        onRemove={handleRemoveDisc}
        onPhotoChange={handlePhotoChange}
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
