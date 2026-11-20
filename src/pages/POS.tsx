import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Banknote,
  Check,
  Clock,
  Minus,
  PauseCircle,
  Plus,
  ScanLine,
  ShoppingBag,
  Tag,
  Trash2,
  UserPlus,
  UserRound,
  X,
  PlayCircle,
  Gift,
  Lock,
} from 'lucide-react'
import { useCan, useCurrentUser, useStore } from '../store/useStore'
import { Badge, Card, Cover, Empty, Field, Modal, NumberInput, SearchBox, Segmented, Tabs } from '../components/ui'
import { confirmDialog, requestApproval, toast } from '../components/dialogs'
import { ReceiptModal } from '../components/Receipt'
import { PAY_LABEL, computeCart, discountAmount, shiftCashBreakdown } from '../lib/calc'
import { available, fmtTime, lkr, matchesProduct, normaliseIsbn, round2, stockState, uid } from '../lib/utils'
import { useT } from '../i18n'
import type { Customer, DiscountInput, PayMethod, Product, Sale, ToggleMethod } from '../types'

type FinderTab = 'frequent' | 'all' | 'packs'

export default function POS() {
  const t = useT()
  const nav = useNavigate()
  const user = useCurrentUser()
  const can = useCan()
  const s = useStore()
  const { products, customers, cart, settings, bundles, held, shifts, sales } = s
  const searchRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<FinderTab>('frequent')
  const [cat, setCat] = useState('All')
  const [discountOpen, setDiscountOpen] = useState<null | { line?: number }>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [custOpen, setCustOpen] = useState(false)
  const [heldOpen, setHeldOpen] = useState(false)
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [approvedBy, setApprovedBy] = useState<string | undefined>()
  const [priceEdit, setPriceEdit] = useState<number | null>(null)

  const customer = customers.find((c) => c.id === cart.customerId)
  const totals = useMemo(() => computeCart(cart.lines, products, cart.billDiscount, cart.redeemPoints, customer, settings), [cart, products, customer, settings])
  const myShift = shifts.find((sh) => !sh.closedAt && sh.cashierId === user?.id)
  const shiftInfo = useMemo(() => (myShift ? shiftCashBreakdown(myShift, s) : null), [myShift, s.sales, s.returns, s.expenses, s.customerPayments]) // eslint-disable-line react-hooks/exhaustive-deps

  const focusSearch = useCallback(() => setTimeout(() => searchRef.current?.focus(), 30), [])

  /* ---------- frequent products ---------- */
  const frequent = useMemo(() => {
    const since = Date.now() - 30 * 86400000
    const m = new Map<string, number>()
    sales.forEach((x) => {
      if (x.status === 'voided' || new Date(x.date).getTime() < since) return
      x.lines.forEach((l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty))
    })
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([id]) => products.find((p) => p.id === id)!).filter(Boolean)
  }, [sales, products])

  const results = useMemo(() => {
    const base = products.filter((p) => p.status !== 'discontinued')
    const hasQ = q.trim().length > 0
    const list = hasQ ? base.filter((p) => matchesProduct(p, q) || (q.replace(/\D/g, '').length === 10 && p.barcode === normaliseIsbn(q))) : tab === 'frequent' ? frequent : base
    const filtered = cat === 'All' || hasQ ? list : list.filter((p) => p.category === cat)
    return hasQ ? filtered.sort((a, b) => Number(b.title.toLowerCase().startsWith(q.toLowerCase())) - Number(a.title.toLowerCase().startsWith(q.toLowerCase()))).slice(0, 60) : filtered.slice(0, 80)
  }, [products, q, tab, cat, frequent])

  /* ---------- cart helpers ---------- */
  const addProduct = (p: Product, qty = 1) => {
    const inCart = cart.lines.find((l) => l.productId === p.id)?.qty ?? 0
    const avail = available(p)
    if (p.status === 'damaged') return toast.error(`${p.title} is marked as damaged`)
    if (avail <= 0) return toast.error(`${p.title} is out of stock`)
    if (inCart + qty > avail) {
      toast.error(`Only ${avail} available${p.reserved ? ` (${p.reserved} reserved)` : ''} – ${p.title}`)
      return
    }
    s.addToCart(p.id, qty)
    if (stockState(p) === 'low') toast.info(`Low stock: only ${p.qty - inCart - qty} left after this sale`)
  }

  const scan = (raw: string) => {
    const code = raw.trim()
    if (!code) return
    const isbn = normaliseIsbn(code)
    const exact = products.find((p) => p.barcode === code || p.barcode === isbn || p.isbn === code || p.isbn === isbn || p.code.toLowerCase() === code.toLowerCase())
    if (exact) {
      addProduct(exact)
      setQ('')
      return
    }
    const matches = products.filter((p) => matchesProduct(p, code) && p.status !== 'discontinued')
    if (matches.length === 1) {
      addProduct(matches[0])
      setQ('')
    } else if (matches.length === 0) toast.error(`No product found for “${code}”`)
  }

  const exceedsLimit = (lines = cart.lines, bd = cart.billDiscount) => {
    const tt = computeCart(lines, products, bd, cart.redeemPoints, customer, settings)
    const allowed = settings.pos.cashierDiscountPct + (customer?.discountPct ?? 0)
    return tt.effectivePct > allowed + 0.001
  }

  const ensureApproved = async (reason: string) => {
    if (can('overrideDiscount') || approvedBy) return true
    const u = await requestApproval('overrideDiscount', reason)
    if (u) {
      setApprovedBy(u.id)
      return true
    }
    return false
  }

  const setQty = (index: number, qty: number) => {
    const l = cart.lines[index]
    const p = products.find((x) => x.id === l.productId)!
    const avail = available(p)
    if (qty <= 0) return s.removeLine(index)
    if (qty > avail) {
      toast.error(`Only ${avail} available – ${p.title}`)
      qty = avail
    }
    s.setLine(index, { qty })
  }

  const applyPrice = async (index: number, price: number) => {
    const l = cart.lines[index]
    const p = products.find((x) => x.id === l.productId)!
    setPriceEdit(null)
    if (price === l.price || price < 0) return
    if (!can('overrideDiscount')) {
      const ok = await requestApproval('overrideDiscount', `Change the selling price of “${p.title}” from ${lkr(l.price)} to ${lkr(price)}.`)
      if (!ok) return
      setApprovedBy(ok.id)
    }
    s.setLine(index, { price })
  }

  const setCustomer = (c?: Customer) => {
    s.setCart({
      customerId: c?.id,
      redeemPoints: 0,
      billDiscount: c && c.discountPct > 0 ? { type: 'percent', value: c.discountPct } : { type: 'amount', value: 0 },
    })
    if (c && c.discountPct > 0) toast.info(`${c.group} discount of ${c.discountPct}% applied`)
    setCustOpen(false)
  }

  const addBundle = (id: string) => {
    const b = bundles.find((x) => x.id === id)
    if (!b) return
    const lines = b.lines.map((l) => ({ ...l, p: products.find((p) => p.id === l.productId)! }))
    for (const l of lines) {
      const inCart = cart.lines.find((x) => x.productId === l.productId)?.qty ?? 0
      if (l.p && inCart + l.qty > available(l.p)) return toast.error(`Not enough stock of “${l.p.title}” for this pack`)
    }
    const listTotal = lines.reduce((a, l) => a + l.p.price * l.qty, 0)
    const f = b.price / listTotal
    lines.forEach((l) => {
      s.addToCart(l.productId, l.qty)
    })
    // spread the bundle price: set unit price proportional for these lines
    const st = useStore.getState()
    st.cart.lines.forEach((cl, i) => {
      const bl = lines.find((x) => x.productId === cl.productId)
      if (bl && cl.price === bl.p.price) st.setLine(i, { price: round2(bl.p.price * f) })
    })
    toast.success(`“${b.name}” added at ${lkr(b.price)}`)
  }

  const startPay = async () => {
    if (!cart.lines.length) return
    if (exceedsLimit() && !(await ensureApproved(`The discount on this bill (${totals.effectivePct.toFixed(1)}%) is above your limit of ${settings.pos.cashierDiscountPct}%.`))) return
    setPayOpen(true)
  }

  const hold = async () => {
    if (!cart.lines.length) return
    if (!settings.pos.allowParking) return toast.error('Bill parking is disabled in settings')
    s.holdBill()
    setApprovedBy(undefined)
    toast.success('Bill parked – resume it from “Held bills”')
    focusSearch()
  }

  const clearBill = async () => {
    if (!cart.lines.length) return
    if (await confirmDialog({ title: 'Clear this bill?', message: 'All items will be removed from the current bill.', confirmLabel: 'Clear bill', danger: true })) {
      s.clearCart()
      setApprovedBy(undefined)
      focusSearch()
    }
  }

  // keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F2') (e.preventDefault(), searchRef.current?.focus())
      if (e.key === 'F8') (e.preventDefault(), hold())
      if (e.key === 'F9') (e.preventDefault(), startPay())
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  useEffect(() => {
    if (myShift || !settings.pos.requireShift) focusSearch()
  }, [myShift, settings.pos.requireShift, focusSearch])

  /* ---------- shift gate ---------- */
  if (settings.pos.requireShift && !myShift) return <ShiftGate />

  const categories = ['All', ...settings.inventory.categories]

  return (
    <div className="pos">
      <div className="pos-left">
        <div className="pos-bar">
          <div className="pos-search">
            <SearchBox
              value={q}
              onChange={setQ}
              inputRef={searchRef}
              onEnter={() => scan(q)}
              autoFocus
              placeholder={t('Scan barcode or search by title, author, ISBN or code…')}
            />
            <button className="btn primary" onClick={() => scan(q)} disabled={!q.trim()}>
              <ScanLine size={16} /> Add
            </button>
            <button
              className="btn"
              title="Demo helper: simulates a barcode scan"
              onClick={() => {
                const pool = products.filter((p) => available(p) > 0)
                const p = pool[Math.floor(Math.random() * pool.length)]
                scan(p.barcode)
              }}
            >
              Demo scan
            </button>
          </div>
          {myShift && (
            <div className="shift-chip" title="Open shift">
              <Clock size={14} /> Shift since {fmtTime(myShift.openedAt)} • {shiftInfo?.bills ?? 0} bills • Cash {lkr(shiftInfo?.expected ?? 0, { decimals: false })}
              {(shiftInfo?.expected ?? 0) < settings.finance.lowCashAlert && <Badge tone="red">Low cash</Badge>}
              <button className="link" onClick={() => nav('/cash')}>Manage</button>
            </div>
          )}
        </div>
        {q.trim() === '' && (
          <div className="row gap wrap">
            <Tabs
              value={tab}
              onChange={(v) => setTab(v)}
              tabs={[
                { id: 'frequent', label: 'Frequent' },
                { id: 'all', label: 'All products' },
                { id: 'packs', label: 'Packs & bundles', count: bundles.length },
              ]}
            />
          </div>
        )}
        {q.trim() === '' && tab !== 'packs' && (
          <div className="chips scroll">
            {categories.map((c) => (
              <button key={c} className={`chip btnlike ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
        )}

        {tab === 'packs' && q.trim() === '' ? (
          <div className="pos-grid">
            {bundles.map((b) => {
              const list = b.lines.reduce((a, l) => a + (products.find((p) => p.id === l.productId)?.price ?? 0) * l.qty, 0)
              return (
                <button key={b.id} className="pcard bundle" onClick={() => addBundle(b.id)}>
                  <div className="pcard-icon"><Gift size={22} /></div>
                  <b>{b.name}</b>
                  <small className="muted">{b.lines.length} items • {b.lines.map((l) => products.find((p) => p.id === l.productId)?.title.split(' ')[0]).join(', ')}</small>
                  <div className="pcard-foot">
                    <strong>{lkr(b.price, { decimals: false })}</strong>
                    <Badge tone="green">Save {lkr(Math.max(0, list - b.price), { decimals: false })}</Badge>
                  </div>
                </button>
              )
            })}
            {bundles.length === 0 && <Empty title="No packs yet" text="Create bundles in Orders & Quotes → Packs & school lists." />}
          </div>
        ) : results.length === 0 ? (
          <Empty title="No products found" text="Try a different title, author, ISBN or code." />
        ) : (
          <div className="pos-grid">
            {results.map((p) => {
              const st = stockState(p)
              const av = available(p)
              return (
                <button key={p.id} className={`pcard ${av <= 0 ? 'disabled' : ''}`} onClick={() => addProduct(p)}>
                  <div className="row gap-s">
                    <Cover product={p} size={44} />
                    <div className="pcard-title">{p.title}</div>
                  </div>
                  <small className="muted ellipsis">{p.author ?? p.brand ?? p.category} • {p.barcode}</small>
                  <div className="pcard-foot">
                    <strong>{lkr(p.price, { decimals: false })}</strong>
                    <Badge tone={st === 'out' ? 'red' : st === 'low' ? 'amber' : st === 'available' ? 'green' : 'gray'}>
                      {av <= 0 ? 'Out' : `${av} in stock`}
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ---------------- bill panel ---------------- */}
      <aside className="pos-right" id="pos-bill">
        <Card
          className="bill"
          pad={false}
          title={
            <span className="row gap-s">
              <ShoppingBag size={18} /> Current bill
              {cart.lines.length > 0 && <Badge tone="teal">{totals.items} items</Badge>}
            </span>
          }
          actions={
            <>
              <button className="btn sm" onClick={() => setHeldOpen(true)} title="Held / parked bills">
                <PauseCircle size={15} /> Held {held.length > 0 && <Badge tone="amber">{held.length}</Badge>}
              </button>
              <button className="icon-btn sm" onClick={clearBill} title="Clear bill" disabled={!cart.lines.length}>
                <Trash2 size={15} />
              </button>
            </>
          }
        >
          <div className="bill-customer">
            <button className="cust-btn" onClick={() => setCustOpen(true)}>
              <UserRound size={18} />
              <div>
                <b>{customer?.name ?? settings.pos.walkInLabel}</b>
                <small className="muted">
                  {customer ? `${customer.group} • ${customer.phone}${customer.balance > 0 ? ` • Owes ${lkr(customer.balance, { decimals: false })}` : ''}${settings.pos.loyaltyEnabled ? ` • ${customer.points} pts` : ''}` : 'Tap to select or register a customer'}
                </small>
              </div>
            </button>
            {customer && (
              <button className="icon-btn sm" onClick={() => setCustomer(undefined)} title="Remove customer">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="bill-lines">
            {cart.lines.length === 0 ? (
              <Empty icon={<ScanLine size={28} />} title="Scan or tap items to start a bill" text="Press F2 to focus the search box. Use a barcode scanner, or tap products on the left." />
            ) : (
              cart.lines.map((l, i) => {
                const p = products.find((x) => x.id === l.productId)!
                const lt = totals.lines[i]
                return (
                  <div key={l.productId} className="bill-line">
                    <div className="bl-main">
                      <Cover product={p} size={36} />
                      <div className="bl-info">
                        <b className="bl-title">{p.title}</b>
                        <div className="bl-sub">
                          {priceEdit === i ? null : (
                            <button
                              className="link"
                              disabled={!settings.pos.allowPriceEdit}
                              onClick={() => setPriceEdit(i)}
                              title={settings.pos.allowPriceEdit ? 'Edit unit price' : 'Price editing disabled'}
                            >
                              {lkr(l.price)}
                              {l.price !== p.price && <Badge tone="amber">edited</Badge>}
                            </button>
                          )}
                          {priceEdit !== i && <small className="muted">× {l.qty}</small>}
                          {lt.discount > 0 && <Badge tone="green">−{lkr(lt.discount, { decimals: false })}</Badge>}
                        </div>
                      </div>
                      <div className="bl-total">{lkr(lt.net)}</div>
                    </div>
                    {priceEdit === i && <PriceEditor value={l.price} onCancel={() => setPriceEdit(null)} onApply={(v) => applyPrice(i, v)} />}
                    <div className="bl-controls">
                      <div className="qty">
                        <button onClick={() => setQty(i, l.qty - 1)} aria-label="Decrease"><Minus size={14} /></button>
                        <input value={l.qty} inputMode="numeric" onChange={(e) => setQty(i, Number(e.target.value.replace(/\D/g, '')) || 0)} onFocus={(e) => e.target.select()} />
                        <button onClick={() => setQty(i, l.qty + 1)} aria-label="Increase"><Plus size={14} /></button>
                      </div>
                      <button className="btn sm ghost" onClick={() => setDiscountOpen({ line: i })}><Tag size={14} /> Discount</button>
                      <button className="icon-btn sm" onClick={() => s.removeLine(i)} aria-label="Remove"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="bill-totals">
            <div className="tl"><span>{t('Subtotal')}</span><b>{lkr(totals.subtotal)}</b></div>
            <div className="tl">
              <span>
                Bill discount
                {approvedBy && <Badge tone="green">approved</Badge>}
              </span>
              <button className="link" onClick={() => setDiscountOpen({})} disabled={!cart.lines.length}>
                {totals.billDiscount + totals.loyaltyDiscount > 0 ? `− ${lkr(totals.billDiscount + totals.loyaltyDiscount)}` : 'Add discount'}
              </button>
            </div>
            {settings.pos.taxPct > 0 && <div className="tl"><span>{settings.pos.taxLabel} ({settings.pos.taxPct}%)</span><b>{lkr(totals.tax)}</b></div>}
            {cart.advance > 0 && <div className="tl"><span>Advance / credit applied</span><b>− {lkr(Math.min(cart.advance, totals.total))}</b></div>}
            {exceedsLimit() && !can('overrideDiscount') && !approvedBy && (
              <div className="warn small"><Lock size={13} /> Discount above {settings.pos.cashierDiscountPct}% needs manager approval</div>
            )}
            <div className="tl grand"><span>{t('Total')}</span><strong>{lkr(Math.max(0, totals.total - cart.advance))}</strong></div>
          </div>
          <div className="bill-actions">
            <button className="btn lg" onClick={hold} disabled={!cart.lines.length} title="F8">
              <PauseCircle size={18} /> {t('Hold bill')}
            </button>
            <button className="btn primary lg grow" onClick={startPay} disabled={!cart.lines.length} title="F9">
              <Banknote size={18} /> {t('Pay now')} • {lkr(Math.max(0, totals.total - cart.advance), { decimals: false })}
            </button>
          </div>
        </Card>
      </aside>

      <button
        className="pos-fab"
        onClick={() => document.getElementById('pos-bill')?.scrollIntoView({ behavior: 'smooth' })}
      >
        <ShoppingBag size={18} /> {totals.items} items • {lkr(totals.total, { decimals: false })} — Review &amp; pay
      </button>

      {discountOpen && (
        <DiscountModal
          line={discountOpen.line}
          onClose={() => setDiscountOpen(null)}
          onApply={async (d) => {
            const lines = discountOpen.line != null ? cart.lines.map((l, i) => (i === discountOpen.line ? { ...l, discount: d } : l)) : cart.lines
            const bd = discountOpen.line != null ? cart.billDiscount : d
            const pct = computeCart(lines, products, bd, cart.redeemPoints, customer, settings).effectivePct
            const over = exceedsLimit(lines, bd)
            if (over && !(await ensureApproved(`This discount brings the bill to ${pct.toFixed(1)}% off, above the cashier limit of ${settings.pos.cashierDiscountPct}%.`))) return
            if (discountOpen.line != null) s.setLine(discountOpen.line, { discount: d })
            else s.setCart({ billDiscount: d })
            setDiscountOpen(null)
          }}
        />
      )}
      {custOpen && <CustomerPicker onClose={() => setCustOpen(false)} onPick={setCustomer} />}
      {heldOpen && <HeldModal onClose={() => setHeldOpen(false)} />}
      {payOpen && (
        <PaymentModal
          customer={customer}
          onClose={() => setPayOpen(false)}
          approvedBy={approvedBy}
          onDone={(sale) => {
            setPayOpen(false)
            setApprovedBy(undefined)
            setReceipt(sale)
          }}
        />
      )}
      {receipt && (
        <ReceiptModal
          sale={receipt}
          title="Sale complete ✓"
          onClose={() => {
            setReceipt(null)
            setQ('')
            focusSearch()
          }}
        />
      )}
    </div>
  )
}

/* ====================================================== */

function PriceEditor({ value, onApply, onCancel }: { value: number; onApply: (v: number) => void; onCancel: () => void }) {
  const [v, setV] = useState(value)
  return (
    <div className="price-edit">
      <NumberInput autoFocus value={v} onChange={setV} step={0.5} />
      <button className="btn sm primary" onClick={() => onApply(v)}><Check size={14} /> Set price</button>
      <button className="btn sm" onClick={onCancel}>Cancel</button>
    </div>
  )
}

function ShiftGate() {
  const openShift = useStore((s) => s.openShift)
  const [cash, setCash] = useState(5000)
  const user = useCurrentUser()
  return (
    <div className="center-card">
      <Card>
        <div className="stack">
          <div className="empty-icon"><Clock size={28} /></div>
          <h2>Open your cashier shift</h2>
          <p className="muted">
            Hi {user?.name.split(' ')[0]} — count the cash in the drawer and enter the opening float. Sales made in this shift are reconciled when you close it.
          </p>
          <Field label="Opening cash in drawer (Rs.)">
            <NumberInput value={cash} onChange={setCash} autoFocus />
          </Field>
          <button
            className="btn primary lg block"
            onClick={() => {
              openShift(cash)
              toast.success('Shift opened – happy selling!')
            }}
          >
            Open shift &amp; start selling
          </button>
        </div>
      </Card>
    </div>
  )
}

function DiscountModal({ line, onClose, onApply }: { line?: number; onClose: () => void; onApply: (d: DiscountInput) => void }) {
  const { cart, products, settings } = useStore()
  const can = useCan()
  const current = line != null ? cart.lines[line].discount : cart.billDiscount
  const [type, setType] = useState<'amount' | 'percent'>(current.type)
  const [value, setValue] = useState(current.value)
  const l = line != null ? cart.lines[line] : null
  const p = l ? products.find((x) => x.id === l.productId) : null
  const base = l ? l.qty * l.price : computeCart(cart.lines, products, { type: 'amount', value: 0 }, 0, undefined, settings).subtotal
  const amt = discountAmount({ type, value }, base)
  const pct = base > 0 ? (amt / base) * 100 : 0
  const limit = settings.pos.cashierDiscountPct
  return (
    <Modal
      title={l ? `Discount – ${p?.title}` : 'Bill discount'}
      subtitle={`Cashier limit ${limit}%. Higher discounts need manager approval.`}
      width={440}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={() => onApply({ type: 'amount', value: 0 })}>Remove discount</button>
          <button className="btn primary" onClick={() => onApply({ type, value })}>Apply discount</button>
        </>
      }
    >
      <div className="stack">
        <Segmented value={type} onChange={setType} options={[{ id: 'amount', label: 'Fixed amount (Rs.)' }, { id: 'percent', label: 'Percentage (%)' }]} />
        <Field label={type === 'amount' ? 'Discount amount (Rs.)' : 'Discount (%)'}>
          <NumberInput value={value} onChange={setValue} autoFocus step={type === 'percent' ? 1 : 10} />
        </Field>
        {type === 'percent' && (
          <div className="chips">
            {[5, 10, 15, 20].map((n) => (
              <button key={n} className="chip btnlike" onClick={() => setValue(n)}>{n}%</button>
            ))}
          </div>
        )}
        <div className="summary-box">
          <div className="tl"><span>Base amount</span><b>{lkr(base)}</b></div>
          <div className="tl"><span>Discount</span><b>− {lkr(amt)} ({pct.toFixed(1)}%)</b></div>
          <div className="tl"><span>After discount</span><b>{lkr(base - amt)}</b></div>
        </div>
        {pct > limit && !can('overrideDiscount') && <div className="warn"><Lock size={14} /> This is above your {limit}% limit — a manager PIN will be requested when you apply.</div>}
      </div>
    </Modal>
  )
}

function CustomerPicker({ onClose, onPick }: { onClose: () => void; onPick: (c?: Customer) => void }) {
  const { customers, saveCustomer } = useStore()
  const can = useCan()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', phone: '' })
  const list = customers.filter((c) => !q || [c.name, c.phone, c.code].some((x) => x.toLowerCase().includes(q.toLowerCase()))).slice(0, 30)
  return (
    <Modal title="Select customer" onClose={onClose} width={520}>
      <div className="stack">
        <div className="row gap">
          <div className="grow"><SearchBox value={q} onChange={setQ} placeholder="Search by name, phone or customer ID" autoFocus /></div>
          {can('customers') && <button className="btn" onClick={() => setAdding((a) => !a)}><UserPlus size={16} /> New</button>}
        </div>
        {adding && (
          <div className="summary-box stack">
            <div className="grid cols-2">
              <Field label="Name" required><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Phone" required><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            </div>
            <button
              className="btn primary"
              disabled={!f.name.trim() || !f.phone.trim()}
              onClick={() => {
                const n = customers.length + 1
                const c: Customer = { id: uid('c'), code: `CUS-${String(n).padStart(4, '0')}`, name: f.name.trim(), phone: f.phone.trim(), group: 'Regular', discountPct: 0, points: 0, balance: 0, deposit: 0, creditLimit: 0, contactPref: 'WhatsApp', createdAt: new Date().toISOString() }
                saveCustomer(c)
                toast.success('Customer registered')
                onPick(c)
              }}
            >
              Register &amp; select
            </button>
          </div>
        )}
        <button className="list-row" onClick={() => onPick(undefined)}>
          <span className="row gap-s"><UserRound size={18} /> Walk-in customer (no registration)</span>
        </button>
        <div className="list scroll-y">
          {list.map((c) => (
            <button key={c.id} className="list-row" onClick={() => onPick(c)}>
              <span>
                <b>{c.name}</b>
                <small className="muted block">{c.code} • {c.phone} • {c.group}</small>
              </span>
              <span className="right-col">
                {c.balance > 0 && <Badge tone="amber">Owes {lkr(c.balance, { decimals: false })}</Badge>}
                {c.deposit > 0 && <Badge tone="blue">Credit {lkr(c.deposit, { decimals: false })}</Badge>}
                {c.discountPct > 0 && <Badge tone="green">{c.discountPct}% off</Badge>}
              </span>
            </button>
          ))}
          {list.length === 0 && <p className="muted">No customers match “{q}”.</p>}
        </div>
      </div>
    </Modal>
  )
}

function HeldModal({ onClose }: { onClose: () => void }) {
  const { held, resumeBill, deleteHeld, cart, products, users } = useStore()
  return (
    <Modal title="Held bills" subtitle="Parked bills can be resumed at any time" onClose={onClose} width={520}>
      {held.length === 0 && <Empty title="No held bills" />}
      <div className="list">
        {held.map((h) => {
          const total = h.lines.reduce((a, l) => a + l.qty * l.price, 0)
          return (
            <div key={h.id} className="list-row static">
              <span>
                <b>{h.lines.length} lines • {lkr(total, { decimals: false })}</b>
                <small className="muted block">
                  {fmtTime(h.date)} • {users.find((u) => u.id === h.cashierId)?.name} • {h.lines.slice(0, 2).map((l) => products.find((p) => p.id === l.productId)?.title.slice(0, 18)).join(', ')}
                  {h.lines.length > 2 ? '…' : ''}
                </small>
              </span>
              <span className="row gap-s">
                <button
                  className="btn sm primary"
                  onClick={async () => {
                    if (cart.lines.length && !(await confirmDialog({ title: 'Replace current bill?', message: 'The current bill will be replaced by the held bill. Park it first if you need it later.', confirmLabel: 'Replace' }))) return
                    resumeBill(h.id)
                    onClose()
                  }}
                >
                  <PlayCircle size={14} /> Resume
                </button>
                <button className="icon-btn sm" onClick={() => deleteHeld(h.id)}><Trash2 size={14} /></button>
              </span>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

interface PayRow {
  id: string
  method: ToggleMethod
  amount: number
  ref: string
}

function PaymentModal({ customer, onClose, onDone, approvedBy }: { customer?: Customer; onClose: () => void; onDone: (s: Sale) => void; approvedBy?: string }) {
  const { cart, products, settings, setCart, completeSale } = useStore()
  const can = useCan()
  const totals = computeCart(cart.lines, products, cart.billDiscount, cart.redeemPoints, customer, settings)
  const due = round2(Math.max(0, totals.total - cart.advance))
  const enabled = (Object.keys(settings.pos.methods) as ToggleMethod[]).filter((m) => settings.pos.methods[m] && (m !== 'storeCredit' || (customer?.deposit ?? 0) > 0))
  const [rows, setRows] = useState<PayRow[]>([{ id: uid('r'), method: enabled.includes('cash') ? 'cash' : enabled[0], amount: due, ref: '' }])
  const [busy, setBusy] = useState(false)

  // keep first row in sync with due when only one row and loyalty redemption changes the total
  useEffect(() => {
    setRows((r) => (r.length === 1 ? [{ ...r[0], amount: due }] : r))
  }, [due])

  const noncash = rows.filter((r) => r.method !== 'cash')
  const ncTotal = round2(noncash.reduce((a, r) => a + r.amount, 0))
  const cashRows = rows.filter((r) => r.method === 'cash')
  const tendered = round2(cashRows.reduce((a, r) => a + r.amount, 0))
  const cashDue = Math.max(0, round2(due - ncTotal))
  const cashApplied = Math.min(tendered, cashDue)
  const change = round2(Math.max(0, tendered - cashApplied))
  const applied = round2(ncTotal + cashApplied)
  const balance = round2(due - applied)
  const over = ncTotal > due + 0.001
  const scErr = rows.some((r) => r.method === 'storeCredit' && r.amount > (customer?.deposit ?? 0) + 0.001)

  let creditErr = ''
  if (balance > 0.009) {
    if (!settings.pos.allowCredit) creditErr = 'Credit / part-payment sales are disabled in settings.'
    else if (!customer) creditErr = 'Select a registered customer to leave a balance (credit).'
    else if (customer.creditLimit <= 0) creditErr = `${customer.name} has no credit limit. Enable credit on the customer profile.`
    else if (customer.balance + balance > customer.creditLimit) creditErr = `Credit limit exceeded (limit ${lkr(customer.creditLimit, { decimals: false })}, already owes ${lkr(customer.balance, { decimals: false })}).`
  }
  const maxRedeem = customer && settings.pos.loyaltyEnabled ? Math.min(customer.points, Math.floor(Math.max(0, totals.subtotal - totals.billDiscount) / settings.pos.pointValue)) : 0

  const submit = async () => {
    if (busy) return
    setBusy(true)
    let approver = approvedBy
    if (balance > 0.009 && !can('credit')) {
      const u = await requestApproval('credit', `Leave ${lkr(balance)} unpaid on this bill as credit for ${customer?.name}.`)
      if (!u) return setBusy(false)
      approver = approver ?? u.id
    }
    const payments = [
      ...noncash.filter((r) => r.amount > 0).map((r) => ({ method: r.method as PayMethod, amount: r.amount, ref: r.ref || undefined })),
      ...(cashApplied > 0 ? [{ method: 'cash' as PayMethod, amount: cashApplied }] : []),
    ]
    const sale = completeSale({ payments, tendered: tendered > 0 ? tendered : undefined, approvedBy: approver })
    setBusy(false)
    if (sale) {
      toast.success(`Sale ${sale.no} completed`)
      onDone(sale)
    }
  }

  const addSplit = () => {
    const nextM = enabled.find((m) => !rows.some((r) => r.method === m)) ?? enabled[0]
    if (rows.length === 1) {
      const half = Math.round(due / 2 / 10) * 10
      setRows([{ ...rows[0], amount: half }, { id: uid('r'), method: nextM, amount: round2(due - half), ref: '' }])
    } else setRows([...rows, { id: uid('r'), method: nextM, amount: Math.max(0, balance), ref: '' }])
  }

  const quick = [due, ...[500, 1000, 2000, 5000].filter((v) => v >= due)].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 5)

  return (
    <Modal
      title="Take payment"
      subtitle={customer ? `Customer: ${customer.name}` : settings.pos.walkInLabel}
      width={640}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Back</button>
          <button className="btn primary lg" disabled={busy || over || scErr || !!creditErr} onClick={submit}>
            <Check size={18} /> {balance > 0.009 ? `Complete – ${lkr(balance, { decimals: false })} on credit` : 'Complete sale'}
          </button>
        </>
      }
    >
      <div className="pay-grid">
        <div className="pay-total">
          <small>Amount due</small>
          <strong>{lkr(due)}</strong>
          {cart.advance > 0 && <small className="muted">After {lkr(Math.min(cart.advance, totals.total))} advance/credit</small>}
          {totals.totalDiscount > 0 && <Badge tone="green">Discount {lkr(totals.totalDiscount)}</Badge>}
        </div>
        <div className="stack">
          {rows.map((r, idx) => (
            <div key={r.id} className="pay-row">
              <select className="select" value={r.method} onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, method: e.target.value as ToggleMethod } : x)))}>
                {enabled.map((m) => <option key={m} value={m}>{PAY_LABEL[m]}</option>)}
              </select>
              <NumberInput value={r.amount} onChange={(n) => setRows(rows.map((x) => (x.id === r.id ? { ...x, amount: n } : x)))} step={10} autoFocus={idx === 0} />
              {r.method !== 'cash' && (
                <input className="input" placeholder={r.method === 'card' ? 'Card last 4 / ref' : 'Reference no.'} value={r.ref} onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, ref: e.target.value } : x)))} />
              )}
              {rows.length > 1 && <button className="icon-btn sm" onClick={() => setRows(rows.filter((x) => x.id !== r.id))}><X size={14} /></button>}
            </div>
          ))}
          {rows.some((r) => r.method === 'cash') && (
            <div className="chips">
              {quick.map((v) => (
                <button key={v} className="chip btnlike" onClick={() => setRows(rows.map((x, i) => (x.method === 'cash' && i === rows.findIndex((y) => y.method === 'cash') ? { ...x, amount: v } : x)))}>
                  {v === due ? 'Exact' : lkr(v, { decimals: false, symbol: false })}
                </button>
              ))}
            </div>
          )}
          <button className="btn sm" onClick={addSplit}>
            <Plus size={14} /> Split payment (add method)
          </button>
          {maxRedeem > 0 && (
            <Field label={`Redeem loyalty points (available ${customer?.points}, 1 pt = ${lkr(settings.pos.pointValue, { decimals: false })})`}>
              <NumberInput value={cart.redeemPoints} max={maxRedeem} onChange={(n) => setCart({ redeemPoints: n })} />
            </Field>
          )}
          <Field label="Bill note (optional)"><input className="input" value={cart.note} onChange={(e) => setCart({ note: e.target.value })} placeholder="e.g. Deliver to school office" /></Field>
        </div>
        <div className="summary-box">
          <div className="tl"><span>Paid now</span><b>{lkr(applied)}</b></div>
          {tendered > 0 && <div className="tl"><span>Cash tendered</span><b>{lkr(tendered)}</b></div>}
          <div className="tl change"><span>Change to return</span><strong>{lkr(change)}</strong></div>
          <div className="tl"><span>Balance (credit)</span><b className={balance > 0.009 ? 'red-text' : ''}>{lkr(Math.max(0, balance))}</b></div>
        </div>
        {over && <p className="error-text">Card / transfer amounts exceed the amount due.</p>}
        {scErr && <p className="error-text">Store credit used exceeds the customer’s available credit ({lkr(customer?.deposit ?? 0)}).</p>}
        {creditErr && <p className="error-text">{creditErr}</p>}
        {balance > 0.009 && !creditErr && !can('credit') && <p className="warn small"><Lock size={13} /> Credit sale requires manager approval.</p>}
      </div>
    </Modal>
  )
}
