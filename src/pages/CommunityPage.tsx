import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CommunityMessageModal } from '../components/CommunityMessageModal'
import { PageHeader } from '../components/PageHeader'
import { ProGate } from '../components/ProGate'
import { useAuth } from '../contexts/AuthContext'
import { searchCoursesByName } from '../lib/courses'
import {
  fetchCommunityMembers,
  fetchCommunitySetupStatus,
  fetchMyHomeCities,
  formatCityLabel,
  homeCityFromCourse,
  saveHomeCities,
  sendCommunityMessage,
} from '../lib/community'
import { getActiveRound } from '../lib/rounds'
import { invitePlayerToRound } from '../lib/roundInvites'
import { LocationError, resolveCurrentLocationPlace } from '../lib/geocode'
import { CommunityMember, Course, HomeCity, COMMUNITY_RADIUS_OPTIONS } from '../types'
import type { CommunitySetupStatus } from '../lib/community'

const MAX_HOME_CITIES = 3

function emptyCity(sortOrder: number): HomeCity {
  return {
    city: '',
    regionCode: null,
    countryCode: null,
    courseId: null,
    sortOrder,
    latitude: null,
    longitude: null,
  }
}

function cityKey(c: HomeCity): string {
  return `${c.city.trim().toLowerCase()}|${(c.regionCode ?? '').trim().toLowerCase()}|${(c.countryCode ?? '').trim().toLowerCase()}`
}

