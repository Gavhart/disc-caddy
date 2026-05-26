import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { PlayerSetup, PerTypeDistancePatch } from '../components/PlayerSetup'
import { BagSummary } from '../components/BagSummary'
import { HoleInput } from '../components/HoleInput'
import { Recommendation } from '../components/Recommendation'
import { BagPicker } from '../components/BagPicker'
import { CourseSelector } from '../components/CourseSelector'
import { recommend, recommendForDisc } from '../lib/recommend'
import {
  applyHoleMemory,
  buildHoleMemoriesMessage,
  fetchHoleMemories,
  resolveMemoryBagDiscId,
} from '../lib/holeMemory'
import { updateMaxDistance, updatePlayer } from '../lib/profile'
import { localState } from '../lib/storage'
import { createBag, listBags, listDiscsInBag } from '../lib/bags'
import {
  endRound,
  getActiveRound,
  getRoundStatus,
  listPlayersForRound,
  listScoresForRound,
  listThrowsForRound,
  logThrow,
  startRound,
  upsertHoleScore,
} from '../lib/rounds'
import { subscribeRoundUpdates } from '../lib/roundRealtime'
import {
  cacheCourseHoles,
  isOnline,
  loadCachedCourseHoles,
  syncOfflineScoreQueue,
} from '../lib/offlineRound'
import {
  listPendingRoundInvites,
  notifyFriendsRoundCompleted,
} from '../lib/roundInvites'
import { createRoundShareLink, roundShareUrl } from '../lib/roundShare'
import { updateCourseHole, listCourses, listHolesForCourse } from '../lib/courses'
import { Scorecard } from '../components/Scorecard'
import { RoundInviteBanner } from '../components/RoundInviteBanner'
import { HoleNoteEditor } from '../components/HoleNoteEditor'
import {
  Bag,
  BagDisc,
  Course,
  CourseHole,
  Hole,
  HoleMemory,
  Recommendation as Rec,
  RoundThrow,
  RoundPlayer,
  RoundScore,
  RoundInvite,
  TeeBearing,
  ThrowStyle,
} from '../types'

