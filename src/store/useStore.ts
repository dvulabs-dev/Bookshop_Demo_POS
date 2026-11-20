import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSeed, type SeedBundle } from '../data/seed'
import { ALL_PERMISSIONS } from '../data/roles'
import { computeCart, shiftCashBreakdown } from '../lib/calc'
import { addDays, round2, uid } from '../lib/utils'
import type {
  AuditEntry,
  Bundle,
  CartLine,
  Customer,
  CustomerPayment,
  DiscountInput,
  Expense,
  HeldBill,
  MovementType,
  Payment,
  Permission,
  PriceChange,
  Product,
  PurchaseOrder,
  Quotation,
  Reservation,
  Sale,
  SaleReturn,
  SchoolList,
  Settings,
  Shift,
  SpecialOrder,
  StockMovement,
  Supplier,
  SupplierPayment,
  User,
} from '../types'

export interface CartState {
  lines: CartLine[]
  customerId?: string
  billDiscount: DiscountInput
  redeemPoints: number
  advance: number
  advanceRef: string
  note: string
}

const emptyCart = (): CartState => ({
  lines: [],
  customerId: undefined,
  billDiscount: { type: 'amount', value: 0 },
  redeemPoints: 0,
  advance: 0,
  advanceRef: '',
  note: '',
})

export interface CompleteSaleInput {
  payments: Payment[]
  tendered?: number // cash handed over (to compute change)
  approvedBy?: string
}

export interface ReturnInput {
  saleId: string
  lines: { productId: string; qty: number; condition: 'Good' | 'Damaged' | 'Opened'; restock: boolean }[]
  type: SaleReturn['type']
  method?: SaleReturn['method']
  reason: string
  approvedBy?: string
}

interface State extends SeedBundle {
  customerPayments: CustomerPayment[]
  priceHistory: PriceChange[]
  held: HeldBill[]
  cart: CartState
  currentUserId: string | null
  version: number

  // auth
  login: (username: string, password: string) => User | null
  logout: () => void
  verifyPin: (pin: string, perm: Permission) => User | null
  log: (action: string, detail: string, sensitive?: boolean) => void

  // settings
  setSettings: (fn: (s: Settings) => Settings) => void
  resetDemo: () => void

  // products & stock
  saveProduct: (p: Product) => void
  deleteProduct: (id: string) => void
  importProducts: (items: Product[]) => void
  adjustStock: (productId: string, delta: number, type: MovementType, reason: string, ref?: string) => void
  setProductStatus: (id: string, status: Product['status']) => void

  // master data
  saveCustomer: (c: Customer) => void
  deleteCustomer: (id: string) => void
  receiveCustomerPayment: (customerId: string, amount: number, method: CustomerPayment['method'], ref?: string) => void
  saveSupplier: (s: Supplier) => void
  deleteSupplier: (id: string) => void
  saveUser: (u: User) => void

  // cart / POS
  addToCart: (productId: string, qty?: number) => void
  setCart: (patch: Partial<CartState>) => void
  setLine: (index: number, patch: Partial<CartLine>) => void
  removeLine: (index: number) => void
  clearCart: () => void
  loadLines: (lines: { productId: string; qty: number; price?: number }[], extra?: Partial<CartState>) => void
  holdBill: (note?: string) => void
  resumeBill: (id: string) => void
  deleteHeld: (id: string) => void
  completeSale: (input: CompleteSaleInput) => Sale | null
  voidSale: (id: string, reason: string, approvedBy?: string) => void
  processReturn: (input: ReturnInput) => SaleReturn | null

  // shifts / finance
  openShift: (openingCash: number) => Shift
  closeShift: (id: string, counted: number, note?: string) => void
  saveExpense: (e: Expense) => void
  deleteExpense: (id: string) => void

  // purchasing
  savePO: (po: PurchaseOrder) => void
  receivePO: (poId: string, receipts: Record<string, number>) => void
  payPO: (poId: string, p: Omit<SupplierPayment, 'id'>) => void
  returnToSupplier: (poId: string, productId: string, qty: number, reason: string) => void
  setPOStatus: (poId: string, status: PurchaseOrder['status']) => void

