import {
  HoleDirection,
  MandoRoute,
  TreeCoverage,
  TreeLayout,
} from '../types'

export const DIRECTION_OPTIONS: { value: HoleDirection; label: string }[] = [
  { value: 'hard_left', label: 'Hard left' },
  { value: 'dogleg_left', label: 'Dogleg left' },
  { value: 'straight', label: 'Straight' },
  { value: 'dogleg_right', label: 'Dogleg right' },
  { value: 'hard_right', label: 'Hard right' },
]

export const TREE_COVERAGE_OPTIONS: { value: TreeCoverage; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'light', label: 'Light' },
  { value: 'wooded', label: 'Wooded' },
  { value: 'heavily_wooded', label: 'Heavy' },
]

export const TREE_LAYOUT_OPTIONS: { value: TreeLayout; label: string }[] = [
  { value: 'throughout', label: 'Throughout' },
  { value: 'front_half', label: 'Front half' },
  { value: 'back_half', label: 'Back half' },
  { value: 'left', label: 'Left side' },
  { value: 'right', label: 'Right side' },
  { value: 'canopy', label: 'Low canopy' },
]

export const MANDO_OPTIONS: { value: MandoRoute; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'left', label: 'Mando left' },
  { value: 'right', label: 'Mando right' },
  { value: 'double', label: 'Double mando' },
  { value: 'triple', label: 'Triple mando' },
]

export function nextTreeLayoutForCoverage(
  coverage: TreeCoverage,
  current: TreeLayout,
): TreeLayout {
  if (coverage === 'open') return 'none'
  if (current === 'none') return 'throughout'
  return current
}
