import { useEffect, useMemo, useRef, useState } from 'react'
import { Disc, DiscType } from '../types'
import {
  DISC_DATABASE,
  DISC_BY_NAME,
  DuplicateDiscError,
  createDisc,
  NewDiscInput,
} from '../lib/discs'

interface Props {
  value: string
  onChange: (discName: string) => void
}

const DISC_TYPES: DiscType[] = ['Putter', 'Midrange', 'Fairway', 'Distance']

interface DraftForm {
  model: string
  brand: string
  type: DiscType
  speed: string
  glide: string
  turn: string
  fade: string
  weight: string
}

function emptyDraft(prefillModel = ''): DraftForm {
  return {
    model: prefillModel,
    brand: '',
    type: 'Fairway',
    speed: '',
    glide: '',
    turn: '',
    fade: '',
    weight: '',
  }
}

interface DraftErrors {
  model?: string
  brand?: string
  speed?: string
  glide?: string
  turn?: string
  fade?: string
  weight?: string
}

function parseNumber(raw: string): number | null {
  const v = Number(raw)
  return Number.isFinite(v) ? v : null
}

function validate(draft: DraftForm): { ok: true; payload: NewDiscInput } | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {}
  if (!draft.model.trim()) errors.model = 'Required'
  if (!draft.brand.trim()) errors.brand = 'Required'
  if (!draft.weight.trim()) errors.weight = 'Required'

  const speed = parseNumber(draft.speed)
  const glide = parseNumber(draft.glide)
  const turn = parseNumber(draft.turn)
  const fade = parseNumber(draft.fade)
  if (speed === null) errors.speed = 'Number required'
  else if (speed < 1 || speed > 15) errors.speed = '1–15'
  if (glide === null) errors.glide = 'Number required'
  else if (glide < 1 || glide > 7) errors.glide = '1–7'
  if (turn === null) errors.turn = 'Number required'
  else if (turn < -5 || turn > 1) errors.turn = '−5 to 1'
  if (fade === null) errors.fade = 'Number required'
  else if (fade < 0 || fade > 5) errors.fade = '0–5'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    payload: {
      model: draft.model.trim(),
      brand: draft.brand.trim(),
      type: draft.type,
      speed: speed as number,
      glide: glide as number,
      turn: turn as number,
      fade: fade as number,
      weight: draft.weight.trim(),
    },
  }
}

/**
 * Searchable disc picker. Replaces a giant native <select> with a
 * filterable combobox so the user can type "destroyer" or "innova" and
 * narrow ~2,250 molds quickly. Also exposes an inline "Add custom disc"
 * form that inserts new molds into the shared catalog.
 */
