import { CourseHole } from '../types'

const HOLES_CACHE_KEY = 'disc-caddy:offline-holes'
const SCORE_QUEUE_KEY = 'disc-caddy:offline-scores'

interface CachedCourseHoles {
  courseId: string
  holes: CourseHole[]
  cachedAt: string
}

interface QueuedScore {
  roundId: string
  roundPlayerId: string
  holeNumber: number
  strokes: number
  putts: number | null
  par: number | null
  queuedAt: string
}

export function cacheCourseHoles(courseId: string, holes: CourseHole[]): void {
  try {
    const payload: CachedCourseHoles = {
      courseId,
      holes,
      cachedAt: new Date().toISOString(),
    }
    localStorage.setItem(`${HOLES_CACHE_KEY}:${courseId}`, JSON.stringify(payload))
  } catch {
    // ignore quota errors
  }
}

export function loadCachedCourseHoles(courseId: string): CourseHole[] | null {
  try {
    const raw = localStorage.getItem(`${HOLES_CACHE_KEY}:${courseId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedCourseHoles
    return parsed.holes ?? null
  } catch {
    return null
  }
}

export function queueOfflineScore(score: Omit<QueuedScore, 'queuedAt'>): void {
  try {
    const list = loadScoreQueue()
    list.push({ ...score, queuedAt: new Date().toISOString() })
    localStorage.setItem(SCORE_QUEUE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function loadScoreQueue(): QueuedScore[] {
  try {
    const raw = localStorage.getItem(SCORE_QUEUE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as QueuedScore[]
  } catch {
    return []
  }
}

export function clearScoreQueue(): void {
  try {
    localStorage.removeItem(SCORE_QUEUE_KEY)
  } catch {
    // ignore
  }
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export async function syncOfflineScoreQueue(
  upsert: (score: QueuedScore) => Promise<void>,
): Promise<number> {
  if (!isOnline()) return 0
  const queue = loadScoreQueue()
  if (queue.length === 0) return 0

  let synced = 0
  const remaining: QueuedScore[] = []
  for (const item of queue) {
    try {
      await upsert(item)
      synced++
    } catch {
      remaining.push(item)
    }
  }
  localStorage.setItem(SCORE_QUEUE_KEY, JSON.stringify(remaining))
  return synced
}
