import {
  HoleDirection,
  MandoRoute,
  TreeCoverage,
  TreeLayout,
} from '../types'
import {
  DIRECTION_OPTIONS,
  MANDO_OPTIONS,
  nextTreeLayoutForCoverage,
  TREE_COVERAGE_OPTIONS,
  TREE_LAYOUT_OPTIONS,
} from '../lib/holeLayoutOptions'

export interface LieLayoutValue {
  direction: HoleDirection
  treeCoverage: TreeCoverage
  treeLayout: TreeLayout
  mando: MandoRoute
}

function ChipGroup<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string
  hint?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="chip-group">
      <span className="chip-group-label">{label}</span>
      {hint && <p className="muted small lie-layout-hint">{hint}</p>}
      <div className="chip-row">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            className={`chip ${value === o.value ? 'chip-on' : ''}`}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function LieLayoutInput({
  value,
  onChange,
  showDirection = true,
  compact = false,
}: {
  value: LieLayoutValue
  onChange: (patch: Partial<LieLayoutValue>) => void
  showDirection?: boolean
  compact?: boolean
}) {
  const showTreeLayout = value.treeCoverage !== 'open'

  function setTreeCoverage(coverage: TreeCoverage) {
    onChange({
      treeCoverage: coverage,
      treeLayout: nextTreeLayoutForCoverage(coverage, value.treeLayout),
    })
  }

  return (
    <div className={'lie-layout-input' + (compact ? ' lie-layout-input-compact' : '')}>
      {showDirection && (
        <ChipGroup
          label="Line shape"
          hint="Which way the fairway bends from your lie toward the basket."
          value={value.direction}
          options={DIRECTION_OPTIONS}
          onChange={direction => onChange({ direction })}
        />
      )}

      <ChipGroup
        label="Trees"
        hint="How tight the corridor is from where you stand."
        value={value.treeCoverage}
        options={TREE_COVERAGE_OPTIONS}
        onChange={setTreeCoverage}
      />

      {showTreeLayout && (
        <ChipGroup
          label="Where trees are"
          value={value.treeLayout}
          options={TREE_LAYOUT_OPTIONS}
          onChange={treeLayout => onChange({ treeLayout })}
        />
      )}

      <ChipGroup
        label="Mando"
        hint="Mandatory route — picks favor discs that hold the required side."
        value={value.mando}
        options={MANDO_OPTIONS}
        onChange={mando => onChange({ mando })}
      />
    </div>
  )
}