export function DiscSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [draft, setDraft] = useState<DraftForm | null>(null)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected: Disc | undefined = value ? DISC_BY_NAME[value] : undefined

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return DISC_DATABASE
    return DISC_DATABASE.filter(d => {
      const name = d.name.toLowerCase()
      const brand = d.brand.toLowerCase()
      const type = d.type ? d.type.toLowerCase() : ''
      return q
        .split(/\s+/)
        .every(tok => name.includes(tok) || brand.includes(tok) || type.includes(tok))
    })
  }, [query])

  useEffect(() => {
    if (!open) return
    setActiveIdx(0)
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) closeAll()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLLIElement>(
      `li[data-idx="${activeIdx}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, open])

  function closeAll() {
    setOpen(false)
    setQuery('')
    setDraft(null)
    setErrors({})
    setSubmitError(null)
  }

  function commit(disc: Disc) {
    onChange(disc.name)
    closeAll()
  }

  function startCreate() {
    setDraft(emptyDraft(query.trim()))
    setErrors({})
    setSubmitError(null)
  }

  async function submitCreate() {
    if (!draft) return
    const result = validate(draft)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setSubmitError(null)
    setSubmitting(true)
    try {
      const created = await createDisc(result.payload)
      commit(created)
    } catch (err) {
      if (err instanceof DuplicateDiscError) {
        setSubmitError(err.message)
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Failed to add disc.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = filtered[activeIdx]
      if (pick) commit(pick)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeAll()
    }
  }

  return (
    <div className="disc-select" ref={containerRef}>
      <button
        type="button"
        className="disc-select-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className="disc-select-value">
            <span className="disc-select-name">{selected.name}</span>
            <span className="disc-select-meta">
              {selected.brand} · {selected.speed}/{selected.glide}/
              {selected.turn}/{selected.fade}
            </span>
          </span>
        ) : (
          <span className="disc-select-placeholder">— pick a disc —</span>
        )}
        <span className="disc-select-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="disc-select-pop">
          {draft ? (
            <DraftFormView
              draft={draft}
              errors={errors}
              submitting={submitting}
              submitError={submitError}
              onChange={setDraft}
              onCancel={() => {
                setDraft(null)
                setErrors({})
                setSubmitError(null)
              }}
              onSubmit={submitCreate}
            />
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onListKeyDown}
                placeholder="Search by name, brand, or type…"
                className="disc-select-search"
                autoFocus
              />
              <ul
                ref={listRef}
                className="disc-select-list"
                role="listbox"
                aria-label="Discs"
              >
                {filtered.length === 0 && (
                  <li className="disc-select-empty">
                    No matches for “{query}”.
                  </li>
                )}
                {filtered.map((d, i) => {
                  const isActive = i === activeIdx
                  const isSelected = d.name === value
                  return (
                    <li
                      key={d.name}
                      data-idx={i}
                      role="option"
                      aria-selected={isSelected}
                      className={
                        'disc-select-option' +
                        (isActive ? ' active' : '') +
                        (isSelected ? ' selected' : '')
                      }
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => commit(d)}
                    >
                      <div className="disc-select-option-main">
                        <span className="disc-select-name">{d.name}</span>
                        <span className="disc-select-brand">
                          {d.brand}
                          {d.type ? ` · ${d.type}` : ''}
                        </span>
                      </div>
                      <span className="disc-select-flight">
                        {d.speed}/{d.glide}/{d.turn}/{d.fade}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                className="disc-select-add"
                onClick={startCreate}
              >
                + Add custom disc
                {query.trim() && (
                  <span className="muted small"> · “{query.trim()}”</span>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface DraftFormProps {
  draft: DraftForm
  errors: DraftErrors
  submitting: boolean
  submitError: string | null
  onChange: (next: DraftForm) => void
  onCancel: () => void
  onSubmit: () => void
}

function DraftFormView({
  draft,
  errors,
  submitting,
  submitError,
  onChange,
  onCancel,
  onSubmit,
}: DraftFormProps) {
  function update<K extends keyof DraftForm>(key: K, val: DraftForm[K]) {
    onChange({ ...draft, [key]: val })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <form
      className="disc-form"
      onSubmit={e => {
        e.preventDefault()
        onSubmit()
      }}
      onKeyDown={onKeyDown}
    >
      <div className="disc-form-header">
        <span>Add custom disc</span>
        <button
          type="button"
          className="link-button"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>

      <div className="disc-form-grid">
        <label className="disc-form-field">
          <span>Model name</span>
          <input
            type="text"
            value={draft.model}
            onChange={e => update('model', e.target.value)}
            placeholder="e.g. Destroyer"
            autoFocus
            disabled={submitting}
          />
          {errors.model && <span className="disc-form-error">{errors.model}</span>}
        </label>
        <label className="disc-form-field">
          <span>Brand</span>
          <input
            type="text"
            value={draft.brand}
            onChange={e => update('brand', e.target.value)}
            placeholder="e.g. Innova"
            disabled={submitting}
          />
          {errors.brand && <span className="disc-form-error">{errors.brand}</span>}
        </label>
        <label className="disc-form-field full">
          <span>Type</span>
          <select
            value={draft.type}
            onChange={e => update('type', e.target.value as DiscType)}
            disabled={submitting}
          >
            {DISC_TYPES.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="disc-form-field">
          <span>Speed (1–15)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={draft.speed}
            onChange={e => update('speed', e.target.value)}
            disabled={submitting}
          />
          {errors.speed && <span className="disc-form-error">{errors.speed}</span>}
        </label>
        <label className="disc-form-field">
          <span>Glide (1–7)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={draft.glide}
            onChange={e => update('glide', e.target.value)}
            disabled={submitting}
          />
          {errors.glide && <span className="disc-form-error">{errors.glide}</span>}
        </label>
        <label className="disc-form-field">
          <span>Turn (−5 to 1)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={draft.turn}
            onChange={e => update('turn', e.target.value)}
            disabled={submitting}
          />
          {errors.turn && <span className="disc-form-error">{errors.turn}</span>}
        </label>
        <label className="disc-form-field">
          <span>Fade (0–5)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={draft.fade}
            onChange={e => update('fade', e.target.value)}
            disabled={submitting}
          />
          {errors.fade && <span className="disc-form-error">{errors.fade}</span>}
        </label>
        <label className="disc-form-field full">
          <span>Weight range (e.g. 150–176)</span>
          <input
            type="text"
            value={draft.weight}
            onChange={e => update('weight', e.target.value)}
            placeholder="150-176"
            disabled={submitting}
          />
          {errors.weight && <span className="disc-form-error">{errors.weight}</span>}
        </label>
      </div>

      {submitError && <div className="form-error">{submitError}</div>}

      <div className="disc-form-actions">
        <button
          type="submit"
          className="btn-secondary"
          disabled={submitting}
        >
          {submitting ? 'Adding…' : 'Add disc'}
        </button>
      </div>
    </form>
  )
}
