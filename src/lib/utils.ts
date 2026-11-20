import type { Product } from '../types'

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`

export const lkr = (n: number, opts: { decimals?: boolean; symbol?: boolean } = {}) => {
  const { decimals = true, symbol = true } = opts
  const v = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(Math.round((n + Number.EPSILON) * 100) / 100)
  return symbol ? `Rs. ${v}` : v
}

export const num = (n: number) => new Intl.NumberFormat('en-LK').format(n)

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'

export const fmtDateTime = (iso?: string) => (iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : '—')

export const dayKey = (iso: string | Date) => {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const startOfDay = (d = new Date()) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const toInputDate = (d: Date | string) => dayKey(d)

export const startOfWeek = (d = new Date()) => {
  const x = startOfDay(d)
  const diff = (x.getDay() + 6) % 7 // Monday start
  return addDays(x, -diff)
}
export const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1)
export const startOfYear = (d = new Date()) => new Date(d.getFullYear(), 0, 1)

/* ---------- EAN-13 helpers (ISBN-13 and in-store barcodes are all EAN-13) ---------- */

export const ean13Check = (d12: string) => {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}

export const withCheck = (d12: string) => d12 + ean13Check(d12)

export const isValidEan13 = (code: string) => /^\d{13}$/.test(code) && ean13Check(code.slice(0, 12)) === Number(code[12])

export const isbn10to13 = (isbn10: string) => {
  const core = '978' + isbn10.replace(/[^0-9Xx]/g, '').slice(0, 9)
  return withCheck(core)
}

/** Normalise ISBN input: 13 digits stays; 10 digits converted; otherwise returned as typed (digits only) */
export const normaliseIsbn = (raw: string) => {
  const s = raw.replace(/[^0-9Xx]/g, '')
  if (s.length === 10) return isbn10to13(s)
  return s
}

export const internalBarcode = (seq: number) => withCheck('200' + String(seq).padStart(9, '0'))

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

/** Returns the bit pattern (95 modules) for a valid EAN-13 string, or null */
export const ean13Bits = (code: string): string | null => {
  if (!isValidEan13(code)) return null
  const first = Number(code[0])
  const parity = PARITY[first]
  let bits = '101'
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? L : G)[Number(code[i])]
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[Number(code[i])]
  return bits + '101'
}

/* ---------- Product helpers ---------- */

export type StockState = 'available' | 'low' | 'out' | 'discontinued' | 'damaged'

export const available = (p: Pick<Product, 'qty' | 'reserved'>) => Math.max(0, p.qty - p.reserved)

export const stockState = (p: Product): StockState => {
  if (p.status === 'discontinued') return 'discontinued'
  if (p.status === 'damaged') return 'damaged'
  if (p.qty <= 0) return 'out'
  if (p.qty <= p.minStock) return 'low'
  return 'available'
}

export const STOCK_LABEL: Record<StockState, string> = {
  available: 'In stock',
  low: 'Low stock',
  out: 'Out of stock',
  discontinued: 'Discontinued',
  damaged: 'Damaged',
}

export const matchesProduct = (p: Product, q: string) => {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return [p.title, p.author, p.publisher, p.isbn, p.barcode, p.code, p.category, p.brand, p.subject, p.supplierCode]
    .filter(Boolean)
    .some((f) => String(f).toLowerCase().includes(s))
}

export const downloadCsv = (filename: string, rows: (string | number | null | undefined)[][]) => {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') inQ = false
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') {
      row.push(cur)
      cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      cur = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
