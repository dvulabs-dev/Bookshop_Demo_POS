import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ClipboardPlus, Download, PackageX, ShoppingCart } from 'lucide-react'
import { useCan, useStore, userName } from '../store/useStore'
import { Badge, Card, Cover, Empty, Field, NumberInput, PageHeader, Pager, SearchBox, Stat, Tabs, usePaged } from '../components/ui'
import { ProductPicker } from '../components/LineEditor'
import { requestApproval, toast } from '../components/dialogs'
import { downloadCsv, fmtDate, fmtDateTime, lkr, num, uid } from '../lib/utils'
import { nextDocNo } from '../store/useStore'
import type { MovementType, Product } from '../types'

type Tab = 'reorder' | 'movements' | 'adjust' | 'valuation' | 'aging' | 'prices'

export default function Stock() {
  const can = useCan()
  const [tab, setTab] = useState<Tab>('reorder')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'reorder', label: 'Low stock & reorder' },
    { id: 'movements', label: 'Stock movements' },
    ...(can('adjustStock') ? [{ id: 'adjust' as Tab, label: 'Adjust stock' }] : []),
    { id: 'valuation', label: 'Valuation' },
    { id: 'aging', label: 'Stock aging' },
    ...(can('viewCost') ? [{ id: 'prices' as Tab, label: 'Price history' }] : []),
  ]
  return (
    <>
      <PageHeader title="Stock" subtitle="Know what is on the shelf, what is running out and what has stopped moving." />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'reorder' && <Reorder />}
      {tab === 'movements' && <Movements />}
      {tab === 'adjust' && <Adjust />}
      {tab === 'valuation' && <Valuation />}
      {tab === 'aging' && <Aging />}
      {tab === 'prices' && <Prices />}
    </>
  )
}

