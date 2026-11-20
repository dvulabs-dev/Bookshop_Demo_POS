import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Cover, NumberInput, SearchBox } from './ui'
import { lkr, matchesProduct, normaliseIsbn } from '../lib/utils'
import type { Product } from '../types'

export function ProductPicker({ onPick, placeholder = 'Search product by title, ISBN, barcode or code…', filter, autoFocus }: { onPick: (p: Product) => void; placeholder?: string; filter?: (p: Product) => boolean; autoFocus?: boolean }) {
  const products = useStore((s) => s.products)
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    if (!q.trim()) return []
    const n = normaliseIsbn(q)
    return products.filter((p) => (!filter || filter(p)) && (matchesProduct(p, q) || p.barcode === n)).slice(0, 8)
  }, [q, products, filter])
  return (
    <div className="picker">
      <SearchBox value={q} onChange={setQ} placeholder={placeholder} autoFocus={autoFocus} />
      {list.length > 0 && (
        <div className="picker-list">
          {list.map((p) => (
            <button
              type="button"
              key={p.id}
              className="picker-item"
              onClick={() => {
                onPick(p)
                setQ('')
              }}
            >
              <Cover product={p} size={30} />
              <span>
                <b>{p.title}</b>
                <small className="muted block">
                  {p.code} • {p.barcode} • {p.qty} in stock
                </small>
              </span>
              <span className="muted">{lkr(p.price, { decimals: false })}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export interface EditLine {
  productId: string
  qty: number
  price: number
}

export function LineEditor({ lines, onChange, showPrice = true, priceLabel = 'Price', defaultPrice, readOnly, filter }: { lines: EditLine[]; onChange: (l: EditLine[]) => void; showPrice?: boolean; priceLabel?: string; defaultPrice?: (p: Product) => number; readOnly?: boolean; filter?: (p: Product) => boolean }) {
  const products = useStore((s) => s.products)
  const add = (p: Product) => {
    if (lines.some((l) => l.productId === p.id)) return onChange(lines.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l)))
    onChange([...lines, { productId: p.id, qty: 1, price: defaultPrice ? defaultPrice(p) : p.price }])
  }
  const total = lines.reduce((a, l) => a + l.qty * l.price, 0)
  return (
    <div className="stack">
      {!readOnly && <ProductPicker onPick={add} filter={filter} />}
      <div className="tbl-wrap">
        <table className="table compact">
          <thead>
            <tr>
              <th>Product</th>
              <th style={{ width: 100 }}>Qty</th>
              {showPrice && <th style={{ width: 120 }}>{priceLabel}</th>}
              {showPrice && <th className="r" style={{ width: 110 }}>Amount</th>}
              {!readOnly && <th style={{ width: 40 }} />}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = products.find((x) => x.id === l.productId)
              return (
                <tr key={l.productId}>
                  <td>
                    <b>{p?.title ?? 'Unknown product'}</b>
                    <small className="muted block">{p?.code} • stock {p?.qty}</small>
                  </td>
                  <td>{readOnly ? l.qty : <NumberInput value={l.qty} min={1} onChange={(n) => onChange(lines.map((x, j) => (j === i ? { ...x, qty: n } : x)))} />}</td>
                  {showPrice && <td>{readOnly ? lkr(l.price) : <NumberInput value={l.price} step={0.5} onChange={(n) => onChange(lines.map((x, j) => (j === i ? { ...x, price: n } : x)))} />}</td>}
                  {showPrice && <td className="r">{lkr(l.qty * l.price)}</td>}
                  {!readOnly && (
                    <td>
                      <button className="icon-btn sm" onClick={() => onChange(lines.filter((_, j) => j !== i))} aria-label="Remove">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="muted center">
                  No items added yet
                </td>
              </tr>
            )}
          </tbody>
          {showPrice && lines.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2} />
                <td className="r">
                  <b>Total</b>
                </td>
                <td className="r">
                  <b>{lkr(total)}</b>
                </td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
