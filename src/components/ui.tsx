import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Inbox, Check } from 'lucide-react'
import type { Product } from '../types'
import { ean13Bits } from '../lib/utils'

/* ---------------- layout bits ---------------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row gap">{actions}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className = '', pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <h3>{title}</h3>
          {actions && <div className="row gap-s">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  )
}

export type Tone = 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'teal' | 'purple'

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Stat({ label, value, sub, icon, tone = 'teal', onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: Tone; onClick?: () => void }) {
  return (
    <div className={`stat ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      {icon && <div className={`stat-icon ${tone}`}>{icon}</div>}
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  )
}

export function Empty({ title, text, icon, action }: { title: string; text?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <Inbox size={28} />}</div>
      <strong>{title}</strong>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count != null && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- form controls ---------------- */

export function Field({ label, hint, children, required, className = '' }: { label: string; hint?: string; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {required && <b className="req"> *</b>}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function NumberInput({ value, onChange, min, max, step = 1, className = '', placeholder, disabled, autoFocus }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; className?: string; placeholder?: string; disabled?: boolean; autoFocus?: boolean }) {
  const [text, setText] = useState(value === 0 ? '' : String(value))
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setText(value === 0 ? '' : String(value))
    }
  }, [value])
  return (
    <input
      className={`input ${className}`}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={placeholder ?? '0'}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        let n = e.target.value === '' ? 0 : Number(e.target.value)
        if (Number.isNaN(n)) n = 0
        if (max != null && n > max) n = max
        last.current = n
        onChange(n)
      }}
      onFocus={(e) => e.target.select()}
    />
  )
}

export function SearchBox({ value, onChange, placeholder = 'Search…', autoFocus, inputRef, onEnter }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; inputRef?: React.Ref<HTMLInputElement>; onEnter?: () => void }) {
  return (
    <div className="searchbox">
      <Search size={16} />
      <input ref={inputRef} autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onEnter?.()} placeholder={placeholder} />
      {value && (
        <button type="button" className="icon-btn sm" onClick={() => onChange('')} aria-label="Clear">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; hint?: string; disabled?: boolean }) {
  return (
    <label className={`toggle ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {(label || hint) && (
        <span className="toggle-text">
          {label}
          {hint && <small className="muted">{hint}</small>}
        </span>
      )}
    </label>
  )
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children?: ReactNode }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="box">{checked && <Check size={12} strokeWidth={3} />}</span>
      {children}
    </label>
  )
}

/* ---------------- modal ---------------- */

export function Modal({ title, onClose, children, footer, width = 560, subtitle }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = prev
    }
  }, [])
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <header className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------- product visuals ---------------- */

export function Cover({ product, size = 40 }: { product: Pick<Product, 'title' | 'hue' | 'type'>; size?: number }) {
  const initials = product.title
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  const isBook = product.type === 'book' || product.type === 'school'
  return (
    <div
      className="cover"
      style={{
        width: size * (isBook ? 0.78 : 1),
        height: size,
        background: `linear-gradient(135deg, hsl(${product.hue} 55% 38%), hsl(${(product.hue + 40) % 360} 60% 52%))`,
        borderRadius: isBook ? 4 : 10,
        fontSize: size * 0.32,
      }}
    >
      {initials}
    </div>
  )
}

export function Barcode({ code, height = 46, showText = true, scale = 1.6 }: { code: string; height?: number; showText?: boolean; scale?: number }) {
  const bits = useMemo(() => ean13Bits(code), [code])
  if (!bits) return <span className="muted">Invalid barcode</span>
  const quiet = 9
  const w = (bits.length + quiet * 2) * scale
  const rects: ReactNode[] = []
  let i = 0
  while (i < bits.length) {
    if (bits[i] === '1') {
      let j = i
      while (j < bits.length && bits[j] === '1') j++
      const guard = i < 3 || j > 92 || (i >= 45 && j <= 50)
      rects.push(<rect key={i} x={(i + quiet) * scale} y={0} width={(j - i) * scale} height={height + (guard && showText ? 5 : 0)} fill="#000" />)
      i = j
    } else i++
  }
  return (
    <svg className="barcode" viewBox={`0 0 ${w} ${height + (showText ? 16 : 0)}`} width={w} height={height + (showText ? 16 : 0)} role="img" aria-label={`Barcode ${code}`}>
      <rect width={w} height={height + 16} fill="#fff" />
      {rects}
      {showText && (
        <g fontFamily="monospace" fontSize={10 * scale * 0.62} fill="#000" textAnchor="middle">
          <text x={(quiet - 5) * scale} y={height + 12}>{code[0]}</text>
          <text x={(quiet + 3 + 21) * scale} y={height + 12} letterSpacing="1.5">{code.slice(1, 7)}</text>
          <text x={(quiet + 50 + 21) * scale} y={height + 12} letterSpacing="1.5">{code.slice(7)}</text>
        </g>
      )}
    </svg>
  )
}

/* ---------------- simple table pagination ---------------- */

export function usePaged<T>(items: T[], size = 15) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / size))
  useEffect(() => {
    if (page > pages - 1) setPage(0)
  }, [pages, page])
  return { rows: items.slice(page * size, page * size + size), page, pages, setPage, total: items.length, size }
}

export function Pager({ page, pages, setPage, total, size }: { page: number; pages: number; setPage: (n: number) => void; total: number; size: number }) {
  if (total <= size) return <div className="pager muted">{total} record{total === 1 ? '' : 's'}</div>
  return (
    <div className="pager">
      <span className="muted">
        {page * size + 1}–{Math.min(total, (page + 1) * size)} of {total}
      </span>
      <div className="row gap-s">
        <button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Prev
        </button>
        <span className="muted">
          {page + 1} / {pages}
        </span>
        <button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
