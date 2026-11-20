import type { Expense, PayMethod, Product, Sale, SaleReturn } from '../types'
import { returnsBySale, saleCost, saleDiscount } from './calc'
import { addDays, dayKey, round2, startOfDay } from './utils'

export interface Range {
  from: Date
  to: Date // inclusive end of day
}

export const makeRange = (fromStr: string, toStr: string): Range => {
  const from = new Date(fromStr + 'T00:00:00')
  const to = new Date(toStr + 'T23:59:59.999')
  return { from, to }
}

export const inRange = (iso: string, r: Range) => {
  const t = new Date(iso).getTime()
  return t >= r.from.getTime() && t <= r.to.getTime()
}

export const rangeSales = (sales: Sale[], r: Range) => sales.filter((s) => s.status !== 'voided' && inRange(s.date, r))

export interface Summary {
  bills: number
  items: number
  gross: number // sales value incl. tax, before refunds
  refunds: number
  net: number // after refunds
  discount: number
  cost: number
  profit: number // gross profit (excl. tax)
  avg: number
}

export const summarise = (sales: Sale[], returns: SaleReturn[]): Summary => {
  const rm = returnsBySale(returns)
  const s = sales.filter((x) => x.status !== 'voided')
  const gross = round2(s.reduce((a, x) => a + x.total, 0))
  const refunds = round2(s.reduce((a, x) => a + (rm.get(x.id) ?? 0), 0))
  const revenue = s.reduce((a, x) => a + (x.subtotal - x.discount - (rm.get(x.id) ?? 0)), 0)
  const cost = round2(s.reduce((a, x) => a + saleCost(x), 0))
  return {
    bills: s.length,
    items: s.reduce((a, x) => a + x.lines.reduce((q, l) => q + l.qty - (l.returnedQty ?? 0), 0), 0),
    gross,
    refunds,
    net: round2(gross - refunds),
    discount: round2(s.reduce((a, x) => a + saleDiscount(x), 0)),
    cost,
    profit: round2(revenue - cost),
    avg: s.length ? round2(gross / s.length) : 0,
  }
}

export const dailySeries = (sales: Sale[], returns: SaleReturn[], r: Range) => {
  const rm = returnsBySale(returns)
  const out: { key: string; label: string; sales: number; profit: number; bills: number }[] = []
  const idx = new Map<string, number>()
  for (let d = startOfDay(r.from); d <= r.to; d = addDays(d, 1)) {
    idx.set(dayKey(d), out.length)
    out.push({ key: dayKey(d), label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), sales: 0, profit: 0, bills: 0 })
  }
  rangeSales(sales, r).forEach((s) => {
    const i = idx.get(dayKey(s.date))
    if (i == null) return
    const ret = rm.get(s.id) ?? 0
    out[i].sales = round2(out[i].sales + s.total - ret)
    out[i].profit = round2(out[i].profit + (s.subtotal - s.discount - ret) - saleCost(s))
    out[i].bills += 1
  })
  return out
}

export interface ProductAgg {
  productId: string
  title: string
  category: string
  qty: number
  revenue: number
  profit: number
}

export const productAgg = (sales: Sale[], products: Product[]): ProductAgg[] => {
  const pm = new Map(products.map((p) => [p.id, p]))
  const m = new Map<string, ProductAgg>()
  sales
    .filter((s) => s.status !== 'voided')
    .forEach((s) => {
      const bill = s.subtotal > 0 ? s.discount / s.subtotal : 0
      s.lines.forEach((l) => {
        const q = l.qty - (l.returnedQty ?? 0)
        if (q <= 0) return
        const rev = (l.price * q - l.discount * (q / l.qty)) * (1 - bill)
        const a = m.get(l.productId) ?? { productId: l.productId, title: l.title, category: pm.get(l.productId)?.category ?? 'Other', qty: 0, revenue: 0, profit: 0 }
        a.qty += q
        a.revenue = round2(a.revenue + rev)
        a.profit = round2(a.profit + rev - l.cost * q)
        m.set(l.productId, a)
      })
    })
  return [...m.values()]
}

export const categoryAgg = (aggs: ProductAgg[]) => {
  const m = new Map<string, { category: string; qty: number; revenue: number; profit: number }>()
  aggs.forEach((a) => {
    const c = m.get(a.category) ?? { category: a.category, qty: 0, revenue: 0, profit: 0 }
    c.qty += a.qty
    c.revenue = round2(c.revenue + a.revenue)
    c.profit = round2(c.profit + a.profit)
    m.set(a.category, c)
  })
  return [...m.values()].sort((a, b) => b.revenue - a.revenue)
}

export const paymentBreakdown = (sales: Sale[]) => {
  const m = new Map<PayMethod, number>()
  sales
    .filter((s) => s.status !== 'voided')
    .forEach((s) => s.payments.forEach((p) => m.set(p.method, round2((m.get(p.method) ?? 0) + p.amount))))
  return [...m.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount)
}

export const expensesIn = (expenses: Expense[], r: Range) => expenses.filter((e) => inRange(e.date, r))
export const sumExpenses = (expenses: Expense[]) => round2(expenses.reduce((a, e) => a + e.amount, 0))

export const PRESETS = ['today', 'yesterday', '7d', '30d', 'month', 'lastmonth', 'year', 'custom'] as const
export type Preset = (typeof PRESETS)[number]

export const PRESET_LABEL: Record<Preset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'This month',
  lastmonth: 'Last month',
  year: 'This year',
  custom: 'Custom',
}

export const presetRange = (p: Preset): { from: string; to: string } => {
  const now = new Date()
  const t = startOfDay(now)
  switch (p) {
    case 'today':
      return { from: dayKey(t), to: dayKey(t) }
    case 'yesterday':
      return { from: dayKey(addDays(t, -1)), to: dayKey(addDays(t, -1)) }
    case '7d':
      return { from: dayKey(addDays(t, -6)), to: dayKey(t) }
    case '30d':
      return { from: dayKey(addDays(t, -29)), to: dayKey(t) }
    case 'month':
      return { from: dayKey(new Date(t.getFullYear(), t.getMonth(), 1)), to: dayKey(t) }
    case 'lastmonth':
      return { from: dayKey(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: dayKey(new Date(t.getFullYear(), t.getMonth(), 0)) }
    case 'year':
      return { from: dayKey(new Date(t.getFullYear(), 0, 1)), to: dayKey(t) }
    default:
      return { from: dayKey(addDays(t, -29)), to: dayKey(t) }
  }
}
