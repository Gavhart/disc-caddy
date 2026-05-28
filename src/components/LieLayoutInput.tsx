import {
  ActiveMandoRoute,
  ActiveTreeLayout,
  HoleDirection,
  TreeCoverage,
} from '../types'
import {
  countInMulti,
  DIRECTION_OPTIONS,
  formatMultiChipLabel,
  MANDO_MULTI_OPTIONS,
  toggleMulti,
  treeLayoutsForCoverage,
  TREE_LAYOUT_OPTIONS,
} from '../lib/holeLayoutOptions'

export interface LieLayoutValue {
  direction: HoleDirection
  treeCoverage: TreeCoverage
  treeLayouts: ActiveTreeLayout[]
  mandos: ActiveMandoRoute[]
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

function MultiChipGroup<T extends string>({
  label,
  hint,
  values,
  options,
  onChange,
  onClear,
}: {
  label: string
  hint?: string
  values: T[]
  options: { value: T; label: string }[]
  onChange: (values: T[]) => void
  onClear?: () => void
}) {
  return (
    <div className="chip-group">
      <div className="chip-group-label-row">
        <span className="chip-group-label">{label}</span>
        {values.length > 0 && onClear && (
          <button type="button" className="link-button small" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {hint && <p className="muted small lie-layout-hint">{hint}</p>}
      <div className="chip-row">
        {options.map(o => {
          const count = countInMulti(values, o.value)
          return (
            <button
              key={o.value}
              type="button"
              className={`chip ${count > 0 ? 'chip-on' : ''}`}
              aria-pressed={count > 0}
              onClick={() => onChange(toggleMulti(values, o.value))}
            >
              {formatMultiChipLabel(o.label, count)}
            </button>
          )
        })}
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
      treeLayouts: treeLayoutsForCoverage(coverage, value.treeLayouts),
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
        options={[
          { value: 'open', label: 'Open' },
          { value: 'light', label: 'Light' },
          { value: 'wooded', label: 'Wooded' },
          { value: 'heavily_wooded', label: 'Heavy' },
        ]}
        onChange={setTreeCoverage}
      />

      {showTreeLayout && (
        <MultiChipGroup
          label="Obstacles / tree zones"
          hint="Tap each zone that applies. Tap again to remove one — tap twice on Left for trees on both sides of a corridor, etc."
          values={value.treeLayouts}
          options={TREE_LAYOUT_OPTIONS}
          onChange={treeLayouts => onChange({ treeLayouts })}
          onClear={() => onChange({ treeLayouts: [] })}
        />
      )}

      <MultiChipGroup
        label="Mandos"
        hint="Tap each mandatory route. Tap the same mando again for a second marker on the hole."
        values={value.mandos}
        options={MANDO_MULTI_OPTIONS}
        onChange={mandos => onChange({ mandos })}
        onClear={() => onChange({ mandos: [] })}
      />
    </div>
  )
}
