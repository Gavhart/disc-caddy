import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { NearbyCourse } from '../types'

interface Props {
  courses: NearbyCourse[]
  selectedId: string | null
  onSelect: (courseId: string) => void
}

/** Simple lat/lon bounds for fitting the map. */
function boundsForCourses(courses: NearbyCourse[]): L.LatLngBoundsExpression | null {
  const pts = courses.filter(c => c.lat != null && c.lon != null) as {
    lat: number
    lon: number
  }[]
  if (pts.length === 0) return null
  if (pts.length === 1) {
    const p = pts[0]
    return [
      [p.lat - 0.08, p.lon - 0.08],
      [p.lat + 0.08, p.lon + 0.08],
    ]
  }
  return L.latLngBounds(pts.map(p => [p.lat, p.lon]))
}

export function CourseDiscoveryMap({ courses, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)

  const mappable = useMemo(
    () => courses.filter(c => c.lat != null && c.lon != null),
    [courses],
  )

  useEffect(() => {
    if (!containerRef.current || mappable.length === 0) return

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        scrollWheelZoom: false,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(mapRef.current)
      markersRef.current = L.layerGroup().addTo(mapRef.current)
    }

    const map = mapRef.current
    const markers = markersRef.current!
    markers.clearLayers()

    for (const c of mappable) {
      const marker = L.circleMarker([c.lat!, c.lon!], {
        radius: selectedId === c.id ? 10 : 7,
        color: selectedId === c.id ? '#7ddf64' : '#ffffff',
        weight: 2,
        fillColor: selectedId === c.id ? '#7ddf64' : '#3d8b40',
        fillOpacity: 0.9,
      })
      marker.bindTooltip(c.name, { direction: 'top', offset: [0, -8] })
      marker.on('click', () => onSelect(c.id))
      markers.addLayer(marker)
    }

    const bounds = boundsForCourses(mappable)
    if (bounds) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 })
    }

    return () => {
      // Keep map instance for re-renders
    }
  }, [mappable, selectedId, onSelect])

  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current = null
    }
  }, [])

  if (mappable.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="course-discovery-map"
      aria-label="Map of nearby disc golf courses"
    />
  )
}