  // documents
  saveQuotation: (q: Quotation) => void
  saveReservation: (r: Reservation) => void
  setReservationStatus: (id: string, status: Reservation['status']) => void
  saveSpecialOrder: (o: SpecialOrder) => void
  saveSchoolList: (l: SchoolList) => void
  deleteSchoolList: (id: string) => void
  saveBundle: (b: Bundle) => void
  deleteBundle: (id: string) => void
}

const upsert = <T extends { id: string }>(arr: T[], item: T) =>
  arr.some((x) => x.id === item.id) ? arr.map((x) => (x.id === item.id ? item : x)) : [item, ...arr]

const nextDocNo = (prefix: string, existing: string[]) => {
  const max = existing.reduce((m, n) => Math.max(m, Number(n.replace(/\D/g, '')) || 0), 0)
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}
export { nextDocNo }

const seed = buildSeed()

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const logEntry = (action: string, detail: string, sensitive = false): AuditEntry => ({
        id: uid('au'),
        date: new Date().toISOString(),
        userId: get().currentUserId ?? 'system',
        action,
        detail,
        sensitive,
      })
      const mv = (m: Omit<StockMovement, 'id' | 'date' | 'userId'> & { date?: string }): StockMovement => ({
        id: uid('m'),
        date: m.date ?? new Date().toISOString(),
        userId: get().currentUserId ?? 'system',
        ...m,
      })
      const openShiftFor = (userId: string | null) => get().shifts.find((s) => !s.closedAt && s.cashierId === userId)

      return {
        ...seed,
        customerPayments: [],
        priceHistory: [],
        held: [],
        cart: emptyCart(),
        currentUserId: null,
        version: 1,

        /* ---------------- auth ---------------- */
        login: (username, password) => {
          const u = get().users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password && x.active)
          if (!u) return null
          set((s) => ({
            currentUserId: u.id,
            users: s.users.map((x) => (x.id === u.id ? { ...x, lastLogin: new Date().toISOString() } : x)),
            audit: [{ id: uid('au'), date: new Date().toISOString(), userId: u.id, action: 'Login', detail: `${u.name} signed in` }, ...s.audit].slice(0, 1000),
          }))
          return u
        },
        logout: () => {
          const uidNow = get().currentUserId
          set((s) => ({
            currentUserId: null,
            audit: uidNow ? [{ id: uid('au'), date: new Date().toISOString(), userId: uidNow, action: 'Logout', detail: 'Signed out' }, ...s.audit] : s.audit,
          }))
        },
        verifyPin: (pin, perm) => get().users.find((u) => u.active && u.pin === pin && u.permissions.includes(perm)) ?? null,
        log: (action, detail, sensitive) => set((s) => ({ audit: [logEntry(action, detail, sensitive), ...s.audit].slice(0, 1000) })),

        /* ---------------- settings ---------------- */
        setSettings: (fn) => {
          set((s) => ({ settings: fn(s.settings) }))
        },
        resetDemo: () => {
          const fresh = buildSeed()
          set({
            ...fresh,
            customerPayments: [],
            priceHistory: [],
            held: [],
            cart: emptyCart(),
            currentUserId: get().currentUserId,
          })
        },

        /* ---------------- products ---------------- */
        saveProduct: (p) => {
          const old = get().products.find((x) => x.id === p.id)
          const changes: PriceChange[] = []
          if (!old || old.cost !== p.cost || old.price !== p.price) {
            changes.push({ id: uid('pc'), date: new Date().toISOString(), productId: p.id, cost: p.cost, price: p.price, userId: get().currentUserId ?? 'system', source: old ? 'Manual edit' : 'New product' })
          }
          const addMov: StockMovement[] = []
          if (!old && p.qty > 0) addMov.push(mv({ productId: p.id, type: 'opening', qty: p.qty, reason: 'Opening quantity', ref: 'OPEN' }))
          set((s) => ({
            products: upsert(s.products, p),
            priceHistory: [...changes, ...s.priceHistory],
            movements: [...addMov, ...s.movements],
            audit: [
              logEntry(old ? 'Product updated' : 'Product created', `${p.title} (${p.code})${old && old.price !== p.price ? ` – price Rs. ${old.price} → Rs. ${p.price}` : ''}`, !!old && (old.price !== p.price || old.cost !== p.cost)),
              ...s.audit,
            ],
          }))
        },
        deleteProduct: (id) => {
          const p = get().products.find((x) => x.id === id)
          set((s) => ({ products: s.products.filter((x) => x.id !== id), audit: [logEntry('Product deleted', p?.title ?? id, true), ...s.audit] }))
        },
        importProducts: (items) => {
          set((s) => ({
            products: [...items, ...s.products],
            movements: [...items.filter((p) => p.qty > 0).map((p) => mv({ productId: p.id, type: 'opening', qty: p.qty, reason: 'Imported opening quantity', ref: 'IMPORT' })), ...s.movements],
            audit: [logEntry('Products imported', `${items.length} products imported from CSV`), ...s.audit],
          }))
        },
        adjustStock: (productId, delta, type, reason, ref) => {
          const p = get().products.find((x) => x.id === productId)
          if (!p || delta === 0) return
          const qty = Math.max(0, p.qty + delta)
          const real = qty - p.qty
          set((s) => ({
            products: s.products.map((x) => (x.id === productId ? { ...x, qty } : x)),
            movements: [mv({ productId, type, qty: real, reason, ref: ref ?? uid('ADJ').toUpperCase().slice(0, 9) }), ...s.movements],
            audit: [logEntry('Stock adjusted', `${p.title}: ${real > 0 ? '+' : ''}${real} (${type}) – ${reason}`, true), ...s.audit],
          }))
        },
        setProductStatus: (id, status) => set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, status } : p)) })),

        /* ---------------- master data ---------------- */
        saveCustomer: (c) =>
          set((s) => ({ customers: upsert(s.customers, c), audit: [logEntry(s.customers.some((x) => x.id === c.id) ? 'Customer updated' : 'Customer created', c.name), ...s.audit] })),
        deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((c) => c.id !== id), audit: [logEntry('Customer deleted', id, true), ...s.audit] })),
        receiveCustomerPayment: (customerId, amount, method, ref) => {
          const shift = openShiftFor(get().currentUserId)
          set((s) => ({
            customers: s.customers.map((c) => (c.id === customerId ? { ...c, balance: Math.max(0, round2(c.balance - amount)) } : c)),
            customerPayments: [{ id: uid('cp'), date: new Date().toISOString(), customerId, amount, method, ref, userId: s.currentUserId ?? 'system', shiftId: shift?.id }, ...s.customerPayments],
            audit: [logEntry('Customer payment', `Received Rs. ${amount} from ${s.customers.find((c) => c.id === customerId)?.name}`), ...s.audit],
          }))
        },
        saveSupplier: (sp) => set((s) => ({ suppliers: upsert(s.suppliers, sp), audit: [logEntry('Supplier saved', sp.name), ...s.audit] })),
        deleteSupplier: (id) => set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) })),
        saveUser: (u) =>
          set((s) => ({
            users: s.users.some((x) => x.id === u.id) ? s.users.map((x) => (x.id === u.id ? u : x)) : [...s.users, u],
            audit: [logEntry('User saved', `${u.name} (${u.role}) – ${u.permissions.length} permissions`, true), ...s.audit],
          })),

        /* ---------------- cart ---------------- */
        addToCart: (productId, qty = 1) => {
          const p = get().products.find((x) => x.id === productId)
          if (!p) return
          set((s) => {
            const idx = s.cart.lines.findIndex((l) => l.productId === productId)
            const lines =
              idx >= 0
                ? s.cart.lines.map((l, i) => (i === idx ? { ...l, qty: l.qty + qty } : l))
                : [...s.cart.lines, { productId, qty, price: p.price, discount: { type: 'amount', value: 0 } as DiscountInput }]
            return { cart: { ...s.cart, lines } }
          })
        },
        setCart: (patch) => set((s) => ({ cart: { ...s.cart, ...patch } })),
        setLine: (index, patch) => set((s) => ({ cart: { ...s.cart, lines: s.cart.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) } })),
        removeLine: (index) => set((s) => ({ cart: { ...s.cart, lines: s.cart.lines.filter((_, i) => i !== index) } })),
        clearCart: () => set({ cart: emptyCart() }),
        loadLines: (lines, extra) =>
          set((s) => ({
            // never lose an in-progress bill: park it as a held bill first
            held: s.cart.lines.length
              ? [{ id: uid('hold'), date: new Date().toISOString(), cashierId: s.currentUserId ?? '', customerId: s.cart.customerId, lines: s.cart.lines, billDiscount: s.cart.billDiscount, note: 'Auto-parked' }, ...s.held]
              : s.held,
            cart: {
              ...emptyCart(),
              ...extra,
              lines: lines.map((l) => ({
                productId: l.productId,
                qty: l.qty,
                price: l.price ?? s.products.find((p) => p.id === l.productId)?.price ?? 0,
                discount: { type: 'amount', value: 0 },
              })),
            },
          })),
        holdBill: (note) => {
          const { cart, currentUserId } = get()
          if (!cart.lines.length) return
          const h: HeldBill = { id: uid('hold'), date: new Date().toISOString(), cashierId: currentUserId ?? '', customerId: cart.customerId, lines: cart.lines, billDiscount: cart.billDiscount, note }
          set((s) => ({ held: [h, ...s.held], cart: emptyCart() }))
        },
        resumeBill: (id) => {
          const h = get().held.find((x) => x.id === id)
          if (!h) return
          set((s) => ({ cart: { ...emptyCart(), lines: h.lines, customerId: h.customerId, billDiscount: h.billDiscount, note: h.note ?? '' }, held: s.held.filter((x) => x.id !== id) }))
        },
        deleteHeld: (id) => set((s) => ({ held: s.held.filter((x) => x.id !== id) })),

        /* ---------------- sale ---------------- */
        completeSale: ({ payments, tendered, approvedBy }) => {
          const st = get()
          const { cart, settings, products } = st
          if (!cart.lines.length) return null
          const customer = st.customers.find((c) => c.id === cart.customerId)
          const totals = computeCart(cart.lines, products, cart.billDiscount, cart.redeemPoints, customer, settings)
          const shift = openShiftFor(st.currentUserId)
          const all: Payment[] = [...payments.filter((p) => p.amount > 0)]
          if (cart.advance > 0) all.unshift({ method: 'advance', amount: Math.min(cart.advance, totals.total), ref: cart.advanceRef || 'Advance' })
          const cashApplied = all.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0)
          let change = 0
          if (tendered && tendered > cashApplied) change = round2(tendered - cashApplied)
          // never record more than the bill value
          let remaining = totals.total
          const finalPayments = all.map((p) => {
            const amt = Math.min(p.amount, Math.max(0, remaining))
            remaining = round2(remaining - amt)
            return { ...p, amount: round2(amt) }
          }).filter((p) => p.amount > 0)
          const paid = round2(finalPayments.reduce((a, p) => a + p.amount, 0))
          const balance = round2(totals.total - paid)
          const no = `${settings.receipt.prefix}${String(settings.receipt.nextNo).padStart(6, '0')}`
          const date = new Date().toISOString()
          const sale: Sale = {
            id: uid('sale'),
            no,
            date,
            cashierId: st.currentUserId ?? '',
            customerId: customer?.id,
            customerName: customer?.name,
            lines: cart.lines.map((l, i) => {
              const p = products.find((x) => x.id === l.productId)!
              return { productId: l.productId, title: p.title, code: p.code, barcode: p.barcode, qty: l.qty, price: l.price, cost: p.cost, discount: totals.lines[i].discount }
            }),
            subtotal: totals.subtotal,
            discount: round2(totals.billDiscount + totals.loyaltyDiscount),
            tax: totals.tax,
            total: totals.total,
            payments: finalPayments,
            paid,
            change,
            balance,
            status: 'completed',
            shiftId: shift?.id,
            approvedBy,
            note: cart.note || undefined,
          }
          const newMov = cart.lines.map((l) => mv({ productId: l.productId, type: 'sale', qty: -l.qty, ref: no, date }))
          const earned = settings.pos.loyaltyEnabled && customer ? Math.floor(totals.total / settings.pos.pointsPerLkr) : 0
          const storeCreditUsed = finalPayments.filter((p) => p.method === 'storeCredit').reduce((a, p) => a + p.amount, 0)
          set((s) => ({
            sales: [sale, ...s.sales],
            movements: [...newMov, ...s.movements],
            products: s.products.map((p) => {
              const l = cart.lines.filter((x) => x.productId === p.id).reduce((a, x) => a + x.qty, 0)
              return l ? { ...p, qty: Math.max(0, p.qty - l) } : p
            }),
            customers: s.customers.map((c) =>
              c.id === customer?.id
                ? { ...c, balance: round2(c.balance + balance), points: Math.max(0, c.points - cart.redeemPoints + earned), deposit: Math.max(0, round2(c.deposit - storeCreditUsed)) }
                : c,
            ),
            settings: { ...s.settings, receipt: { ...s.settings.receipt, nextNo: s.settings.receipt.nextNo + 1 } },
            cart: emptyCart(),
            audit: [
              logEntry('Sale completed', `${no} – Rs. ${totals.total.toFixed(2)}${approvedBy ? ' (discount approved)' : ''}`),
              ...s.audit,
            ].slice(0, 1000),
          }))
          return sale
        },
        voidSale: (id, reason, approvedBy) => {
          const sale = get().sales.find((s) => s.id === id)
          if (!sale || sale.status === 'voided') return
          const date = new Date().toISOString()
          set((s) => ({
            sales: s.sales.map((x) => (x.id === id ? { ...x, status: 'voided', voidReason: reason, voidedBy: approvedBy ?? s.currentUserId ?? undefined } : x)),
            movements: [...sale.lines.map((l) => mv({ productId: l.productId, type: 'void', qty: l.qty - (l.returnedQty ?? 0), ref: sale.no, reason: `Void: ${reason}`, date })), ...s.movements],
            products: s.products.map((p) => {
              const l = sale.lines.filter((x) => x.productId === p.id).reduce((a, x) => a + x.qty - (x.returnedQty ?? 0), 0)
              return l ? { ...p, qty: p.qty + l } : p
            }),
            customers: s.customers.map((c) => (c.id === sale.customerId ? { ...c, balance: Math.max(0, round2(c.balance - sale.balance)) } : c)),
            audit: [logEntry('Sale voided', `${sale.no} – ${reason}`, true), ...s.audit],
          }))
        },
        processReturn: ({ saleId, lines, type, method, reason, approvedBy }) => {
          const st = get()
          const sale = st.sales.find((s) => s.id === saleId)
          if (!sale) return null
          const date = new Date().toISOString()
          const shift = openShiftFor(st.currentUserId)
          const billDiscRatio = sale.subtotal > 0 ? sale.discount / sale.subtotal : 0
          const retLines = lines
            .filter((l) => l.qty > 0)
            .map((l) => {
              const sl = sale.lines.find((x) => x.productId === l.productId)!
              const unitNet = (sl.price * sl.qty - sl.discount) / sl.qty
              return { productId: l.productId, title: sl.title, qty: l.qty, amount: round2(unitNet * l.qty * (1 - billDiscRatio)), condition: l.condition, restock: l.restock }
            })
          if (!retLines.length) return null
          const amount = round2(retLines.reduce((a, l) => a + l.amount, 0))
          const no = nextDocNo('RET-', st.returns.map((r) => r.no))
          const ret: SaleReturn = { id: uid('ret'), no, saleId, saleNo: sale.no, date, lines: retLines, amount, type, method, reason, staffId: st.currentUserId ?? '', approvedBy, shiftId: shift?.id }
          const newLines = sale.lines.map((sl) => {
            const r = retLines.find((l) => l.productId === sl.productId)
            return r ? { ...sl, returnedQty: (sl.returnedQty ?? 0) + r.qty } : sl
          })
          const fully = newLines.every((l) => (l.returnedQty ?? 0) >= l.qty)
          const newMov: StockMovement[] = retLines.map((l) =>
            l.restock ? mv({ productId: l.productId, type: 'return', qty: l.qty, ref: no, reason, date }) : mv({ productId: l.productId, type: 'damage', qty: 0, ref: no, reason: `Returned ${l.condition.toLowerCase()} – not restocked`, date }),
          )
          set((s) => ({
            returns: [ret, ...s.returns],
            sales: s.sales.map((x) => (x.id === saleId ? { ...x, lines: newLines, status: fully ? 'refunded' : 'partial_return' } : x)),
            movements: [...newMov, ...s.movements],
            products: s.products.map((p) => {
              const q = retLines.filter((l) => l.productId === p.id && l.restock).reduce((a, l) => a + l.qty, 0)
              return q ? { ...p, qty: p.qty + q } : p
            }),
            customers: s.customers.map((c) => {
              if (c.id !== sale.customerId) return c
              if (type === 'storeCredit') return { ...c, deposit: round2(c.deposit + amount) }
              if (type === 'balanceAdjustment') return { ...c, balance: Math.max(0, round2(c.balance - amount)) }
              return c
            }),
            audit: [logEntry('Return processed', `${no} on ${sale.no} – Rs. ${amount.toFixed(2)} (${type})`, true), ...s.audit],
          }))
          return ret
        },

        /* ---------------- shifts / finance ---------------- */
        openShift: (openingCash) => {
          const sh: Shift = { id: uid('sh'), cashierId: get().currentUserId ?? '', openedAt: new Date().toISOString(), openingCash }
          set((s) => ({ shifts: [...s.shifts, sh], audit: [logEntry('Shift opened', `Opening cash Rs. ${openingCash}`), ...s.audit] }))
          return sh
        },
        closeShift: (id, counted, note) => {
          const st = get()
          const sh = st.shifts.find((s) => s.id === id)
          if (!sh) return
          const exp = shiftCashBreakdown(sh, st).expected
          set((s) => ({
            shifts: s.shifts.map((x) => (x.id === id ? { ...x, closedAt: new Date().toISOString(), countedCash: counted, expectedCash: exp, difference: round2(counted - exp), note } : x)),
            audit: [logEntry('Shift closed', `Expected Rs. ${exp} • Counted Rs. ${counted} • Difference Rs. ${round2(counted - exp)}`, Math.abs(counted - exp) > 0), ...s.audit],
          }))
        },
        saveExpense: (e) => {
          const shift = openShiftFor(get().currentUserId)
          set((s) => ({
            expenses: upsert(s.expenses, { ...e, shiftId: e.shiftId ?? (e.method === 'cash' ? shift?.id : undefined) }),
            audit: [logEntry('Expense recorded', `${e.category} – Rs. ${e.amount}`), ...s.audit],
          }))
        },
        deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id), audit: [logEntry('Expense deleted', id, true), ...s.audit] })),

        /* ---------------- purchasing ---------------- */
        savePO: (po) => set((s) => ({ purchaseOrders: upsert(s.purchaseOrders, po), audit: [logEntry('Purchase order saved', `${po.no} (${po.status})`), ...s.audit] })),
        receivePO: (poId, receipts) => {
          const po = get().purchaseOrders.find((p) => p.id === poId)
          if (!po) return
          const date = new Date().toISOString()
          const lines = po.lines.map((l) => ({ ...l, received: l.received + (receipts[l.productId] ?? 0) }))
          const allDone = lines.every((l) => l.received >= l.qty)
          const any = lines.some((l) => l.received > 0)
          const newMov = Object.entries(receipts).filter(([, q]) => q > 0).map(([productId, qty]) => mv({ productId, type: 'purchase', qty, ref: po.no, date }))
          const changes: PriceChange[] = []
          set((s) => ({
            purchaseOrders: s.purchaseOrders.map((p) => (p.id === poId ? { ...p, lines, status: allDone ? 'received' : any ? 'partial' : p.status } : p)),
            movements: [...newMov, ...s.movements],
            products: s.products.map((p) => {
              const q = receipts[p.id] ?? 0
              if (!q) return p
              const pl = po.lines.find((l) => l.productId === p.id)!
              if (pl.unitCost !== p.cost) changes.push({ id: uid('pc'), date, productId: p.id, cost: pl.unitCost, price: p.price, userId: s.currentUserId ?? 'system', source: `Purchase ${po.no}` })
              return { ...p, qty: p.qty + q, cost: pl.unitCost, status: p.status === 'discontinued' ? p.status : 'active' }
            }),
            audit: [logEntry('Goods received', `${po.no}: ${newMov.length} products received`), ...s.audit],
          }))
          if (changes.length) set((s) => ({ priceHistory: [...changes, ...s.priceHistory] }))
        },
        payPO: (poId, p) =>
          set((s) => ({
            purchaseOrders: s.purchaseOrders.map((po) => (po.id === poId ? { ...po, payments: [...po.payments, { ...p, id: uid('sp') }] } : po)),
            audit: [logEntry('Supplier payment', `Rs. ${p.amount} paid on ${s.purchaseOrders.find((x) => x.id === poId)?.no}`), ...s.audit],
          })),
        returnToSupplier: (poId, productId, qty, reason) => {
          const po = get().purchaseOrders.find((p) => p.id === poId)
          const prod = get().products.find((p) => p.id === productId)
          const line = po?.lines.find((l) => l.productId === productId)
          if (!po || !prod || !line) return
          const q = Math.min(qty, prod.qty)
          if (q <= 0) return
          set((s) => ({
            purchaseOrders: s.purchaseOrders.map((x) => (x.id === poId ? { ...x, returns: [...x.returns, { id: uid('sr'), date: new Date().toISOString(), productId, qty: q, amount: round2(q * line.unitCost), reason }] } : x)),
            products: s.products.map((x) => (x.id === productId ? { ...x, qty: x.qty - q } : x)),
            movements: [mv({ productId, type: 'supplier_return', qty: -q, ref: po.no, reason }), ...s.movements],
            audit: [logEntry('Supplier return', `${q} × ${prod.title} returned (${po.no}) – ${reason}`, true), ...s.audit],
          }))
        },
        setPOStatus: (poId, status) => set((s) => ({ purchaseOrders: s.purchaseOrders.map((p) => (p.id === poId ? { ...p, status } : p)) })),

        /* ---------------- documents ---------------- */
        saveQuotation: (q) => set((s) => ({ quotations: upsert(s.quotations, q) })),
        saveReservation: (r) => {
          const old = get().reservations.find((x) => x.id === r.id)
          set((s) => {
            // recompute reserved quantity from active reservations
            const reservations = upsert(s.reservations, r)
            const reserved = new Map<string, number>()
            reservations.filter((x) => x.status === 'active').forEach((x) => x.lines.forEach((l) => reserved.set(l.productId, (reserved.get(l.productId) ?? 0) + l.qty)))
            return {
              reservations,
              products: s.products.map((p) => ({ ...p, reserved: reserved.get(p.id) ?? 0 })),
              audit: [logEntry(old ? 'Reservation updated' : 'Reservation created', r.no), ...s.audit],
            }
          })
        },
        setReservationStatus: (id, status) => {
          const r = get().reservations.find((x) => x.id === id)
          if (r) get().saveReservation({ ...r, status })
        },
        saveSpecialOrder: (o) => set((s) => ({ specialOrders: upsert(s.specialOrders, o) })),
        saveSchoolList: (l) => set((s) => ({ schoolLists: upsert(s.schoolLists, l) })),
        deleteSchoolList: (id) => set((s) => ({ schoolLists: s.schoolLists.filter((x) => x.id !== id) })),
        saveBundle: (b) => set((s) => ({ bundles: upsert(s.bundles, b) })),
        deleteBundle: (id) => set((s) => ({ bundles: s.bundles.filter((x) => x.id !== id) })),
      }
    },
    {
      name: 'dinuda-bookshop-pos-v1',
      version: 1,
    },
  ),
)

/* ---------------- selectors / hooks ---------------- */

export const useCurrentUser = () => {
  const id = useStore((s) => s.currentUserId)
  const users = useStore((s) => s.users)
  return users.find((u) => u.id === id) ?? null
}

export const useCan = () => {
  const user = useCurrentUser()
  return (perm: Permission) => !!user && user.active && (user.permissions.includes(perm) || user.role === 'owner')
}

export const userName = (users: User[], id?: string) => users.find((u) => u.id === id)?.name ?? '—'

export { ALL_PERMISSIONS, addDays }
