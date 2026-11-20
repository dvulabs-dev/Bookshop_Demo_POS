import type {
  CartLine,
  Customer,
  CustomerPayment,
  DiscountInput,
  Expense,
  PayMethod,
  Product,
  PurchaseOrder,
  Sale,
  SaleReturn,
  Settings,
  Shift,
} from '../types'
import { round2 } from './utils'

export const PAY_LABEL: Record<PayMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank: 'Bank Transfer',
  qr: 'QR / Digital',
  storeCredit: 'Store Credit',
  advance: 'Advance Paid',
}

export const discountAmount = (d: DiscountInput, base: number) => {
  if (!d || !d.value) return 0
  const v = d.type === 'percent' ? (base * d.value) / 100 : d.value
  return round2(Math.min(Math.max(v, 0), base))
}

export interface CartTotals {
  lines: { gross: number; discount: number; net: number; product?: Product }[]
  subtotal: number
  billDiscount: number
  loyaltyDiscount: number
  tax: number
  total: number
  items: number
  totalDiscount: number
  /** discount as % of gross, used for cashier limit checks */
  effectivePct: number
  gross: number
}

export function computeCart(
  cart: CartLine[],
  products: Product[],
  billDiscount: DiscountInput,
  redeemPoints: number,
  customer: Customer | undefined,
  settings: Settings,
): CartTotals {
  const map = new Map(products.map((p) => [p.id, p]))
  const lines = cart.map((l) => {
    const gross = round2(l.qty * l.price)
    const discount = discountAmount(l.discount, gross)
    return { gross, discount, net: round2(gross - discount), product: map.get(l.productId) }
  })
  const subtotal = round2(lines.reduce((a, l) => a + l.net, 0))
  const gross = round2(lines.reduce((a, l) => a + l.gross, 0))
  const bd = discountAmount(billDiscount, subtotal)
  const loyalty = settings.pos.loyaltyEnabled && customer ? Math.min(round2(redeemPoints * settings.pos.pointValue), round2(subtotal - bd)) : 0
  const taxable = round2(subtotal - bd - loyalty)
  const tax = round2((taxable * settings.pos.taxPct) / 100)
  const total = round2(taxable + tax)
  const lineDisc = lines.reduce((a, l) => a + l.discount, 0)
  const totalDiscount = round2(lineDisc + bd + loyalty)
  return {
    lines,
    subtotal,
    billDiscount: bd,
    loyaltyDiscount: loyalty,
    tax,
    total,
    items: cart.reduce((a, l) => a + l.qty, 0),
    totalDiscount,
    effectivePct: gross > 0 ? (totalDiscount / gross) * 100 : 0,
    gross,
  }
}

/* ---------- sales analytics ---------- */

export const saleDiscount = (s: Sale) => round2(s.lines.reduce((a, l) => a + l.discount, 0) + s.discount)

export const saleCost = (s: Sale) => s.lines.reduce((a, l) => a + (l.qty - (l.returnedQty ?? 0)) * l.cost, 0)

export const returnsBySale = (returns: SaleReturn[]) => {
  const m = new Map<string, number>()
  returns.forEach((r) => m.set(r.saleId, (m.get(r.saleId) ?? 0) + r.amount))
  return m
}

/** Net revenue (excl. tax) after discounts and refunds for a sale */
export const saleRevenue = (s: Sale, retMap: Map<string, number>) =>
  s.status === 'voided' ? 0 : round2(s.subtotal - s.discount - (retMap.get(s.id) ?? 0))

export const saleProfit = (s: Sale, retMap: Map<string, number>) =>
  s.status === 'voided' ? 0 : round2(saleRevenue(s, retMap) - saleCost(s))

export const countedSales = (sales: Sale[]) => sales.filter((s) => s.status !== 'voided')

/* ---------- purchasing ---------- */

export const poLinesTotal = (po: PurchaseOrder) => round2(po.lines.reduce((a, l) => a + l.qty * l.unitCost - l.discount, 0))
export const poTotal = (po: PurchaseOrder) => round2(poLinesTotal(po) + po.charges - po.discount)
export const poReceivedValue = (po: PurchaseOrder) => round2(po.lines.reduce((a, l) => a + l.received * l.unitCost, 0))
export const poPaid = (po: PurchaseOrder) => round2(po.payments.reduce((a, p) => a + p.amount, 0))
export const poReturned = (po: PurchaseOrder) => round2(po.returns.reduce((a, r) => a + r.amount, 0))

/** Amount owed to supplier once goods are in hand */
export const poPayable = (po: PurchaseOrder) => {
  if (po.status === 'received') return Math.max(0, round2(poTotal(po) - poReturned(po) - poPaid(po)))
  if (po.status === 'partial') return Math.max(0, round2(poReceivedValue(po) + po.charges - po.discount - poReturned(po) - poPaid(po)))
  return 0
}

/* ---------- shifts / cash ---------- */

export interface CashCtx {
  sales: Sale[]
  returns: SaleReturn[]
  expenses: Expense[]
  customerPayments: CustomerPayment[]
}

export const shiftCashBreakdown = (shift: Shift, ctx: CashCtx) => {
  const sale = ctx.sales.filter((s) => s.shiftId === shift.id && s.status !== 'voided')
  const bySale = (m: PayMethod) =>
    round2(sale.reduce((a, s) => a + s.payments.filter((p) => p.method === m).reduce((x, p) => x + p.amount, 0), 0))
  const custCash = round2(ctx.customerPayments.filter((p) => p.shiftId === shift.id && p.method === 'cash').reduce((a, p) => a + p.amount, 0))
  const refundsCash = round2(ctx.returns.filter((r) => r.shiftId === shift.id && r.method === 'cash').reduce((a, r) => a + r.amount, 0))
  const expCash = round2(ctx.expenses.filter((e) => e.shiftId === shift.id && e.method === 'cash').reduce((a, e) => a + e.amount, 0))
  const cashSales = bySale('cash')
  const expected = round2(shift.openingCash + cashSales + custCash - refundsCash - expCash)
  return {
    bills: sale.length,
    salesTotal: round2(sale.reduce((a, s) => a + s.total, 0)),
    cashSales,
    card: bySale('card'),
    bank: bySale('bank'),
    qr: bySale('qr'),
    storeCredit: bySale('storeCredit'),
    advance: bySale('advance'),
    custCash,
    refundsCash,
    expCash,
    expected,
  }
}

/* ---------- misc ---------- */

export const sumBy = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0)

export const groupBy = <T,>(arr: T[], f: (x: T) => string) => {
  const m = new Map<string, T[]>()
  arr.forEach((x) => {
    const k = f(x)
    m.set(k, [...(m.get(k) ?? []), x])
  })
  return m
}
