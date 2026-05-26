import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Disc, DiscType } from '../types'
import {
  DISC_DATABASE,
  DISC_BY_NAME,
  DuplicateDiscError,
  createDisc,
  NewDiscInput,
  refreshDiscsFromSupabase,
  subscribeDiscCatalog,
  getDiscCatalogVersion,
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

const POP_MARGIN = 12
const POP_GAP = 6

function measurePopoverStyle(trigger: HTMLElement): CSSProperties {
  const rect = trigger.getBoundingClientRect()
  const vv = window.visualViewport
  const viewportTop = vv?.offsetTop ?? 0
  const viewportHeight = vv?.height ?? window.innerHeight
  const viewportBottom = viewportTop + viewportHeight
  const viewportWidth = vv?.width ?? window.innerWidth

  const spaceBelow = viewportBottom - rect.bottom - POP_MARGIN
  const spaceAbove = rect.top - viewportTop - POP_MARGIN
  const openBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove

  const maxHeight = Math.max(
    160,
    Math.min(openBelow ? spaceBelow - POP_GAP : spaceAbove - POP_GAP, 420),
  )

  const width = Math.min(rect.width, viewportWidth - POP_MARGIN * 2)
  let left = rect.left
  if (left + width > viewportWidth - POP_MARGIN) {
    left = viewportWidth - POP_MARGIN - width
  }
  left = Math.max(POP_MARGIN, left)

  const style: CSSProperties = {
    position: 'fixed',
    left,
    width,
    maxHeight,
    zIndex: 1000,
  }

  if (openBelow) {
    style.top = rect.bottom + POP_GAP
  } else {
    style.bottom = viewportBottom - rect.top + POP_GAP
  }

  return style
}
export function DiscSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [catalogVersion, setCatalogVersion] = useState(0)
  const [draft, setDraft] = useState<DraftForm | null>(null)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [popStyle, setPopStyle] = useState<CSSProperties>({})

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected: Disc | undefined = value ? DISC_BY_NAME[value] : undefined
  const searching = query.trim().length > 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return DISC_DATABASE.filter(d => {
      const name = d.name.toLowerCase()
      const brand = d.brand.toLowerCase()
      const type = d.type ? d.type.toLowerCase() : ''
      return q
        .split(/\s+/)
        .every(tok => name.includes(tok) || brand.includes(tok) || type.includes(tok))
    })
  }, [query, catalogVersion])

  useEffect(
    () =>
      subscribeDiscCatalog(() =>
        setCatalogVersion(getDiscCatalogVersion()),
      ),
    [],
  )

  useEffect(() => {
    if (!open) return
    refreshDiscsFromSupabase()
  }, [open])

  useEffect(() => {
    if (!open) return
    setActiveIdx(0)
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    setActiveIdx(0)
  }, [query, catalogVersion])

  useLayoutEffect(() => {
    if (!open) return

    function updatePosition() {
      const trigger = triggerRef.current
      if (!trigger) return
      setPopStyle(measurePopoverStyle(trigger))
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.visualViewport?.addEventListener('resize', updatePosition)
    window.visualViewport?.addEventListener('scroll', updatePosition)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.visualViewport?.removeEventListener('resize', updatePosition)
      window.visualViewport?.removeEventListener('scroll', updatePosition)
    }
  }, [open, query, searching, draft])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (popRef.current?.contains(target)) return
      closeAll()
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
    if (!searching || filtered.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeAll()
      }
      return
    }
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
        ref={triggerRef}
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

      {open &&
        createPortal(
          <div
            ref={popRef}
            className="disc-select-pop disc-select-pop-portal"
            style={popStyle}
          >
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
                <button
                  type="button"
                  className="disc-select-add disc-select-add-top"
                  onClick={startCreate}
                >
                  + Add custom disc not listed
                  {query.trim() && (
                    <span className="muted small"> · “{query.trim()}”</span>
                  )}
                </button>
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
                {!searching ? (
                  <p className="disc-select-hint">
                    Type to search {DISC_DATABASE.length.toLocaleString()}+ discs
                    — e.g. <strong>Destroyer</strong>, <strong>Innova</strong>,{' '}
                    <strong>putter</strong>
                  </p>
                ) : (
                  <>
                    <p className="disc-select-count" aria-live="polite">
                      {filtered.length === 0
                        ? `No matches for “${query.trim()}”`
                        : `${filtered.length.toLocaleString()} disc${filtered.length === 1 ? '' : 's'} — scroll for all matches`}
                    </p>
                    <ul
                      ref={listRef}
                      className="disc-select-list disc-select-list-search"
                      role="listbox"
                      aria-label="Disc search results"
                    >
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
                  </>
                )}
              </>
            )}
          </div>,
          document.body,
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
