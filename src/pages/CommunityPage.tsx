import { FormEvent, useCallback, useEffect, useState } from 'react'
import { CommunityMessageModal } from '../components/CommunityMessageModal'
import { useAuth } from '../contexts/AuthContext'
import { searchCoursesByName } from '../lib/courses'
import {
  fetchCommunityMembers,
  fetchCommunityMessages,
  fetchMyHomeCities,
  formatCityLabel,
  homeCityFromCourse,
  markCommunityMessageRead,
  saveHomeCities,
  sendCommunityMessage,
} from '../lib/community'
import { LocationError, resolveCurrentLocationPlace } from '../lib/geocode'
import { CommunityMember, CommunityMessage, Course, HomeCity, COMMUNITY_RADIUS_OPTIONS } from '../types'

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

function formatMessageWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function CommunityPage() {
  const { me, refreshMe } = useAuth()
  const [cities, setCities] = useState<HomeCity[]>([])
  const [savedCities, setSavedCities] = useState<HomeCity[]>([])
  const [communityVisible, setCommunityVisible] = useState(false)
  const [lookingForPlayers, setLookingForPlayers] = useState(false)
  const [useLocationOnSave, setUseLocationOnSave] = useState(false)
  const [searchRadiusMiles, setSearchRadiusMiles] = useState(25)
  const [locating, setLocating] = useState(false)
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [messages, setMessages] = useState<CommunityMessage[]>([])
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

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [loadedCities, loadedMembers, loadedMessages] = await Promise.all([
        fetchMyHomeCities(),
        fetchCommunityMembers(),
        fetchCommunityMessages(),
      ])
      setCities(loadedCities.length > 0 ? loadedCities : [emptyCity(0)])
      setSavedCities(loadedCities)
      setMembers(loadedMembers)
      setMessages(loadedMessages)
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
      setCities(cleaned.length > 0 ? cleaned : [emptyCity(0)])
      setSavedCities(cleaned)
      if (!communityVisible) setLookingForPlayers(false)
      setSaveOk(true)

      if (communityVisible && cleaned.length > 0) {
        const [loadedMembers, loadedMessages] = await Promise.all([
          fetchCommunityMembers(),
          fetchCommunityMessages(),
        ])
        setMembers(loadedMembers)
        setMessages(loadedMessages)
      } else {
        setMembers([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleSendMessage(body: string) {
    if (!messageTarget) return
    setMessageSending(true)
    setMessageError(null)
    try {
      await sendCommunityMessage(messageTarget.userId, body)
      setMessageTarget(null)
      const loadedMessages = await fetchCommunityMessages()
      setMessages(loadedMessages)
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : 'Could not send message')
    } finally {
      setMessageSending(false)
    }
  }

  async function handleMarkRead(msg: CommunityMessage) {
    if (!msg.isInbound || msg.readAt) return
    try {
      await markCommunityMessageRead(msg.id)
      setMessages(prev =>
        prev.map(m => (m.id === msg.id ? { ...m, readAt: new Date().toISOString() } : m)),
      )
    } catch {
      // non-fatal
    }
  }

  const canMessage = communityVisible && lookingForPlayers

  if (!me) {
    return (
      <div className="container community-page">
        <div className="card">
          <p className="muted">Loading…</p>
        </div>
      </div>
    )
  }

  const isSavedVisible = me.communityVisible && savedCities.length > 0

  return (
    <div className="container community-page">
      <div className="card community-callout">
        <h2>Find players near you</h2>
        <p>
          Set home-area cities, opt in to Community, and mark yourself as
          looking for players to message local card-mates (display name only —
          no email).
        </p>
      </div>

      <form className="card" onSubmit={handleSave}>
        <h2>Your home areas</h2>
        <p className="muted small">
          Set a search radius, then add home areas (GPS is best). Players appear
          when they are within your radius and you are within theirs.
        </p>

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
              Shows a badge on Community. Required to send messages.
            </span>
          </label>
        </div>

        {error && <div className="form-error">{error}</div>}
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
          Both accounts need Community on, saved home areas, and to fall within
          each other&apos;s search radius (or share the same city). Use GPS on
          both accounts for the most reliable match.
        </p>
      </div>

      <div className="card">
        <h2>Players at your courses</h2>
        {!isSavedVisible ? (
          <p className="muted">
            Opt in above, add a home area, and tap <strong>Save settings</strong>{' '}
            to see other members in your cities.
          </p>
        ) : members.length === 0 ? (
          <p className="muted">
            No other opt-in members in your cities yet — check back as more
            players join.
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
                ) : (
                  <p className="community-member-hint">
                    Turn on “Looking for players” above to send messages.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Your messages</h2>
        {messages.length === 0 ? (
          <p className="muted">No messages yet.</p>
        ) : (
          <ul className="community-message-list">
            {messages.map(msg => (
              <li
                key={msg.id}
                className={
                  'community-message-card' +
                  (msg.isInbound && !msg.readAt ? ' community-message-unread' : '')
                }
                onClick={() => handleMarkRead(msg)}
              >
                <p className="community-message-direction">
                  {msg.isInbound
                    ? `From ${msg.senderName}`
                    : `To ${msg.recipientName}`}
                </p>
                <p className="community-message-time">{formatMessageWhen(msg.createdAt)}</p>
                <p className="community-message-body">{msg.body}</p>
                {msg.isInbound && !msg.readAt && (
                  <span className="community-message-new">New</span>
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
