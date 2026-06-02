import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { PlayerSetup, PerTypeDistancePatch } from '../components/PlayerSetup'
import { BagSummary } from '../components/BagSummary'
import { HoleInput } from '../components/HoleInput'
import { CourseCheckInPanel } from '../components/CourseCheckInPanel'
import { RecommendContextBar } from '../components/RecommendContextBar'
import { HoleShotTracker } from '../components/HoleShotTracker'
import { LieLayoutValue } from '../components/LieLayoutInput'
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
import { supabase } from '../lib/supabase'
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
import { refreshChallengeProgress } from '../lib/challenges'
import { refreshProgression, listPlayerBadges } from '../lib/progression'
import { autoSubmitRoundToLeagues } from '../lib/leagues'
import {
  applyLieLayout,
  holeToLieLayout,
} from '../lib/lieLayout'
import {
  effectiveHoleForShots,
  HoleShot,
  holeProgress,
} from '../lib/holeShots'
import { updateCourseHole, listCourses, listHolesForCourse } from '../lib/courses'
import { Scorecard } from '../components/Scorecard'
import { QuickScoreBar } from '../components/QuickScoreBar'
import { RoundInviteBanner } from '../components/RoundInviteBanner'
import { HoleNoteEditor } from '../components/HoleNoteEditor'
import { HomeProgressStrip } from '../components/HomeProgressStrip'
import { CaddyAdherencePanel } from '../components/CaddyAdherencePanel'
import { computeAdherenceFromThrows } from '../lib/caddyAdherence'
import { BadgeUnlockBanner } from '../components/BadgeUnlockBanner'
import {
  Bag,
  BagDisc,
  Course,
  CourseHole,
  Hole,
  HoleMemory,
  Hand,
  Recommendation as Rec,
  RoundThrow,
  RoundPlayer,
  RoundScore,
  RoundInvite,
  RoundFormat,
  TeeBearing,
  ThrowStyle,
  PlayerBadge,
} from '../types'

