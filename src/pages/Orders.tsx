import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Copy, FileText, Gift, GraduationCap, MessageCircle, Plus, Printer, ShoppingCart, Trash2 } from 'lucide-react'
import { nextDocNo, useCan, useStore } from '../store/useStore'
import { Badge, Card, Empty, Field, Modal, NumberInput, PageHeader, Stat, Tabs, type Tone } from '../components/ui'
import { LineEditor, type EditLine } from '../components/LineEditor'
import { DocPrintModal, type DocPrintData } from '../components/DocPrint'
import { confirmDialog, toast } from '../components/dialogs'
import { addDays, available, fmtDate, lkr, startOfDay, toInputDate, uid } from '../lib/utils'
import type { Bundle, Quotation, Reservation, SchoolList, SpecialOrder, SpecialOrderStatus } from '../types'

type Tab = 'quotes' | 'reservations' | 'special' | 'lists'

const SO_FLOW: SpecialOrderStatus[] = ['requested', 'supplier_ordered', 'received', 'customer_notified', 'completed']
const SO_LABEL: Record<SpecialOrderStatus, string> = { requested: 'Requested', supplier_ordered: 'Supplier ordered', received: 'Received', customer_notified: 'Customer notified', completed: 'Completed', cancelled: 'Cancelled' }
const SO_TONE: Record<SpecialOrderStatus, Tone> = { requested: 'gray', supplier_ordered: 'blue', received: 'amber', customer_notified: 'purple', completed: 'green', cancelled: 'red' }

export default function Orders() {
  const { quotations, reservations, specialOrders, schoolLists, bundles } = useStore()
  const [tab, setTab] = useState<Tab>('quotes')
  const [seedQuote, setSeedQuote] = useState<Quotation | null>(null)
  const today = startOfDay()
  const overdueRes = reservations.filter((r) => r.status === 'active' && new Date(r.until) < today).length
  const openQ = quotations.filter((q) => ['draft', 'sent', 'approved'].includes(q.status) && new Date(q.validUntil) >= today).length
  const openSO = specialOrders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length
  return (
    <>
      <PageHeader title="Orders & Quotes" subtitle="Quotations, reservations, special book orders, school lists and packs" />
      <div className="grid cols-4">
        <Stat label="Open quotations" value={openQ} tone="blue" icon={<FileText size={20} />} />
        <Stat label="Active reservations" value={reservations.filter((r) => r.status === 'active').length} tone="teal" />
        <Stat label="Overdue reservations" value={overdueRes} tone={overdueRes ? 'red' : 'green'} sub="Contact customers" />
        <Stat label="Open special orders" value={openSO} tone="amber" />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'quotes', label: 'Quotations', count: quotations.length },
          { id: 'reservations', label: 'Reservations', count: reservations.length },
          { id: 'special', label: 'Special orders', count: specialOrders.length },
          { id: 'lists', label: 'School lists & packs', count: schoolLists.length + bundles.length },
        ]}
      />
      {tab === 'quotes' && <Quotes seed={seedQuote} clearSeed={() => setSeedQuote(null)} />}
      {tab === 'reservations' && <Reservations />}
      {tab === 'special' && <Special />}
      {tab === 'lists' && <ListsAndPacks onQuote={(q) => { setSeedQuote(q); setTab('quotes') }} />}
    </>
  )
}

/* ---------- shared: customer fields ---------- */
function CustomerFields({ customerId, name, phone, onChange }: { customerId?: string; name: string; phone?: string; onChange: (v: { customerId?: string; name: string; phone?: string }) => void }) {
  const customers = useStore((s) => s.customers)
  return (
    <div className="grid cols-3">
      <Field label="Registered customer">
        <select className="select" value={customerId ?? ''} onChange={(e) => { const c = customers.find((x) => x.id === e.target.value); onChange(c ? { customerId: c.id, name: c.name, phone: c.phone } : { customerId: undefined, name, phone }) }}>
          <option value="">— Not registered —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Customer name" required><input className="input" value={name} onChange={(e) => onChange({ customerId, name: e.target.value, phone })} /></Field>
      <Field label="Phone"><input className="input" value={phone ?? ''} onChange={(e) => onChange({ customerId, name, phone: e.target.value })} /></Field>
    </div>
  )
}