export function CommunityPage() {
  const { me, refreshMe } = useAuth()
  const navigate = useNavigate()
  const [cities, setCities] = useState<HomeCity[]>([])
  const [savedCities, setSavedCities] = useState<HomeCity[]>([])
  const [communityVisible, setCommunityVisible] = useState(false)
  const [lookingForPlayers, setLookingForPlayers] = useState(false)
  const [useLocationOnSave, setUseLocationOnSave] = useState(false)
  const [searchRadiusMiles, setSearchRadiusMiles] = useState(25)
  const [locating, setLocating] = useState(false)
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)

  const [courseQuery, setCourseQuery] = useState('')
  const [courseHits, setCourseHits] = useState<Course[]>([])
  const [courseSearching, setCourseSearching] = useState(false)

  const [messageTarget, setMessageTarget] = useState<CommunityMember | null>(null)
  const [messageSending, setMessageSending] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [setupStatus, setSetupStatus] = useState<CommunitySetupStatus | null>(null)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null)
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null)
  const [inviteOk, setInviteOk] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [loadedCities, loadedMembers, loadedStatus] = await Promise.all([
        fetchMyHomeCities(),
        fetchCommunityMembers().catch(err => {
          setMembersError(
            err instanceof Error ? err.message : 'Could not load community members.',
          )
          return [] as CommunityMember[]
        }),
        fetchCommunitySetupStatus().catch(() => null),
      ])
      setMembersError(null)
      setCities(loadedCities.length > 0 ? loadedCities : [emptyCity(0)])
      setSavedCities(loadedCities)
      setMembers(loadedMembers)
      setSetupStatus(loadedStatus)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load community. Apply migrations 014–015 in Supabase.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (me) {
      setCommunityVisible(me.communityVisible)
      setLookingForPlayers(me.lookingForPlayers)
      setSearchRadiusMiles(me.communitySearchRadiusMiles ?? 25)
      loadAll()
    }
  }, [me, loadAll])

  useEffect(() => {
    if (!me?.isPro) {
      setActiveRoundId(null)
      return
    }
    getActiveRound()
      .then(active => {
        if (active && active.user_id === me.id) setActiveRoundId(active.id)
        else setActiveRoundId(null)
      })
      .catch(() => setActiveRoundId(null))
  }, [me?.isPro, me?.id])

  useEffect(() => {
    const q = courseQuery.trim()
    if (q.length < 2) {
      setCourseHits([])
      return
    }
    let cancelled = false
    setCourseSearching(true)
    searchCoursesByName(q)
      .then(hits => {
        if (!cancelled) setCourseHits(hits)
      })
      .catch(() => {
        if (!cancelled) setCourseHits([])
      })
      .finally(() => {
        if (!cancelled) setCourseSearching(false)
      })
    return () => {
      cancelled = true
    }
  }, [courseQuery])

  function updateCity(index: number, patch: Partial<HomeCity>) {
    setCities(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
    setSaveOk(false)
  }

  function addCitySlot() {
    if (cities.length >= MAX_HOME_CITIES) return
    setCities(prev => [...prev, emptyCity(prev.length)])
    setSaveOk(false)
  }

  function removeCitySlot(index: number) {
    setCities(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : [emptyCity(0)]
    })
    setSaveOk(false)
  }

  function addCityFromCourse(course: Course) {
    const derived = homeCityFromCourse(course)
    if (!derived) {
      setError(
        `"${course.name}" has no city/locality in our database — type your city manually below.`,
      )
      return
    }
    setError(null)
    setCities(prev => {
      const key = cityKey(derived)
      const withoutDupes = prev.filter(c => !c.city.trim() || cityKey(c) !== key)
      const trimmed = withoutDupes.filter(c => c.city.trim())
      if (trimmed.length >= MAX_HOME_CITIES) {
        setError('Remove a city first — max 3 home areas.')
        return prev
      }
      const next = [...trimmed, { ...derived, sortOrder: trimmed.length }]
      return next.length > 0 ? next : [derived]
    })
    setCourseQuery('')
    setCourseHits([])
    setSaveOk(false)
  }

  async function applyCurrentLocation() {
    setLocating(true)
    setError(null)
    try {
      const place = await resolveCurrentLocationPlace()
      const derived: HomeCity = {
        city: place.city,
        regionCode: place.regionCode,
        countryCode: place.countryCode,
        courseId: null,
        sortOrder: 0,
        latitude: place.latitude,
        longitude: place.longitude,
      }
      const key = cityKey(derived)
      setCities(prev => {
        const withoutDupes = prev.filter(c => !c.city.trim() || cityKey(c) !== key)
        const trimmed = withoutDupes.filter(c => c.city.trim())
        return [{ ...derived, sortOrder: 0 }, ...trimmed.map((c, i) => ({ ...c, sortOrder: i + 1 }))].slice(
          0,
          MAX_HOME_CITIES,
        )
      })
      setSaveOk(false)
    } catch (err) {
      setError(
        err instanceof LocationError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not use your location.',
      )
    } finally {
      setLocating(false)
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!me) return
    setSaving(true)
    setError(null)
    setSaveOk(false)
    try {
      let working = cities
      if (useLocationOnSave) {
        const place = await resolveCurrentLocationPlace()
        const gpsCity: HomeCity = {
          city: place.city,
          regionCode: place.regionCode,
          countryCode: place.countryCode,
          courseId: null,
          sortOrder: 0,
          latitude: place.latitude,
          longitude: place.longitude,
        }
        const gpsKey = cityKey(gpsCity)
        const rest = working.filter(c => c.city.trim() && cityKey(c) !== gpsKey)
        working = [gpsCity, ...rest].slice(0, MAX_HOME_CITIES)
        setCities(working.length > 0 ? working : [gpsCity])
      }

      const cleaned = working
        .map((c, i) => ({
          ...c,
          city: c.city.trim(),
          regionCode: c.regionCode?.trim() || null,
          countryCode: c.countryCode?.trim() || null,
          sortOrder: i,
        }))
        .filter(c => c.city.length > 0)

      if (communityVisible && cleaned.length === 0) {
        throw new Error('Add at least one home city before opting in to Community.')
      }

      const keys = new Set<string>()
      for (const c of cleaned) {
        const k = cityKey(c)
        if (keys.has(k)) {
          throw new Error('Each home city must be unique.')
        }
        keys.add(k)
      }

      const effectiveLooking = communityVisible && lookingForPlayers

      await saveHomeCities(cleaned, communityVisible, effectiveLooking, searchRadiusMiles)
      await refreshMe()
      const [reloadedCities, reloadedStatus] = await Promise.all([
        fetchMyHomeCities(),
        fetchCommunitySetupStatus().catch(() => null),
      ])
      setCities(reloadedCities.length > 0 ? reloadedCities : [emptyCity(0)])
      setSavedCities(reloadedCities)
      setSetupStatus(reloadedStatus)
      if (!communityVisible) setLookingForPlayers(false)
      setSaveOk(true)

      if (communityVisible && cleaned.length > 0) {
        const [loadedMembers, loadedStatus] = await Promise.all([
          fetchCommunityMembers().catch(err => {
            setMembersError(
              err instanceof Error ? err.message : 'Could not load community members.',
            )
            return [] as CommunityMember[]
          }),
          fetchCommunitySetupStatus().catch(() => null),
        ])
        setMembers(loadedMembers)
        setSetupStatus(loadedStatus)
      } else {
        setMembers([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleInviteToScorecard(member: CommunityMember) {
    if (!activeRoundId) return
    setInviteBusyId(member.userId)
    setInviteOk(null)
    try {
      await invitePlayerToRound(activeRoundId, member.userId)
      setInviteOk(`Invite sent to ${member.displayName}.`)
    } catch (err) {
      setMessageError(
        err instanceof Error ? err.message : 'Could not invite to scorecard',
      )
    } finally {
      setInviteBusyId(null)
    }
  }

  async function handleSendMessage(body: string) {
    if (!messageTarget) return
    setMessageSending(true)
    setMessageError(null)
    try {
      await sendCommunityMessage(messageTarget.userId, body)
      const partnerId = messageTarget.userId
      setMessageTarget(null)
      navigate(`/community/messages/${partnerId}`)
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : 'Could not send message')
    } finally {
      setMessageSending(false)
    }
  }

  if (!me) {
    return (
      <div className="container community-page">
        <div className="card">
          <p className="muted">Loading…</p>
        </div>
      </div>
    )
  }

  const canMessage = me.isPro && me.lookingForPlayers && me.communityVisible
  const needsLookingSave = lookingForPlayers && !me.lookingForPlayers

  const isSavedVisible = me.communityVisible && savedCities.length > 0
  const hasUnsavedChanges =
    communityVisible !== me.communityVisible ||
    lookingForPlayers !== me.lookingForPlayers ||
    searchRadiusMiles !== me.communitySearchRadiusMiles

  return (
    <div className="container community-page">
      <PageHeader
        title="Find players"
        description="Set your home areas and visibility to connect with disc golfers nearby."
        backTo="/social"
        backLabel="Social"
      />

      <div className="card community-callout">
        <p className="community-callout-lead">
          Opt in to appear on Community, then browse players within your search radius.
          Messaging is a Pro feature.
        </p>
        {!me.isPro && (
          <p className="muted small community-pro-note">
            Free accounts can browse; upgrade to send and reply to messages.
          </p>
        )}
      </div>

      <form className="card community-settings-card" onSubmit={handleSave}>
        <h2 className="section-title">Visibility &amp; home areas</h2>

        <div className="community-radius-field">
          <span className="community-radius-label">Search radius</span>
          <div className="chip-row community-radius-chips">
            {COMMUNITY_RADIUS_OPTIONS.map(miles => (
              <button
                key={miles}
                type="button"
                className={`chip${searchRadiusMiles === miles ? ' chip-on' : ''}`}
                onClick={() => {
                  setSearchRadiusMiles(miles)
                  setSaveOk(false)
                }}
                disabled={saving || loading}
              >
                {miles} mi
              </button>
            ))}
          </div>
          <p className="muted small community-radius-hint">
            Uses GPS coordinates on saved home areas. Typed cities are geocoded
            when you save.
          </p>
        </div>

        <div className="community-location-actions">
          <button
            type="button"
            className="btn-secondary community-location-btn"
            onClick={applyCurrentLocation}
            disabled={loading || saving || locating}
          >
            {locating ? 'Getting location…' : 'Use my current location'}
          </button>
          <div className="community-toggle community-location-toggle">
            <input
              id="community-use-location-on-save"
              type="checkbox"
              checked={useLocationOnSave}
              onChange={e => {
                setUseLocationOnSave(e.target.checked)
                setSaveOk(false)
              }}
              disabled={saving || loading || locating}
            />
            <label htmlFor="community-use-location-on-save">
              <strong>Update first home area from GPS when I save</strong>
              <span className="community-toggle-help">
                Handy if you travel — refreshes your primary area each time you
                save settings.
              </span>
            </label>
          </div>
        </div>

        <div className="community-course-search">
          <label htmlFor="community-course-q">Fill city from a course (optional)</label>
          <input
            id="community-course-q"
            type="text"
            value={courseQuery}
            onChange={e => setCourseQuery(e.target.value)}
            placeholder="Search course name — e.g. Maple Hill"
            disabled={loading || saving}
          />
          {courseSearching && <p className="muted small">Searching…</p>}
          {courseHits.length > 0 && (
            <ul className="community-course-hits">
              {courseHits.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="community-course-hit"
                    onClick={() => addCityFromCourse(c)}
                  >
                    <span className="community-course-hit-name">{c.name}</span>
                    <span className="muted small">
                      {formatCityLabel({
                        city: c.locality ?? c.regionCode ?? 'Unknown area',
                        regionCode: c.locality ? c.regionCode : null,
                        countryCode: c.countryCode,
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {loading ? (
          <p className="muted">Loading your cities…</p>
        ) : (
          <div className="community-city-list">
            {cities.map((c, index) => (
              <div key={index} className="community-city-row">
                <div className="community-city-fields">
                  <label>
                    <span>City / area</span>
                    <input
                      type="text"
                      value={c.city}
                      onChange={e => updateCity(index, { city: e.target.value })}
                      placeholder="e.g. Portland"
                      required={communityVisible}
                      disabled={saving}
                    />
                  </label>
                  <label>
                    <span>State / region</span>
                    <input
                      type="text"
                      value={c.regionCode ?? ''}
                      onChange={e =>
                        updateCity(index, { regionCode: e.target.value || null })
                      }
                      placeholder="e.g. OR"
                      disabled={saving}
                    />
                  </label>
                  <label>
                    <span>Country</span>
                    <input
                      type="text"
                      value={c.countryCode ?? ''}
                      onChange={e =>
                        updateCity(index, { countryCode: e.target.value || null })
                      }
                      placeholder="e.g. US"
                      disabled={saving}
                    />
                  </label>
                </div>
                {cities.length > 1 && (
                  <button
                    type="button"
                    className="link-button community-city-remove"
                    onClick={() => removeCitySlot(index)}
                    disabled={saving}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {cities.length < MAX_HOME_CITIES && !loading && (
          <button
            type="button"
            className="btn-secondary community-add-city"
            onClick={addCitySlot}
            disabled={saving}
          >
            + Add another city ({cities.length}/{MAX_HOME_CITIES})
          </button>
        )}

        <div className="community-toggle">
          <input
            id="community-visible"
            type="checkbox"
            checked={communityVisible}
            onChange={e => {
              const on = e.target.checked
              setCommunityVisible(on)
              if (!on) setLookingForPlayers(false)
              setSaveOk(false)
            }}
            disabled={saving || loading}
          />
          <label htmlFor="community-visible">
            <strong>Show me on Community</strong>
            <span className="community-toggle-help">
              Opt-in only. Other members who share your city can see your display
              name here.
            </span>
          </label>
        </div>

        <div
          className={`community-toggle${!communityVisible ? ' community-opt-in-disabled' : ''}`}
        >
          <input
            id="community-looking"
            type="checkbox"
            checked={lookingForPlayers}
            onChange={e => {
              setLookingForPlayers(e.target.checked)
              setSaveOk(false)
            }}
            disabled={saving || loading || !communityVisible}
          />
          <label htmlFor="community-looking">
            <strong>Looking for players to play together</strong>
            <span className="community-toggle-help">
              Shows a badge on Community. Required to send messages (Pro).
            </span>
          </label>
        </div>

        {error && <div className="form-error">{error}</div>}
        {hasUnsavedChanges && (
          <div className="form-error">
            You changed settings — tap <strong>Save settings</strong> or other players
            won&apos;t see you.
          </div>
        )}
        {saveOk && <div className="form-success">Community settings saved.</div>}

        <button type="submit" className="btn-primary" disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>

      <div className="card community-status">
        <h2>Your Community status</h2>
        <ul className="community-status-list">
          <li className={me.communityVisible ? 'community-status-ok' : 'community-status-warn'}>
            {me.communityVisible ? '✓' : '○'} Show me on Community is{' '}
            <strong>{me.communityVisible ? 'on' : 'off'}</strong>
          </li>
          <li className={savedCities.length > 0 ? 'community-status-ok' : 'community-status-warn'}>
            {savedCities.length > 0 ? '✓' : '○'}{' '}
            <strong>{savedCities.length}</strong> saved home{' '}
            {savedCities.length === 1 ? 'area' : 'areas'}
          </li>
          <li className="community-status-ok">
            ✓ Search radius: <strong>{me.communitySearchRadiusMiles} mi</strong>
          </li>
          {setupStatus && (
            <>
              <li
                className={
                  setupStatus.gpsCityCount > 0 ? 'community-status-ok' : 'community-status-warn'
                }
              >
                {setupStatus.gpsCityCount > 0 ? '✓' : '○'}{' '}
                <strong>{setupStatus.gpsCityCount}</strong> saved area
                {setupStatus.gpsCityCount === 1 ? '' : 's'} with GPS map pin
              </li>
              <li className="community-status-ok">
                ✓ Other visible players in app:{' '}
                <strong>{setupStatus.otherVisibleWithCities}</strong>
              </li>
              <li
                className={
                  setupStatus.matchCount > 0 ? 'community-status-ok' : 'community-status-warn'
                }
              >
                {setupStatus.matchCount > 0 ? '✓' : '○'} Matches in your radius:{' '}
                <strong>{setupStatus.matchCount}</strong>
              </li>
            </>
          )}
        </ul>
        {savedCities.length > 0 ? (
          <p className="muted small community-status-cities">
            Saved as: {savedCities.map(c => formatCityLabel(c)).join(' · ')}
          </p>
        ) : (
          <p className="muted small">
            Add a city (GPS button above is easiest), check “Show me on Community”,
            then tap <strong>Save settings</strong>.
          </p>
        )}
        <p className="muted small community-status-tip">
          Both accounts must tap <strong>Save settings</strong> after turning Community on.
          Use <strong>Use my current location</strong> on each account, pick the same radius
          (50 mi is good for testing), then save again on both.
        </p>
      </div>

      <div className="card">
        <h2 className="section-title">Players at your courses</h2>
        {inviteOk && <div className="form-success small">{inviteOk}</div>}
        {activeRoundId && me.isPro && (
          <p className="muted small community-live-round-hint">
            You have a live scorecard — use <strong>Invite to scorecard</strong>{' '}
            to pull looking players onto your card.
          </p>
        )}
        {membersError && <div className="form-error">{membersError}</div>}
        {!isSavedVisible ? (
          <p className="muted">
            Opt in above, add a home area, and tap <strong>Save settings</strong>{' '}
            to see other members in your cities.
          </p>
        ) : members.length === 0 ? (
          <p className="muted">
            No matches yet. On your other test account: open Community, tap{' '}
            <strong>Use my current location</strong>, turn Community on, choose the same
            radius, and tap <strong>Save settings</strong>. Then save again on this account.
            {setupStatus && setupStatus.otherVisibleWithCities === 0 && (
              <>
                {' '}
                Right now no other account has Community saved with a home area.
              </>
            )}
          </p>
        ) : (
          <ul className="community-member-list">
            {members.map(m => (
              <li key={m.userId} className="community-member-card">
                <p className="community-member-name">{m.displayName}</p>
                {m.lookingForPlayers && (
                  <span className="community-badge">Looking to play</span>
                )}
                <p className="community-member-cities">
                  {m.distanceMiles != null && (
                    <span className="community-member-distance">
                      ~{m.distanceMiles} mi away ·{' '}
                    </span>
                  )}
                  Also plays in {m.sharedCityLabels.join(', ')}
                </p>
                {canMessage ? (
                  <div className="community-member-actions">
                    <button
                      type="button"
                      className="btn-primary community-action-btn"
                      onClick={() => {
                        setMessageError(null)
                        setMessageTarget(m)
                      }}
                    >
                      Message {m.displayName.split(' ')[0]}
                    </button>
                    {activeRoundId && me.isPro && (
                      <button
                        type="button"
                        className="btn-secondary community-action-btn"
                        disabled={inviteBusyId === m.userId}
                        onClick={() => handleInviteToScorecard(m)}
                      >
                        {inviteBusyId === m.userId
                          ? 'Inviting…'
                          : 'Invite to scorecard'}
                      </button>
                    )}
                  </div>
                ) : !me.isPro ? (
                  <ProGate feature="Community messaging" />
                ) : (
                  <p className="community-member-hint">
                    {needsLookingSave
                      ? 'Turn on “Looking for players” and tap Save settings to send messages.'
                      : 'Turn on “Looking for players” above to send messages.'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {messageTarget && (
        <CommunityMessageModal
          member={messageTarget}
          sending={messageSending}
          error={messageError}
          onClose={() => {
            if (!messageSending) setMessageTarget(null)
          }}
          onSend={handleSendMessage}
        />
      )}
    </div>
  )
}