const DEFAULT_HOLE: Hole = {
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
  const [handOverride, setHandOverride] = useState<Hand | null>(null)
  const [primaryThrowOverride, setPrimaryThrowOverride] = useState<ThrowStyle | null>(null)
  const [holeMemories, setHoleMemories] = useState<HoleMemory[]>([])
  const [holeMemoryVersion, setHoleMemoryVersion] = useState(0)
  const [pendingInvites, setPendingInvites] = useState<RoundInvite[]>([])
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [offlineHint, setOfflineHint] = useState<string | null>(null)
  const [roundFormat, setRoundFormat] = useState<RoundFormat>('stroke')
  const [leagueSubmitMsg, setLeagueSubmitMsg] = useState<string | null>(null)
  const [newBadges, setNewBadges] = useState<PlayerBadge[]>([])
  const [holeShots, setHoleShots] = useState<HoleShot[]>([])
  const [lieLayout, setLieLayout] = useState<Partial<LieLayoutValue>>({})

  const isPro = me?.isPro ?? false

  useEffect(() => localState.saveHole(hole), [hole])

  useEffect(() => {
    setHoleShots([])
    setLieLayout({})
  }, [pickedCourseId, pickedHoleNumber])

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

  const showQuickScoreBar =
    roundActive && roundId != null && pickedHoleNumber != null && roundPlayers.length > 0

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
    const [playersRes, scoresRes, throwsRes, roundRes] = await Promise.allSettled([
      listPlayersForRound(id),
      listScoresForRound(id),
      listThrowsForRound(id),
      supabase.from('rounds').select('format').eq('id', id).maybeSingle(),
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
    if (roundRes.status === 'fulfilled' && roundRes.value.data?.format) {
      setRoundFormat(roundRes.value.data.format as RoundFormat)
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
          treeLayouts: ch.treeLayouts ?? [],
          mandos: ch.mandos ?? [],
          teeBearing: ch.teeBearing,
        }))
      }
      setHandOverride(null)
      setPrimaryThrowOverride(null)
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
      try {
        const leagueResult = await autoSubmitRoundToLeagues(endingRoundId)
        if (leagueResult.submitted > 0) {
          setLeagueSubmitMsg(
            `Submitted to ${leagueResult.submitted} league${leagueResult.submitted > 1 ? 's' : ''} automatically.`,
          )
        }
      } catch {
        // migration 026 may not be applied yet
      }
      if (wasHost) {
        notifyFriendsRoundCompleted(endingRoundId).catch(() => {})
        refreshChallengeProgress().catch(() => {})
        try {
          const beforeBadges = await listPlayerBadges()
          await refreshProgression()
          const afterBadges = await listPlayerBadges()
          const unlocked = afterBadges.filter(
            b => !beforeBadges.some(prev => prev.slug === b.slug),
          )
          if (unlocked.length > 0) setNewBadges(unlocked)
        } catch {
          refreshProgression().catch(() => {})
        }
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

  const shotProgress = useMemo(
    () => holeProgress(hole.distance, holeShots),
    [hole.distance, holeShots],
  )
  const remainingDist = shotProgress.status === 'playing' ? shotProgress.remaining : 0
  const effectiveHole = useMemo(() => {
    const fromShots =
      holeShots.length > 0 ? effectiveHoleForShots(hole, holeShots) : hole
    return Object.keys(lieLayout).length > 0
      ? applyLieLayout(fromShots, lieLayout)
      : fromShots
  }, [hole, holeShots, lieLayout])

  const handleLieLayoutChange = useCallback((patch: Partial<LieLayoutValue>) => {
    if (Object.keys(patch).length === 0) {
      setLieLayout({})
      return
    }
    setLieLayout(prev => ({ ...prev, ...patch }))
  }, [])

  const recommendOpts = useMemo(() => {
    const profilePrimary = me?.primaryThrow ?? 'backhand'
    const effectiveHand = handOverride ?? me?.dominantHand ?? 'right'
    const effectivePrimary = primaryThrowOverride ?? profilePrimary
    const throwsForehand =
      effectivePrimary === 'forehand' ||
      (primaryThrowOverride == null &&
        ((me?.throwsForehand ?? false) || profilePrimary === 'forehand'))

    return {
      bag: discs,
      hole: effectiveHole,
      playerMaxDistance: me?.maxDistance ?? 280,
      playerPutterDistance:
        me?.putterMaxDistance ?? Math.round((me?.maxDistance ?? 280) * 0.5),
      playerMidrangeDistance:
        me?.midrangeMaxDistance ?? Math.round((me?.maxDistance ?? 280) * 0.7),
      playerFairwayDistance:
        me?.fairwayMaxDistance ?? Math.round((me?.maxDistance ?? 280) * 0.85),
      playerForehandDistance: me?.forehandMaxDistance ?? me?.maxDistance ?? 280,
      hand: effectiveHand,
      throwsForehand,
      primaryThrow: effectivePrimary,
    }
  }, [discs, effectiveHole, me, handOverride, primaryThrowOverride])

  const recommendations = useMemo(() => {
    if (!me || hole.distance < 50) return []
    const base = recommend(recommendOpts)
    if (holeShots.length > 0 || !isPro || !holeMemory) return base
    return applyHoleMemory(base, holeMemory, discs)
  }, [me, recommendOpts, holeMemory, discs, isPro, holeShots.length, hole.distance])

  const suggestedThrow = useMemo(() => {
    const top = recommendations[0]
    if (!top) return null
    return {
      bagDiscId: top.bagDisc.id,
      discName: top.bagDisc.discName,
      distanceFt: top.effDistance,
      throwStyle: top.throwStyle,
    }
  }, [recommendations])

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

  const profileHand = me?.dominantHand ?? 'right'
  const profilePrimaryThrow = me?.primaryThrow ?? 'backhand'
  const effectiveHand = handOverride ?? profileHand
  const effectivePrimaryThrow = primaryThrowOverride ?? profilePrimaryThrow

  const handleRecommendHandChange = useCallback(
    (hand: Hand) => {
      setHandOverride(hand === profileHand ? null : hand)
    },
    [profileHand],
  )

  const handleRecommendPrimaryThrowChange = useCallback(
    (style: ThrowStyle) => {
      setPrimaryThrowOverride(style === profilePrimaryThrow ? null : style)
    },
    [profilePrimaryThrow],
  )

  const activeBag = bags.find(b => b.id === activeBagId) ?? null
  const holeSource =
    pickedCourseId != null && pickedHoleNumber != null ? 'course' : 'custom'
  const courseHoleLabel =
    pickedCourse && pickedHoleNumber != null
      ? `${pickedCourse.name} · Hole ${pickedHoleNumber}`
      : undefined
  const isRoundHost = roundHostId != null && user?.id === roundHostId
  const hostPlayer = roundPlayers.find(p => p.isHost)

  const handleHoleShotsChange = useCallback(
    (nextShots: HoleShot[]) => {
      setHoleShots(prev => {
        if (
          nextShots.length > prev.length &&
          roundActive &&
          isPro &&
          isRoundHost &&
          roundId &&
          pickedHoleNumber != null
        ) {
          const shot = nextShots[nextShots.length - 1]
          if (shot.bagDiscId && shot.discName) {
            const style = shot.throwStyle ?? effectivePrimaryThrow
            const match =
              recommendations.find(
                r => r.bagDisc.id === shot.bagDiscId && r.throwStyle === style,
              ) ?? recommendations.find(r => r.bagDisc.id === shot.bagDiscId)
            void logThrow({
              roundId,
              holeNumber: pickedHoleNumber,
              bagDiscId: shot.bagDiscId,
              discName: shot.discName,
              throwStyle: style,
              recommendedRank: match?.rank ?? null,
              usedRecommendation: match?.rank === 1,
              throwPhase: shot.throwPhase ?? null,
              remainingBeforeFt: shot.remainingBeforeFt ?? null,
              throwDistanceFt: shot.distanceFt,
            })
              .then(t => setRoundThrows(r => [...r, t]))
              .catch(err => console.error('[home] log hole shot failed', err))
          }
        }
        return nextShots
      })
    },
    [
      roundActive,
      isPro,
      isRoundHost,
      roundId,
      pickedHoleNumber,
      recommendations,
      effectivePrimaryThrow,
    ],
  )

  const isGroupParticipant = roundActive && !isRoundHost && roundPlayers.length > 0

  const roundAdherence = useMemo(
    () => computeAdherenceFromThrows(roundThrows),
    [roundThrows],
  )

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
      {newBadges.length > 0 && (
        <BadgeUnlockBanner badges={newBadges} onDismiss={() => setNewBadges([])} />
      )}
      {leagueSubmitMsg && (
        <div className="card league-auto-banner">
          <strong>League update</strong>
          <p className="muted small">{leagueSubmitMsg}</p>
          <button
            type="button"
            className="link-button"
            onClick={() => setLeagueSubmitMsg(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {shareUrl && (
        <div className="card round-share-banner">
          <strong>Round recap link</strong>
          <p className="muted small">
            Share your finished round with friends — great for league night posts and group chats.
          </p>
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
      {!roundActive && user && <HomeProgressStrip />}
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
      <CourseCheckInPanel
        courseId={pickedCourseId}
        courseName={pickedCourse?.name ?? null}
        courseLocality={pickedCourse?.locality ?? null}
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
          roundFormat={roundFormat}
          onFormatChange={() => refreshRoundData(roundId)}
        />
      )}
      <HoleNoteEditor courseId={pickedCourseId} holeNumber={pickedHoleNumber} />
      {roundActive && roundId && roundPlayers.length === 0 && (
        <p className="muted small card scorecard-migration-hint">
          Scorecard unavailable — run{' '}
          <code>013_scorecard_social.sql</code> in Supabase to enable group scoring.
        </p>
      )}
      <RecommendContextBar
        mode={holeSource}
        courseName={pickedCourse?.name}
        holeNumber={pickedHoleNumber}
        hole={effectiveHole}
        roundActive={roundActive}
        remainingDistance={remainingDist}
        shotCount={holeShots.length}
        shotProgressStatus={shotProgress.status}
        overshootFt={shotProgress.overshootFt}
      />
      <HoleInput
        hole={hole}
        onChange={setHole}
        source={holeSource}
        courseLabel={courseHoleLabel}
        courseLat={pickedCourse?.lat ?? null}
        courseLon={pickedCourse?.lon ?? null}
        onPersistTeeBearing={
          pickedCourseHoleId ? handlePersistTeeBearing : undefined
        }
        lieLayout={lieLayout}
        onLieLayoutChange={handleLieLayoutChange}
      />
      <HoleShotTracker
        holeDistance={hole.distance}
        shots={holeShots}
        onChange={handleHoleShotsChange}
        bagDiscs={discs}
        primaryThrow={effectivePrimaryThrow}
        teeBearing={hole.teeBearing}
        suggestedThrow={suggestedThrow}
        baseLayout={holeToLieLayout(hole)}
        lieLayout={lieLayout}
        onLieLayoutChange={handleLieLayoutChange}
      />
      {roundActive && isPro && (
        <div className="card">
          <CaddyAdherencePanel
            stats={roundAdherence}
            title="This round — Caddy vs your bag"
            compact
            showStatsLink
          />
        </div>
      )}
      <Recommendation
        recommendations={recommendations}
        bagDiscs={discs}
        hand={effectiveHand}
        primaryThrow={effectivePrimaryThrow}
        profileHand={profileHand}
        profilePrimaryThrow={profilePrimaryThrow}
        onHandChange={handleRecommendHandChange}
        onPrimaryThrowChange={handleRecommendPrimaryThrowChange}
        getDiscRecommendation={getDiscRecommendation}
        roundActive={roundActive && pickedCourseId != null && isRoundHost}
        isPro={isPro}
        currentHoleNumber={pickedHoleNumber}
        onLogThrow={handleLogThrow}
        holeMemoryMessage={holeMemoryMessage}
        memorySelection={memorySelection}
        holeDistance={hole.distance}
        remainingDistance={remainingDist}
        shotCount={holeShots.length}
        shotProgressStatus={shotProgress.status}
        overshootFt={shotProgress.overshootFt}
      />
      {showQuickScoreBar && roundId && pickedHoleNumber != null && (
        <QuickScoreBar
          roundId={roundId}
          players={roundPlayers}
          scores={roundScores}
          holes={courseHoles}
          currentHoleNumber={pickedHoleNumber}
          currentUserId={user?.id ?? ''}
          isHost={isRoundHost}
          onScoresChange={() => refreshRoundData(roundId)}
          onOptimisticScore={handleOptimisticScore}
        />
      )}
    </div>
  )
}
