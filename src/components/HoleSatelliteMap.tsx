import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const ESRI_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'

const DEFAULT_ZOOM = 18
const MAX_ZOOM = 21
const MIN_ZOOM = 14

const FALLBACK_CENTER: [number, number] = [39.8283, -98.5795] // Geographic center of the contiguous US

interface Coords {
  lat: number
  lng: number
}

type Step = 'tee' | 'basket'

interface Props {
  /** Existing tee/basket coords if mapped, null otherwise. */
  teeLat: number | null
  teeLng: number | null
  basketLat: number | null
  basketLng: number | null
  /** Stored hole distance (ft). Used for the readout when coords are missing. */
  holeDistance: number
  /** Course-level coords to center the map on when the hole isn't mapped yet. */
  courseLat?: number | null
  courseLng?: number | null
  /**
   * Provided → edit button shown. Called when the user confirms a new pair of
   * coordinates. Should persist to the backend.
   */
  onSave?: (next: {
    teeLat: number
    teeLng: number
    basketLat: number
    basketLng: number
  }) => Promise<void>
}

// ---------- Haversine: tee→basket distance in feet ----------
function haversineFt(a: Coords, b: Coords): number {
  const R = 6371000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sa = Math.sin(dLat / 2) ** 2
  const sb =
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  const meters = R * 2 * Math.atan2(Math.sqrt(sa + sb), Math.sqrt(1 - (sa + sb)))
  return meters * 3.28084
}

// ---------- Marker icons via L.divIcon ----------
function teeIcon(): L.DivIcon {
  return L.divIcon({
    className: 'hole-sat-marker hole-sat-marker-tee',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div class="hole-sat-marker-inner hole-sat-marker-inner-tee" title="Tee pad">T</div>`,
  })
}

function basketIcon(): L.DivIcon {
  return L.divIcon({
    className: 'hole-sat-marker hole-sat-marker-basket',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div class="hole-sat-marker-inner hole-sat-marker-inner-basket" title="Basket">●</div>`,
  })
}