/* ---------------- reorder ---------------- */
function Reorder() {
  const nav = useNavigate()
  const can = useCan()
  const { products, suppliers, savePO, purchaseOrders, currentUserId } = useStore()
  const need = useMemo(
    () => products.filter((p) => p.status === 'active' && p.qty <= p.minStock).sort((a, b) => a.qty - b.qty),
    [products],
  )
  const suggest = (p: Product) => Math.max(p.minStock * 3 - p.qty, 1)
  const bySup = useMemo(() => {
    const m = new Map<string, Product[]>()
    need.forEach((p) => m.set(p.supplierId ?? '', [...(m.get(p.supplierId ?? '') ?? []), p]))
    return m
  }, [need])
  const out = need.filter((p) => p.qty === 0).length

  const createPO = (supplierId: string, items: Product[]) => {
    const no = nextDocNo('PO-', purchaseOrders.map((p) => p.no))
    savePO({
      id: uid('po'),
      no,
      supplierId,
      date: new Date().toISOString(),
      lines: items.map((p) => ({ productId: p.id, qty: suggest(p), received: 0, unitCost: p.cost, discount: 0 })),
      charges: 0,
      discount: 0,
      status: 'draft',
      payments: [],
      returns: [],
      createdBy: currentUserId ?? '',
      notes: 'Created from reorder suggestions',
    })
    toast.success(`Draft ${no} created for ${suppliers.find((s) => s.id === supplierId)?.name}`)
    nav('/purchasing')
  }

  return (
    <>
      <div className="grid cols-3">
        <Stat label="Items to reorder" value={need.length} icon={<AlertTriangle size={20} />} tone="amber" />
        <Stat label="Out of stock" value={out} icon={<PackageX size={20} />} tone="red" />
        <Stat label="Low stock" value={need.length - out} sub="At or below minimum level" icon={<AlertTriangle size={20} />} tone="amber" />
      </div>
      {need.length === 0 && <Card><Empty title="Everything is well stocked" /></Card>}
      {[...bySup.entries()].map(([sid, items]) => {
        const sup = suppliers.find((s) => s.id === sid)
        return (
          <Card
            key={sid}
            title={sup?.name ?? 'No supplier assigned'}
            pad={false}
            actions={
              can('purchasing') && sup ? (
                <button className="btn primary sm" onClick={() => createPO(sid, items)}>
                  <ClipboardPlus size={15} /> Create draft purchase order
                </button>
              ) : null
            }
          >
            <div className="tbl-wrap">
              <table className="table compact">
                <thead><tr><th>Product</th><th>Location</th><th className="r">On hand</th><th className="r">Minimum</th><th className="r">Suggested order</th><th>Status</th></tr></thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td><div className="row gap-s"><Cover product={p} size={30} /><b>{p.title}</b></div></td>
                      <td>{p.location}</td>
                      <td className="r"><b>{p.qty}</b></td>
                      <td className="r">{p.minStock}</td>
                      <td className="r">{suggest(p)} {p.unit}</td>
                      <td><Badge tone={p.qty === 0 ? 'red' : 'amber'}>{p.qty === 0 ? 'Out of stock' : 'Low stock'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}
    </>
  )
}

/* ---------------- movements ---------------- */
function Movements() {
  const { movements, products, users } = useStore()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const pm = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const rows = useMemo(
    () =>
      movements
        .filter((m) => (!type || m.type === type) && (!q || (pm.get(m.productId)?.title ?? '').toLowerCase().includes(q.toLowerCase()) || (m.ref ?? '').toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [movements, q, type, pm],
  )
  const pg = usePaged(rows, 15)
  return (
    <Card
      pad={false}
      title="Stock movement history"
      actions={
        <button className="btn sm" onClick={() => downloadCsv('stock-movements.csv', [['date', 'product', 'type', 'qty', 'ref', 'user', 'reason'], ...rows.map((m) => [m.date, pm.get(m.productId)?.title, m.type, m.qty, m.ref, userName(users, m.userId), m.reason])])}>
          <Download size={14} /> Export
        </button>
      }
    >
      <div className="filters">
        <div className="grow"><SearchBox value={q} onChange={setQ} placeholder="Search product or reference…" /></div>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All movement types</option>
          {['opening', 'purchase', 'sale', 'return', 'damage', 'lost', 'adjustment', 'supplier_return', 'void'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div className="tbl-wrap">
        <table className="table">
          <thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="r">Qty</th><th>Reference</th><th>User</th><th>Reason</th></tr></thead>
          <tbody>
            {pg.rows.map((m) => (
              <tr key={m.id}>
                <td>{fmtDateTime(m.date)}</td>
                <td>{pm.get(m.productId)?.title ?? '—'}</td>
                <td><Badge tone={m.qty > 0 ? 'green' : m.qty < 0 ? 'red' : 'gray'}>{m.type.replace('_', ' ')}</Badge></td>
                <td className="r"><b>{m.qty > 0 ? `+${m.qty}` : m.qty}</b></td>
                <td className="mono">{m.ref ?? '—'}</td>
                <td>{userName(users, m.userId)}</td>
                <td className="muted">{m.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager {...pg} />
    </Card>
  )
}

/* ---------------- adjust ---------------- */
function Adjust() {
  const { adjustStock, settings, products } = useStore()
  const can = useCan()
  const [p, setP] = useState<Product | null>(null)
  const [kind, setKind] = useState<'damage' | 'lost' | 'found' | 'count'>('damage')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const live = p ? products.find((x) => x.id === p.id)! : null

  const submit = async () => {
    if (!live || qty <= 0) return
    if (settings.finance.requireApprovalForAdjust && !can('overrideDiscount')) {
      const u = await requestApproval('adjustStock', `Approve adjusting stock of “${live.title}”.`)
      if (!u) return
    }
    let delta = 0
    let type: MovementType = 'adjustment'
    if (kind === 'damage') (delta = -qty), (type = 'damage')
    if (kind === 'lost') (delta = -qty), (type = 'lost')
    if (kind === 'found') (delta = qty), (type = 'adjustment')
    if (kind === 'count') (delta = qty - live.qty), (type = 'adjustment')
    if (delta === 0) return toast.info('Counted quantity equals current stock – no change')
    adjustStock(live.id, delta, type, reason || (kind === 'count' ? 'Stock-take count' : kind))
    toast.success(`Stock updated: ${live.title} (${delta > 0 ? '+' : ''}${delta})`)
    setReason('')
    setQty(1)
  }

  return (
    <Card title="Record a stock adjustment" actions={<span className="muted small">Every adjustment is logged with user, date and reason</span>}>
      <div className="grid cols-2">
        <div className="stack">
          <Field label="Product">{p ? (
            <div className="selected-product">
              <Cover product={p} size={36} />
              <div><b>{p.title}</b><small className="muted block">On hand: {live?.qty} {p.unit} • {p.location}</small></div>
              <button className="btn sm" onClick={() => setP(null)}>Change</button>
            </div>
          ) : <ProductPicker onPick={setP} autoFocus />}</Field>
          <Field label="Adjustment type">
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="damage">Damaged (reduce stock)</option>
              <option value="lost">Lost / stolen (reduce stock)</option>
              <option value="found">Found / correction (increase stock)</option>
              <option value="count">Stock-take: set counted quantity</option>
            </select>
          </Field>
        </div>
        <div className="stack">
          <Field label={kind === 'count' ? 'Counted quantity' : 'Quantity'}><NumberInput value={qty} min={kind === 'count' ? 0 : 1} onChange={setQty} /></Field>
          <Field label="Reason"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Water damage, stock-take correction" /></Field>
          <button className="btn primary" disabled={!p} onClick={submit}>Save adjustment</button>
        </div>
      </div>
    </Card>
  )
}

/* ---------------- valuation ---------------- */
function Valuation() {
  const { products, settings } = useStore()
  const can = useCan()
  const costOk = can('viewCost')
  const rows = useMemo(() => {
    const m = new Map<string, { cat: string; items: number; units: number; cost: number; retail: number }>()
    products.forEach((p) => {
      const r = m.get(p.category) ?? { cat: p.category, items: 0, units: 0, cost: 0, retail: 0 }
      r.items++
      r.units += p.qty
      r.cost += p.qty * p.cost
      r.retail += p.qty * p.price
      m.set(p.category, r)
    })
    return [...m.values()].sort((a, b) => b.retail - a.retail)
  }, [products])
  const tot = rows.reduce((a, r) => ({ items: a.items + r.items, units: a.units + r.units, cost: a.cost + r.cost, retail: a.retail + r.retail }), { items: 0, units: 0, cost: 0, retail: 0 })
  void settings
  return (
    <>
      <div className="grid cols-3">
        <Stat label="Products" value={num(tot.items)} />
        <Stat label="Units in stock" value={num(tot.units)} tone="blue" />
        <Stat label={costOk ? 'Stock value (at cost)' : 'Stock value (retail)'} value={lkr(costOk ? tot.cost : tot.retail, { decimals: false })} sub={costOk ? `Retail value ${lkr(tot.retail, { decimals: false })}` : undefined} tone="green" />
      </div>
      <Card title="Inventory valuation by category" pad={false}>
        <div className="tbl-wrap">
          <table className="table">
            <thead><tr><th>Category</th><th className="r">Products</th><th className="r">Units</th>{costOk && <th className="r">Value at cost</th>}<th className="r">Retail value</th>{costOk && <th className="r">Potential profit</th>}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cat}><td><b>{r.cat}</b></td><td className="r">{r.items}</td><td className="r">{num(r.units)}</td>{costOk && <td className="r">{lkr(r.cost)}</td>}<td className="r">{lkr(r.retail)}</td>{costOk && <td className="r">{lkr(r.retail - r.cost)}</td>}</tr>
              ))}
            </tbody>
            <tfoot><tr><td><b>Total</b></td><td className="r"><b>{tot.items}</b></td><td className="r"><b>{num(tot.units)}</b></td>{costOk && <td className="r"><b>{lkr(tot.cost)}</b></td>}<td className="r"><b>{lkr(tot.retail)}</b></td>{costOk && <td className="r"><b>{lkr(tot.retail - tot.cost)}</b></td>}</tr></tfoot>
          </table>
        </div>
      </Card>
    </>
  )
}

/* ---------------- aging ---------------- */
function Aging() {
  const { products, sales } = useStore()
  const can = useCan()
  const [days, setDays] = useState(30)
  const rows = useMemo(() => {
    const last = new Map<string, number>()
    sales.forEach((s) => {
      if (s.status === 'voided') return
      const t = new Date(s.date).getTime()
      s.lines.forEach((l) => last.set(l.productId, Math.max(last.get(l.productId) ?? 0, t)))
    })
    const now = Date.now()
    return products
      .filter((p) => p.qty > 0)
      .map((p) => ({ p, last: last.get(p.id), age: last.has(p.id) ? Math.floor((now - last.get(p.id)!) / 86400000) : 999 }))
      .filter((r) => r.age >= days)
      .sort((a, b) => b.age - a.age || b.p.qty * b.p.cost - a.p.qty * a.p.cost)
  }, [products, sales, days])
  const pg = usePaged(rows, 12)
  return (
    <Card
      title="Slow-moving stock"
      pad={false}
      actions={
        <select className="select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[7, 14, 30, 60].map((d) => <option key={d} value={d}>Unsold for {d}+ days</option>)}
        </select>
      }
    >
      <div className="tbl-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th>Category</th><th className="r">On hand</th>{can('viewCost') && <th className="r">Stock value</th>}<th>Last sold</th><th className="r">Days unsold</th></tr></thead>
          <tbody>
            {pg.rows.map(({ p, last, age }) => (
              <tr key={p.id}>
                <td><div className="row gap-s"><Cover product={p} size={30} /><b>{p.title}</b></div></td>
                <td>{p.category}</td>
                <td className="r">{p.qty}</td>
                {can('viewCost') && <td className="r">{lkr(p.qty * p.cost)}</td>}
                <td>{last ? fmtDate(new Date(last).toISOString()) : 'Never sold'}</td>
                <td className="r"><Badge tone={age >= 60 ? 'red' : age >= 30 ? 'amber' : 'gray'}>{age === 999 ? '—' : age}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="Nothing slow-moving" text={`Every product in stock has sold in the last ${days} days.`} />}
      </div>
      <Pager {...pg} />
    </Card>
  )
}

/* ---------------- price history ---------------- */
function Prices() {
  const { priceHistory, products, users } = useStore()
  const pm = new Map(products.map((p) => [p.id, p]))
  return (
    <Card title="Cost & selling price changes" pad={false}>
      <div className="tbl-wrap">
        <table className="table">
          <thead><tr><th>Date</th><th>Product</th><th className="r">Cost</th><th className="r">Selling price</th><th>Source</th><th>By</th></tr></thead>
          <tbody>
            {priceHistory.slice(0, 60).map((c) => (
              <tr key={c.id}><td>{fmtDateTime(c.date)}</td><td>{pm.get(c.productId)?.title}</td><td className="r">{lkr(c.cost)}</td><td className="r">{lkr(c.price)}</td><td>{c.source}</td><td>{userName(users, c.userId)}</td></tr>
            ))}
          </tbody>
        </table>
        {priceHistory.length === 0 && <Empty icon={<ShoppingCart size={26} />} title="No price changes recorded yet" text="Edit a product’s cost or price, or receive stock at a new cost, and the change is logged here." />}
      </div>
    </Card>
  )
}