/* ============================ Quotations ============================ */
function Quotes({ seed, clearSeed }: { seed: Quotation | null; clearSeed: () => void }) {
  const nav = useNavigate()
  const can = useCan()
  const { quotations, products, saveQuotation, loadLines } = useStore()
  const [edit, setEdit] = useState<Quotation | null>(seed)
  const [print, setPrint] = useState<DocPrintData | null>(null)
  const today = startOfDay()
  const eff = (q: Quotation) => (['draft', 'sent', 'approved'].includes(q.status) && new Date(q.validUntil) < today ? 'expired' : q.status)
  const tone = (s: string): Tone => (s === 'converted' ? 'green' : s === 'approved' ? 'teal' : s === 'sent' ? 'blue' : s === 'expired' || s === 'cancelled' ? 'red' : 'gray')
  const total = (q: Quotation) => q.lines.reduce((a, l) => a + l.qty * l.price, 0) - q.discount

  const newQuote = (): Quotation => ({ id: uid('q'), no: nextDocNo('QT-', quotations.map((q) => q.no)), customerName: '', date: new Date().toISOString(), validUntil: addDays(new Date(), 14).toISOString(), lines: [], discount: 0, status: 'draft' })
  const convert = (q: Quotation) => {
    const short = q.lines.find((l) => available(products.find((p) => p.id === l.productId)!) < l.qty)
    if (short) return toast.error(`Not enough stock for “${products.find((p) => p.id === short.productId)?.title}”`)
    saveQuotation({ ...q, status: 'converted' })
    loadLines(q.lines, { customerId: q.customerId, billDiscount: { type: 'amount', value: q.discount }, note: `From quotation ${q.no}` })
    toast.success(`${q.no} loaded into POS`)
    nav('/pos')
  }
  const printQ = (q: Quotation) =>
    setPrint({
      title: 'QUOTATION',
      number: q.no,
      date: fmtDate(q.date),
      meta: [{ label: 'PREPARED FOR', lines: [q.customerName, q.phone ?? ''] }, { label: 'VALID UNTIL', lines: [fmtDate(q.validUntil)] }],
      columns: [{ label: '#' }, { label: 'Item' }, { label: 'Qty', align: 'r' }, { label: 'Unit price', align: 'r' }, { label: 'Amount', align: 'r' }],
      rows: q.lines.map((l, i) => [i + 1, products.find((p) => p.id === l.productId)?.title ?? '', l.qty, lkr(l.price), lkr(l.qty * l.price)]),
      totals: [{ label: 'Subtotal', value: lkr(q.lines.reduce((a, l) => a + l.qty * l.price, 0)) }, { label: 'Discount', value: `− ${lkr(q.discount)}` }, { label: 'Total', value: lkr(total(q)), bold: true }],
      notes: [q.note ?? '', 'Prices are subject to stock availability. This quotation is not a tax invoice.'].filter(Boolean),
    })

  return (
    <>
      <Card
        title="Quotations"
        pad={false}
        actions={can('orders') && <button className="btn primary sm" onClick={() => setEdit(newQuote())}><Plus size={15} /> New quotation</button>}
      >
        <div className="tbl-wrap">
          <table className="table">
            <thead><tr><th>Quotation</th><th>Customer</th><th>Date</th><th>Valid until</th><th className="r">Total</th><th>Status</th><th /></tr></thead>
            <tbody>
              {[...quotations].sort((a, b) => b.date.localeCompare(a.date)).map((q) => (
                <tr key={q.id} className="clickable" onClick={() => setEdit(q)}>
                  <td><b>{q.no}</b></td>
                  <td>{q.customerName}</td>
                  <td>{fmtDate(q.date)}</td>
                  <td>{fmtDate(q.validUntil)}</td>
                  <td className="r">{lkr(total(q))}</td>
                  <td><Badge tone={tone(eff(q))}>{eff(q)}</Badge></td>
                  <td className="r" onClick={(e) => e.stopPropagation()}>
                    {['draft', 'sent', 'approved'].includes(eff(q)) && can('pos') && <button className="btn sm" onClick={() => convert(q)}><ShoppingCart size={14} /> Convert to sale</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {quotations.length === 0 && <Empty title="No quotations yet" />}
        </div>
      </Card>
      {edit && (
        <Modal
          title={`Quotation ${edit.no}`}
          width={860}
          onClose={() => { setEdit(null); clearSeed() }}
          footer={
            <>
              <button className="btn" onClick={() => printQ(edit)} disabled={!edit.lines.length}><Printer size={15} /> Print</button>
              <span className="grow" />
              {edit.status !== 'converted' && edit.status !== 'cancelled' && edit.lines.length > 0 && can('pos') && <button className="btn" onClick={() => { saveQuotation(edit); convert(edit); setEdit(null) }}><ShoppingCart size={15} /> Convert to sale</button>}
              <button className="btn primary" disabled={!edit.customerName.trim() || !edit.lines.length} onClick={() => { saveQuotation(edit); toast.success('Quotation saved'); setEdit(null); clearSeed() }}>Save quotation</button>
            </>
          }
        >
          <div className="stack">
            <CustomerFields customerId={edit.customerId} name={edit.customerName} phone={edit.phone} onChange={(v) => setEdit({ ...edit, customerId: v.customerId, customerName: v.name, phone: v.phone })} />
            <div className="grid cols-3">
              <Field label="Valid until"><input className="input" type="date" value={toInputDate(edit.validUntil)} onChange={(e) => setEdit({ ...edit, validUntil: new Date(e.target.value + 'T23:59:00').toISOString() })} /></Field>
              <Field label="Status">
                <select className="select" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Quotation['status'] })}>
                  {['draft', 'sent', 'approved', 'converted', 'cancelled'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Discount (Rs.)"><NumberInput value={edit.discount} onChange={(n) => setEdit({ ...edit, discount: n })} /></Field>
            </div>
            <LineEditor lines={edit.lines} onChange={(lines) => setEdit({ ...edit, lines })} />
            <Field label="Note"><input className="input" value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
            <div className="summary-box"><div className="tl"><span>Quotation total</span><strong>{lkr(total(edit))}</strong></div></div>
          </div>
        </Modal>
      )}
      {print && <DocPrintModal doc={print} onClose={() => setPrint(null)} />}
    </>
  )
}

/* ============================ Reservations ============================ */
function Reservations() {
  const nav = useNavigate()
  const { reservations, products, saveReservation, setReservationStatus, loadLines } = useStore()
  const [edit, setEdit] = useState<Reservation | null>(null)
  const today = startOfDay()
  const total = (r: Reservation) => r.lines.reduce((a, l) => a + l.qty * l.price, 0)
  const od = (r: Reservation) => r.status === 'active' && new Date(r.until) < today

  const save = () => {
    if (!edit) return
    const old = reservations.find((r) => r.id === edit.id)
    for (const l of edit.lines) {
      const p = products.find((x) => x.id === l.productId)!
      const mine = old?.status === 'active' ? old.lines.find((x) => x.productId === l.productId)?.qty ?? 0 : 0
      if (l.qty > available(p) + mine) return toast.error(`Only ${available(p) + mine} available for “${p.title}”`)
    }
    saveReservation(edit)
    toast.success(`${edit.no} saved – stock reserved`)
    setEdit(null)
  }
  const collect = (r: Reservation) => {
    setReservationStatus(r.id, 'collected')
    loadLines(r.lines, { customerId: r.customerId, advance: r.advance, advanceRef: `Advance ${r.no}`, note: `Reservation ${r.no}` })
    toast.success('Reservation loaded into POS with advance applied')
    nav('/pos')
  }

  return (
    <>
      <Card title="Reserved stock" pad={false} actions={<button className="btn primary sm" onClick={() => setEdit({ id: uid('r'), no: nextDocNo('RS-', reservations.map((r) => r.no)), customerName: '', date: new Date().toISOString(), until: addDays(new Date(), 7).toISOString(), lines: [], advance: 0, status: 'active' })}><Plus size={15} /> New reservation</button>}>
        <div className="tbl-wrap">
          <table className="table">
            <thead><tr><th>Reservation</th><th>Customer</th><th>Items</th><th>Hold until</th><th className="r">Value</th><th className="r">Advance</th><th>Status</th><th /></tr></thead>
            <tbody>
              {[...reservations].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setEdit(r)}>
                  <td><b>{r.no}</b></td>
                  <td>{r.customerName}<small className="muted block">{r.phone}</small></td>
                  <td className="muted">{r.lines.map((l) => `${l.qty}× ${products.find((p) => p.id === l.productId)?.title}`).join(', ').slice(0, 50)}…</td>
                  <td><Badge tone={od(r) ? 'red' : 'gray'}>{od(r) ? 'Overdue ' : ''}{fmtDate(r.until)}</Badge></td>
                  <td className="r">{lkr(total(r))}</td>
                  <td className="r">{r.advance > 0 ? lkr(r.advance) : '—'}</td>
                  <td><Badge tone={r.status === 'active' ? 'blue' : r.status === 'collected' ? 'green' : 'gray'}>{r.status}</Badge></td>
                  <td className="r" onClick={(e) => e.stopPropagation()}>
                    {r.status === 'active' && (
                      <>
                        <button className="btn sm" onClick={() => collect(r)}>Collect &amp; bill</button>{' '}
                        <button className="btn sm ghost" onClick={async () => { if (await confirmDialog({ title: 'Cancel reservation?', message: 'The reserved stock will be released. Remember to refund any advance.', confirmLabel: 'Cancel reservation', danger: true })) setReservationStatus(r.id, 'cancelled') }}>Cancel</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {edit && (
        <Modal title={`Reservation ${edit.no}`} subtitle="Reserved quantity is held back from available stock" width={820} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Close</button><button className="btn primary" disabled={!edit.customerName.trim() || !edit.lines.length} onClick={save}>Save reservation</button></>}>
          <div className="stack">
            <CustomerFields customerId={edit.customerId} name={edit.customerName} phone={edit.phone} onChange={(v) => setEdit({ ...edit, customerId: v.customerId, customerName: v.name, phone: v.phone })} />
            <div className="grid cols-3">
              <Field label="Hold until"><input className="input" type="date" value={toInputDate(edit.until)} onChange={(e) => setEdit({ ...edit, until: new Date(e.target.value + 'T23:59:00').toISOString() })} /></Field>
              <Field label="Advance payment (Rs.)"><NumberInput value={edit.advance} onChange={(n) => setEdit({ ...edit, advance: n })} /></Field>
              <Field label="Note"><input className="input" value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
            </div>
            <LineEditor lines={edit.lines} onChange={(lines) => setEdit({ ...edit, lines })} filter={(p) => p.status === 'active'} />
          </div>
        </Modal>
      )}
    </>
  )
}

/* ============================ Special orders ============================ */
function Special() {
  const { specialOrders, saveSpecialOrder, suppliers } = useStore()
  const [edit, setEdit] = useState<SpecialOrder | null>(null)
  const next = (o: SpecialOrder) => {
    const i = SO_FLOW.indexOf(o.status)
    if (i < 0 || i >= SO_FLOW.length - 1) return
    saveSpecialOrder({ ...o, status: SO_FLOW[i + 1] })
    toast.success(`${o.no}: ${SO_LABEL[SO_FLOW[i + 1]]}`)
  }
  const today = startOfDay()
  return (
    <>
      <Card title="Special book orders" pad={false} actions={<button className="btn primary sm" onClick={() => setEdit({ id: uid('so'), no: nextDocNo('SO-', specialOrders.map((o) => o.no)), customerName: '', phone: '', title: '', qty: 1, advance: 0, status: 'requested', date: new Date().toISOString(), expectedDate: addDays(new Date(), 10).toISOString() })}><Plus size={15} /> New special order</button>}>
        <div className="tbl-wrap">
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Requested item</th><th className="r">Qty</th><th>Expected</th><th>Progress</th><th /></tr></thead>
            <tbody>
              {[...specialOrders].sort((a, b) => b.date.localeCompare(a.date)).map((o) => {
                const step = SO_FLOW.indexOf(o.status)
                const late = o.expectedDate && new Date(o.expectedDate) < today && !['completed', 'cancelled', 'received', 'customer_notified'].includes(o.status)
                return (
                  <tr key={o.id} className="clickable" onClick={() => setEdit(o)}>
                    <td><b>{o.no}</b></td>
                    <td>{o.customerName}<small className="muted block">{o.phone}</small></td>
                    <td><b>{o.title}</b><small className="muted block">{o.author ?? ''}{o.isbn ? ` • ${o.isbn}` : ''}</small></td>
                    <td className="r">{o.qty}</td>
                    <td><Badge tone={late ? 'red' : 'gray'}>{fmtDate(o.expectedDate)}</Badge></td>
                    <td>
                      <Badge tone={SO_TONE[o.status]}>{SO_LABEL[o.status]}</Badge>
                      {step >= 0 && <div className="steps">{SO_FLOW.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>}
                    </td>
                    <td className="r" onClick={(e) => e.stopPropagation()}>
                      {o.status === 'received' || o.status === 'customer_notified' ? <a className="btn sm" target="_blank" rel="noreferrer" href={`https://wa.me/${o.phone.replace(/\D/g, '').replace(/^0/, '94')}?text=${encodeURIComponent(`Hello ${o.customerName}, your ordered book “${o.title}” has arrived at Dinuda Bookshop.`)}`}><MessageCircle size={14} /> Notify</a> : null}{' '}
                      {step >= 0 && step < SO_FLOW.length - 1 && <button className="btn sm primary" onClick={() => next(o)}>{SO_LABEL[SO_FLOW[step + 1]]} <ArrowRight size={14} /></button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {edit && (
        <Modal title={`Special order ${edit.no}`} width={640} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button>{edit.status !== 'cancelled' && edit.status !== 'completed' && specialOrders.some((o) => o.id === edit.id) && <button className="btn danger ghost" onClick={() => { saveSpecialOrder({ ...edit, status: 'cancelled' }); setEdit(null) }}>Cancel order</button>}<button className="btn primary" disabled={!edit.customerName.trim() || !edit.title.trim() || !edit.phone.trim()} onClick={() => { saveSpecialOrder(edit); toast.success('Special order saved'); setEdit(null) }}>Save</button></>}>
          <div className="grid cols-2">
            <Field label="Customer name" required><input className="input" value={edit.customerName} onChange={(e) => setEdit({ ...edit, customerName: e.target.value })} /></Field>
            <Field label="Phone" required><input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Book / item requested" required className="span2"><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Author"><input className="input" value={edit.author ?? ''} onChange={(e) => setEdit({ ...edit, author: e.target.value })} /></Field>
            <Field label="ISBN"><input className="input mono" value={edit.isbn ?? ''} onChange={(e) => setEdit({ ...edit, isbn: e.target.value })} /></Field>
            <Field label="Quantity"><NumberInput value={edit.qty} min={1} onChange={(n) => setEdit({ ...edit, qty: Math.max(1, n) })} /></Field>
            <Field label="Advance paid (Rs.)"><NumberInput value={edit.advance} onChange={(n) => setEdit({ ...edit, advance: n })} /></Field>
            <Field label="Expected collection date"><input className="input" type="date" value={toInputDate(edit.expectedDate ?? new Date())} onChange={(e) => setEdit({ ...edit, expectedDate: new Date(e.target.value + 'T12:00').toISOString() })} /></Field>
            <Field label="Supplier to order from">
              <select className="select" value={edit.supplierId ?? ''} onChange={(e) => setEdit({ ...edit, supplierId: e.target.value || undefined })}>
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Status" className="span2">
              <select className="select" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as SpecialOrderStatus })}>
                {Object.entries(SO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Notes" className="span2"><input className="input" value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ============================ School lists & packs ============================ */
function ListsAndPacks({ onQuote }: { onQuote: (q: Quotation) => void }) {
  const nav = useNavigate()
  const { schoolLists, bundles, products, saveSchoolList, deleteSchoolList, saveBundle, deleteBundle, quotations, loadLines } = useStore()
  const [list, setList] = useState<SchoolList | null>(null)
  const [pack, setPack] = useState<Bundle | null>(null)
  const price = (pid: string) => products.find((p) => p.id === pid)?.price ?? 0
  const listTotal = (l: { lines: { productId: string; qty: number }[] }) => l.lines.reduce((a, x) => a + price(x.productId) * x.qty, 0)

  const toPOS = (l: SchoolList) => {
    const lines = l.lines.filter((x) => { const p = products.find((y) => y.id === x.productId); return p && available(p) > 0 }).map((x) => { const p = products.find((y) => y.id === x.productId)!; return { productId: x.productId, qty: Math.min(x.qty, available(p)) } })
    if (lines.length < l.lines.length) toast.info('Some items are out of stock and were skipped')
    loadLines(lines)
    nav('/pos')
  }
  const toQuote = (l: SchoolList) =>
    onQuote({ id: uid('q'), no: nextDocNo('QT-', quotations.map((q) => q.no)), customerName: l.school, date: new Date().toISOString(), validUntil: addDays(new Date(), 14).toISOString(), lines: l.lines.map((x) => ({ productId: x.productId, qty: x.qty, price: price(x.productId) })), discount: 0, status: 'draft', note: `${l.name} – ${l.school}` })

  const mine = (l: { lines: { productId: string; qty: number }[] }): EditLine[] => l.lines.map((x) => ({ productId: x.productId, qty: x.qty, price: price(x.productId) }))

  return (
    <div className="stack">
      <Card title={<span className="row gap-s"><GraduationCap size={18} /> School supply lists</span>} actions={<button className="btn primary sm" onClick={() => setList({ id: uid('sl'), name: '', school: '', grade: '', lines: [] })}><Plus size={15} /> New list</button>}>
        <div className="grid cols-3">
          {schoolLists.map((l) => (
            <div key={l.id} className="list-card">
              <div className="row between"><b>{l.name}</b><Badge tone="teal">{l.grade}</Badge></div>
              <small className="muted">{l.school}</small>
              <p className="small">{l.lines.length} items • est. <b>{lkr(listTotal(l), { decimals: false })}</b></p>
              <div className="row gap-s wrap">
                <button className="btn sm primary" onClick={() => toPOS(l)}><ShoppingCart size={14} /> Sell</button>
                <button className="btn sm" onClick={() => toQuote(l)}><FileText size={14} /> Quote</button>
                <button className="btn sm" onClick={() => setList(l)}>Edit</button>
                <button className="btn sm" title="Duplicate" onClick={() => saveSchoolList({ ...l, id: uid('sl'), name: `${l.name} (copy)` })}><Copy size={14} /></button>
              </div>
            </div>
          ))}
          {schoolLists.length === 0 && <Empty title="No school lists yet" />}
        </div>
      </Card>
      <Card title={<span className="row gap-s"><Gift size={18} /> Product bundles / packs</span>} actions={<button className="btn primary sm" onClick={() => setPack({ id: uid('b'), name: '', price: 0, lines: [] })}><Plus size={15} /> New pack</button>}>
        <div className="grid cols-3">
          {bundles.map((b) => (
            <div key={b.id} className="list-card">
              <div className="row between"><b>{b.name}</b><Badge tone="green">{lkr(b.price, { decimals: false })}</Badge></div>
              <p className="small muted">{b.lines.map((l) => `${l.qty}× ${products.find((p) => p.id === l.productId)?.title}`).join(' • ')}</p>
              <p className="small">List price {lkr(listTotal(b), { decimals: false })} → <b>save {lkr(Math.max(0, listTotal(b) - b.price), { decimals: false })}</b></p>
              <button className="btn sm" onClick={() => setPack(b)}>Edit</button>
            </div>
          ))}
        </div>
        <p className="muted small mt">Packs appear in the POS under “Packs &amp; bundles” and are added as individual items so stock stays accurate.</p>
      </Card>

      {list && (
        <Modal title={schoolLists.some((l) => l.id === list.id) ? 'Edit school list' : 'New school list'} width={820} onClose={() => setList(null)}
          footer={<>{schoolLists.some((l) => l.id === list.id) && <button className="btn danger ghost" onClick={() => { deleteSchoolList(list.id); setList(null) }}><Trash2 size={15} /> Delete</button>}<span className="grow" /><button className="btn" onClick={() => setList(null)}>Cancel</button><button className="btn primary" disabled={!list.name.trim() || !list.lines.length} onClick={() => { saveSchoolList(list); toast.success('List saved'); setList(null) }}>Save list</button></>}>
          <div className="stack">
            <div className="grid cols-3">
              <Field label="List name" required><input className="input" value={list.name} onChange={(e) => setList({ ...list, name: e.target.value })} /></Field>
              <Field label="School"><input className="input" value={list.school} onChange={(e) => setList({ ...list, school: e.target.value })} /></Field>
              <Field label="Grade / class"><input className="input" value={list.grade} onChange={(e) => setList({ ...list, grade: e.target.value })} /></Field>
            </div>
            <LineEditor lines={mine(list)} onChange={(ls) => setList({ ...list, lines: ls.map((x) => ({ productId: x.productId, qty: x.qty })) })} showPrice />
          </div>
        </Modal>
      )}
      {pack && (
        <Modal title={bundles.some((b) => b.id === pack.id) ? 'Edit pack' : 'New pack'} width={820} onClose={() => setPack(null)}
          footer={<>{bundles.some((b) => b.id === pack.id) && <button className="btn danger ghost" onClick={() => { deleteBundle(pack.id); setPack(null) }}><Trash2 size={15} /> Delete</button>}<span className="grow" /><button className="btn" onClick={() => setPack(null)}>Cancel</button><button className="btn primary" disabled={!pack.name.trim() || !pack.lines.length || pack.price <= 0} onClick={() => { saveBundle(pack); toast.success('Pack saved'); setPack(null) }}>Save pack</button></>}>
          <div className="stack">
            <div className="grid cols-2">
              <Field label="Pack name" required><input className="input" value={pack.name} onChange={(e) => setPack({ ...pack, name: e.target.value })} /></Field>
              <Field label="Pack price (Rs.)" required hint={`Items at list price: ${lkr(listTotal(pack), { decimals: false })}`}><NumberInput value={pack.price} onChange={(n) => setPack({ ...pack, price: n })} /></Field>
            </div>
            <LineEditor lines={mine(pack)} onChange={(ls) => setPack({ ...pack, lines: ls.map((x) => ({ productId: x.productId, qty: x.qty })) })} showPrice />
          </div>
        </Modal>
      )}
    </div>
  )
}