export function HoleSatelliteMap({
  teeLat,
  teeLng,
  basketLat,
  basketLng,
  holeDistance,
  courseLat,
  courseLng,
  onSave,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const teeMarkerRef = useRef<L.Marker | null>(null)
  const basketMarkerRef = useRef<L.Marker | null>(null)
  const lineRef = useRef<L.Polyline | null>(null)

  // Saved coords (from props) — what we show in view mode.
  const savedTee: Coords | null =
    teeLat != null && teeLng != null ? { lat: teeLat, lng: teeLng } : null
  const savedBasket: Coords | null =
    basketLat != null && basketLng != null
      ? { lat: basketLat, lng: basketLng }
      : null
  const hasSavedCoords = savedTee !== null && savedBasket !== null

  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [draftTee, setDraftTee] = useState<Coords | null>(savedTee)
  const [draftBasket, setDraftBasket] = useState<Coords | null>(savedBasket)
  const [step, setStep] = useState<Step>(savedTee ? 'basket' : 'tee')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentTee = mode === 'edit' ? draftTee : savedTee
  const currentBasket = mode === 'edit' ? draftBasket : savedBasket
  const distanceFt = useMemo(() => {
    if (!currentTee || !currentBasket) return null
    return Math.round(haversineFt(currentTee, currentBasket))
  }, [currentTee, currentBasket])

  // ---------- Map init + view-mode rendering ----------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const initialCenter: [number, number] = savedTee
      ? [savedTee.lat, savedTee.lng]
      : courseLat != null && courseLng != null
        ? [courseLat, courseLng]
        : FALLBACK_CENTER

    mapRef.current = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView(initialCenter, savedTee ? DEFAULT_ZOOM : 15)

    L.tileLayer(ESRI_TILE_URL, {
      attribution: ESRI_ATTRIBUTION,
      maxZoom: MAX_ZOOM,
      minZoom: MIN_ZOOM,
    }).addTo(mapRef.current)
    // Disable scroll-wheel by default to avoid hijacking page scroll inside cards
    mapRef.current.scrollWheelZoom.disable()
  }, [savedTee, courseLat, courseLng])

  // Tear down on unmount
  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      teeMarkerRef.current = null
      basketMarkerRef.current = null
      lineRef.current = null
    }
  }, [])

  // ---------- Sync markers + line whenever coords change ----------
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (currentTee) {
      if (!teeMarkerRef.current) {
        teeMarkerRef.current = L.marker([currentTee.lat, currentTee.lng], {
          icon: teeIcon(),
          interactive: false,
        }).addTo(map)
      } else {
        teeMarkerRef.current.setLatLng([currentTee.lat, currentTee.lng])
      }
    } else if (teeMarkerRef.current) {
      teeMarkerRef.current.remove()
      teeMarkerRef.current = null
    }

    if (currentBasket) {
      if (!basketMarkerRef.current) {
        basketMarkerRef.current = L.marker(
          [currentBasket.lat, currentBasket.lng],
          { icon: basketIcon(), interactive: false },
        ).addTo(map)
      } else {
        basketMarkerRef.current.setLatLng([currentBasket.lat, currentBasket.lng])
      }
    } else if (basketMarkerRef.current) {
      basketMarkerRef.current.remove()
      basketMarkerRef.current = null
    }

    if (currentTee && currentBasket) {
      const path: L.LatLngExpression[] = [
        [currentTee.lat, currentTee.lng],
        [currentBasket.lat, currentBasket.lng],
      ]
      if (!lineRef.current) {
        lineRef.current = L.polyline(path, {
          color: '#f6c945',
          weight: 3,
          dashArray: '6 6',
          interactive: false,
        }).addTo(map)
      } else {
        lineRef.current.setLatLngs(path)
      }
    } else if (lineRef.current) {
      lineRef.current.remove()
      lineRef.current = null
    }
  }, [currentTee, currentBasket])

  // Re-fit when entering view mode with both saved coords
  useEffect(() => {
    if (mode !== 'view' || !mapRef.current || !savedTee || !savedBasket) return
    const bounds = L.latLngBounds(
      [savedTee.lat, savedTee.lng],
      [savedBasket.lat, savedBasket.lng],
    )
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: MAX_ZOOM })
  }, [mode, savedTee?.lat, savedTee?.lng, savedBasket?.lat, savedBasket?.lng])

  // ---------- Edit-mode click handling ----------
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (mode !== 'edit') return

    function handleClick(e: L.LeafletMouseEvent) {
      const coords: Coords = { lat: e.latlng.lat, lng: e.latlng.lng }
      if (step === 'tee') {
        setDraftTee(coords)
        setStep('basket')
      } else {
        setDraftBasket(coords)
      }
    }

    map.on('click', handleClick)
    return () => {
      map.off('click', handleClick)
    }
  }, [mode, step])

  // ---------- Actions ----------
  function startEdit() {
    setDraftTee(savedTee)
    setDraftBasket(savedBasket)
    setStep(savedTee ? 'basket' : 'tee')
    setError(null)
    setMode('edit')
  }

  function cancelEdit() {
    setDraftTee(savedTee)
    setDraftBasket(savedBasket)
    setStep(savedTee ? 'basket' : 'tee')
    setError(null)
    setMode('view')
  }

  function resetDrafts() {
    setDraftTee(null)
    setDraftBasket(null)
    setStep('tee')
  }

  function useGpsForTee() {
    if (!('geolocation' in navigator)) {
      setError('Location is not available on this device.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setDraftTee(coords)
        setStep('basket')
        mapRef.current?.setView([coords.lat, coords.lng], DEFAULT_ZOOM)
      },
      err => setError(err.message || 'Could not get your location.'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    )
  }

  async function handleSave() {
    if (!draftTee || !draftBasket || !onSave) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        teeLat: draftTee.lat,
        teeLng: draftTee.lng,
        basketLat: draftBasket.lat,
        basketLng: draftBasket.lng,
      })
      setMode('view')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  // ---------- Render ----------
  return (
    <div className="hole-sat-wrap">
      <div className="hole-sat-head">
        <div>
          <strong>Hole map</strong>
          <span className="muted small hole-sat-distance">
            {distanceFt != null
              ? `${distanceFt.toLocaleString()} ft tee → basket`
              : `${holeDistance.toLocaleString()} ft (not mapped)`}
          </span>
        </div>
        {onSave && mode === 'view' && (
          <button
            type="button"
            className="btn-secondary hole-sat-edit-btn"
            onClick={startEdit}
          >
            {hasSavedCoords ? 'Edit position' : 'Map this hole'}
          </button>
        )}
      </div>

      <div className="hole-sat-stage">
        <div
          ref={containerRef}
          className="hole-sat-map"
          aria-label="Satellite hole map"
        />
        {!hasSavedCoords && mode === 'view' && (
          <div className="hole-sat-empty-overlay">
            <p>This hole isn't mapped yet.</p>
            {onSave && (
              <button
                type="button"
                className="btn-primary"
                onClick={startEdit}
              >
                Map the tee &amp; basket
              </button>
            )}
          </div>
        )}
      </div>

      {mode === 'edit' && (
        <div className="hole-sat-edit-panel card">
          <div className="hole-sat-step-hint">
            {step === 'tee' ? (
              <>
                <strong>Step 1 of 2</strong> — Tap the map on the tee pad. Or
                <button
                  type="button"
                  className="link-button"
                  onClick={useGpsForTee}
                  disabled={saving}
                >
                  use my current location
                </button>
                .
              </>
            ) : (
              <>
                <strong>Step 2 of 2</strong> — Tap the map on the basket.
              </>
            )}
          </div>

          <div className="hole-sat-edit-readout">
            <span>
              Tee:{' '}
              {draftTee
                ? `${draftTee.lat.toFixed(5)}, ${draftTee.lng.toFixed(5)}`
                : 'not placed'}
            </span>
            <span>
              Basket:{' '}
              {draftBasket
                ? `${draftBasket.lat.toFixed(5)}, ${draftBasket.lng.toFixed(5)}`
                : 'not placed'}
            </span>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="hole-sat-edit-actions">
            <button
              type="button"
              className="link-button"
              onClick={resetDrafts}
              disabled={saving || (!draftTee && !draftBasket)}
            >
              Start over
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={!draftTee || !draftBasket || saving}
            >
              {saving ? 'Saving…' : 'Save position'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