const DEFAULT_HOLE: Hole = {
  distance: 300,
  direction: 'straight',
  elevation: 'flat',
  terrain: 'flat',
  treeCoverage: 'open',
  treeLayout: 'none',
  teeBearing: 'north',
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
  const [pickedCourseHoleId, setPickedCourseHoleId] = useState<string | null>(null)

  const [roundId, setRoundId] = useState<string | null>(
    () => savedRound?.roundId ?? null,
  )
  const [roundActive, setRoundActive] = useState(savedRound?.active ?? false)
  const [roundThrows, setRoundThrows] = useState<RoundThrow[]>([])
  const [roundPlayers, setRoundPlayers] = useState<RoundPlayer[]>([])
  const [roundScores, setRoundScores] = useState<RoundScore[]>([])
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([])
  const [roundHostId, setRoundHostId] = useState<string | null>(null)
  const [roundBusy, setRoundBusy] = useState(false)
  const [roundError, setRoundError] = useState<string | null>(null)
  const [holeMemory, setHoleMemory] = useState<HoleMemory | null>(null)
  const [holeMemories, setHoleMemories] = useState<HoleMemory[]>([])
  const [holeMemoryVersion, setHoleMemoryVersion] = useState(0)
  const [pendingInvites, setPendingInvites] = useState<RoundInvite[]>([])
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [offlineHint, setOfflineHint] = useState<string | null>(null)

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
    if (!pickedCourseId) {
      setCourseHoles([])
      return
    }
    listHolesForCourse(pickedCourseId)
      .then(holes => {
        setCourseHoles(holes)
        cacheCourseHoles(pickedCourseId, holes)
        setOfflineHint(null)
      })
      .catch(err => {
        console.error('[home] load course holes failed', err)
        const cached = loadCachedCourseHoles(pickedCourseId)
        if (cached?.length) {
          setCourseHoles(cached)
          setOfflineHint('Using cached holes — scores will sync when you reconnect.')
        }
      })
  }, [pickedCourseId])

  useEffect(() => {
    if (!user) return
    listPendingRoundInvites()
      .then(setPendingInvites)
      .catch(() => setPendingInvites([]))
  }, [user])

  useEffect(() => {
    if (!isPro || !pickedCourseId || pickedHoleNumber == null) {
      setHoleMemory(null)
      setHoleMemories([])
      return
    }
    let cancelled = false
    fetchHoleMemories(pickedCourseId, pickedHoleNumber, 3)
      .then(memories => {
        if (!cancelled) {
          setHoleMemories(memories)
          setHoleMemory(memories[0] ?? null)
        }
      })
      .catch(err => {
        console.warn('[home] hole memory fetch failed', err)
        if (!cancelled) {
          setHoleMemory(null)
          setHoleMemories([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [isPro, pickedCourseId, pickedHoleNumber, holeMemoryVersion])

  const refreshRoundData = useCallback(async (id: string) => {
    const [playersRes, scoresRes, throwsRes] = await Promise.allSettled([
      listPlayersForRound(id),
      listScoresForRound(id),
      listThrowsForRound(id),
    ])
    if (playersRes.status === 'fulfilled') {
      setRoundPlayers(playersRes.value)
    } else {
      console.warn('[home] load round players failed', playersRes.reason)
      setRoundPlayers([])
    }
    if (scoresRes.status === 'fulfilled') {
      setRoundScores(scoresRes.value)
    } else {
      console.warn('[home] load round scores failed', scoresRes.reason)
      setRoundScores([])
    }
    if (throwsRes.status === 'fulfilled') {
      setRoundThrows(throwsRes.value)
    } else {
      console.warn('[home] load round throws failed', throwsRes.reason)
      setRoundThrows([])
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getActiveRound()
      .then(async active => {
        if (cancelled || !active) return
        setRoundId(active.id)
        setRoundActive(true)
        setRoundHostId(active.user_id)
        if (active.course_id) {
          setPickedCourseId(active.course_id)
          try {
            const courses = await listCourses()
            if (!cancelled) {
              setPickedCourse(courses.find(c => c.id === active.course_id) ?? null)
            }
          } catch (err) {
            console.warn('[home] load course for group round failed', err)
          }
        }
        if (!cancelled) await refreshRoundData(active.id)
      })
      .catch(err => console.error('[home] restore active round failed', err))
    return () => {
      cancelled = true
    }
  }, [user, refreshRoundData])

  useEffect(() => {
    if (!roundId || !roundActive) {
      setRoundThrows([])
      setRoundPlayers([])
      setRoundScores([])
      if (!roundActive) setRoundHostId(null)
      return
    }

    refreshRoundData(roundId).catch(err =>
      console.error('[home] load round data failed', err),
    )

    return subscribeRoundUpdates(roundId, () => {
      getRoundStatus(roundId)
        .then(status => {
          if (status === 'completed') {
            setRoundActive(false)
            setRoundId(null)
            setRoundHostId(null)
            setRoundThrows([])
            setRoundPlayers([])
            setRoundScores([])
            return
          }
          return refreshRoundData(roundId)
        })
        .catch(err => console.error('[home] live round refresh failed', err))
    })
  }, [roundId, roundActive, refreshRoundData])

  useEffect(() => {
    const sync = () => {
      if (!roundId || !isOnline()) return
      syncOfflineScoreQueue(async item => {
        await upsertHoleScore({
          roundId: item.roundId,
          roundPlayerId: item.roundPlayerId,
          holeNumber: item.holeNumber,
          strokes: item.strokes,
          putts: item.putts,
          par: item.par,
        })
      })
        .then(count => {
          if (count > 0) {
            setOfflineHint(null)
            refreshRoundData(roundId).catch(() => {})
          }
        })
        .catch(() => {})
    }
    window.addEventListener('online', sync)
    sync()
    return () => window.removeEventListener('online', sync)
  }, [roundId, refreshRoundData])

  const handleOptimisticScore = useCallback(
    (update: {
      roundPlayerId: string
      holeNumber: number
      strokes: number
      putts: number | null
      par: number | null
    }) => {
      setRoundScores(prev => {
        const rest = prev.filter(
          s =>
            !(
              s.roundPlayerId === update.roundPlayerId &&
              s.holeNumber === update.holeNumber
            ),
        )
        return [
          ...rest,
          {
            id: `offline-${update.roundPlayerId}-${update.holeNumber}`,
            roundId: roundId ?? '',
            roundPlayerId: update.roundPlayerId,
            holeNumber: update.holeNumber,
            strokes: update.strokes,
            putts: update.putts,
            par: update.par,
            updatedAt: new Date().toISOString(),
          },
        ]
      })
      if (!isOnline()) {
        setOfflineHint('Score saved offline — will sync when you reconnect.')
      }
    },
    [roundId],
  )

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
      setPickedCourseHoleId(ch?.id ?? null)
      if (ch) {
        setHole(prev => ({
          ...prev,
          distance: ch.distance,
          direction: ch.direction,
          elevation: ch.elevation,
          terrain: ch.terrain,
          treeCoverage: ch.treeCoverage,
          treeLayout: ch.treeLayout,
          teeBearing: ch.teeBearing,
        }))
      }
    },
    [],
  )

  const handlePersistTeeBearing = useCallback(
    async (bearing: TeeBearing) => {
      if (!pickedCourseHoleId) return
      try {
        await updateCourseHole(pickedCourseHoleId, { teeBearing: bearing })
      } catch (err) {
        console.error('[home] persist tee bearing failed', err)
      }
    },
    [pickedCourseHoleId],
  )

  const handleStartRound = useCallback(async () => {
    setRoundError(null)
    if (!user) {
      setRoundError('Sign in to start a live round.')
      return
    }
    if (!isPro) {
      setRoundError('Live rounds require a Pro subscription.')
      return
    }
    if (!pickedCourseId) {
      setRoundError('Pick a course before starting a live round.')
      return
    }
    if (!activeBagId) {
      setRoundError('Select a bag at the top of the page before starting.')
      return
    }
    setRoundBusy(true)
    try {
      const id = await startRound({
        courseId: pickedCourseId,
        bagId: activeBagId,
        hostDisplayName:
          me?.displayName?.trim() ||
          user.email?.split('@')[0] ||
          'You',
      })
      setRoundId(id)
      setRoundActive(true)
      setRoundHostId(user.id)
      setRoundThrows([])
      await refreshRoundData(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start round'
      console.error('[home] start round failed', err)
      setRoundError(message)
    } finally {
      setRoundBusy(false)
    }
  }, [pickedCourseId, activeBagId, isPro, user, me, refreshRoundData])

  const handleEndRound = useCallback(async () => {
    if (!roundId) {
      setRoundActive(false)
      return
    }
    setRoundBusy(true)
    const endingRoundId = roundId
    const wasHost = roundHostId != null && user?.id === roundHostId
    try {
      await endRound(endingRoundId)
      if (wasHost) {
        notifyFriendsRoundCompleted(endingRoundId).catch(() => {})
        try {
          const token = await createRoundShareLink(endingRoundId)
          setShareUrl(roundShareUrl(token))
        } catch {
          // share link optional until migration 024
        }
      }
      setRoundId(null)
      setRoundActive(false)
      setRoundThrows([])
      setRoundPlayers([])
      setRoundScores([])
      setRoundHostId(null)
      setHoleMemoryVersion(v => v + 1)
    } catch (err) {
      console.error('[home] end round failed', err)
      alert(err instanceof Error ? err.message : 'Could not end round')
    } finally {
      setRoundBusy(false)
    }
  }, [roundId, roundHostId, user?.id])

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
          recommendedRank: rec.rank > 0 ? rec.rank : null,
          usedRecommendation: rec.rank === 1,
        })
        setRoundThrows(prev => [...prev, t])
      } catch (err) {
        console.error('[home] log throw failed', err)
        alert(err instanceof Error ? err.message : 'Could not log throw')
      }
    },
    [roundId, pickedHoleNumber],
  )

  const recommendOpts = useMemo(
    () => ({
      bag: discs,
      hole,
      playerMaxDistance: me?.maxDistance ?? 280,
      playerPutterDistance:
        me?.putterMaxDistance ?? Math.round((me?.maxDistance ?? 280) * 0.5),
      playerMidrangeDistance:
        me?.midrangeMaxDistance ?? Math.round((me?.maxDistance ?? 280) * 0.7),
      playerFairwayDistance:
        me?.fairwayMaxDistance ?? Math.round((me?.maxDistance ?? 280) * 0.85),
      playerForehandDistance: me?.forehandMaxDistance ?? me?.maxDistance ?? 280,
      hand: me?.dominantHand,
      throwsForehand: me?.throwsForehand,
      primaryThrow: me?.primaryThrow,
    }),
    [discs, hole, me],
  )

  const recommendations = useMemo(() => {
    if (!me) return []
    const base = recommend(recommendOpts)
    if (!isPro || !holeMemory) return base
    return applyHoleMemory(base, holeMemory, discs)
  }, [me, recommendOpts, holeMemory, discs, isPro])

  const holeMemoryMessage = useMemo(() => {
    if (holeMemories.length === 0) return null
    return buildHoleMemoriesMessage(holeMemories, discs)
  }, [holeMemories, discs])

  const memorySelection = useMemo(() => {
    if (!isPro || !holeMemory) return null
    const bagDiscId = resolveMemoryBagDiscId(holeMemory, discs)
    if (!bagDiscId) return null
    return { bagDiscId, throwStyle: holeMemory.throwStyle }
  }, [holeMemory, discs, isPro])

  const getDiscRecommendation = useCallback(
    (bagDiscId: string, throwStyle?: ThrowStyle) =>
      recommendForDisc(recommendOpts, bagDiscId, throwStyle),
    [recommendOpts],
  )

  const activeBag = bags.find(b => b.id === activeBagId) ?? null
  const locked = pickedHoleNumber !== null
  const isRoundHost = roundHostId != null && user?.id === roundHostId
  const hostPlayer = roundPlayers.find(p => p.isHost)
  const isGroupParticipant = roundActive && !isRoundHost && roundPlayers.length > 0

  return (
    <div className="container">
      <RoundInviteBanner
        invites={pendingInvites}
        onChange={async () => {
          const invites = await listPendingRoundInvites().catch(() => [])
          setPendingInvites(invites)
          const active = await getActiveRound().catch(() => null)
          if (active) {
            setRoundId(active.id)
            setRoundActive(true)
            setRoundHostId(active.user_id)
            if (active.course_id) setPickedCourseId(active.course_id)
            await refreshRoundData(active.id)
          }
        }}
      />
      {shareUrl && (
        <div className="card round-share-banner">
          <strong>Round recap link</strong>
          <p className="muted small">Share your finished round with friends.</p>
          <div className="round-share-row">
            <input type="text" readOnly value={shareUrl} className="round-share-input" />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl).catch(() => {})
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => setShareUrl(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {offlineHint && (
        <div className="card offline-banner">
          <p className="muted small">{offlineHint}</p>
        </div>
      )}
      {isGroupParticipant && (
        <div className="card group-round-banner">
          <strong>Group scorecard</strong>
          <p className="muted small">
            You&apos;re playing with{' '}
            {hostPlayer?.displayName ?? 'the host'}. Scores sync live — enter
            yours below. This round will appear in your history when it ends.
          </p>
        </div>
      )}
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
        isRoundHost={isRoundHost}
        roundBusy={roundBusy}
        roundError={roundError}
        activeBagReady={activeBagId != null}
        onStartRound={handleStartRound}
        onEndRound={handleEndRound}
      />
      {roundActive && roundId && pickedHoleNumber != null && (
        <Scorecard
          roundId={roundId}
          players={roundPlayers}
          scores={roundScores}
          holes={courseHoles}
          currentHoleNumber={pickedHoleNumber}
          currentUserId={user?.id ?? ''}
          isHost={isRoundHost}
          onPlayersChange={() => refreshRoundData(roundId)}
          onScoresChange={() => refreshRoundData(roundId)}
          onOptimisticScore={handleOptimisticScore}
        />
      )}
      <HoleNoteEditor courseId={pickedCourseId} holeNumber={pickedHoleNumber} />
      {roundActive && roundId && roundPlayers.length === 0 && (
        <p className="muted small card scorecard-migration-hint">
          Scorecard unavailable — run{' '}
          <code>013_scorecard_social.sql</code> in Supabase to enable group scoring.
        </p>
      )}
        <HoleInput
        hole={hole}
        onChange={setHole}
        locked={locked}
        courseLat={pickedCourse?.lat ?? null}
        courseLon={pickedCourse?.lon ?? null}
        onPersistTeeBearing={
          pickedCourseHoleId ? handlePersistTeeBearing : undefined
        }
      />
      <Recommendation
        recommendations={recommendations}
        throwsForehand={me?.throwsForehand ?? false}
        getDiscRecommendation={getDiscRecommendation}
        roundActive={roundActive && pickedCourseId != null && isRoundHost}
        isPro={isPro}
        loggedHoleNumber={loggedHoleNumber}
        currentHoleNumber={pickedHoleNumber}
        onLogThrow={handleLogThrow}
        holeMemoryMessage={holeMemoryMessage}
        memorySelection={memorySelection}
      />
    </div>
  )
}
