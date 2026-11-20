import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ban, CheckCheck, CreditCard, PackageCheck, Paperclip, Plus, Printer, Undo2 } from 'lucide-react'
import { nextDocNo, useCan, useStore } from '../store/useStore'
import { Badge, Card, Empty, Field, Modal, NumberInput, PageHeader, Pager, SearchBox, Stat, Tabs, usePaged, type Tone } from '../components/ui'
import { LineEditor, type EditLine } from '../components/LineEditor'
import { DocPrintModal } from '../components/DocPrint'
import { confirmDialog, toast } from '../components/dialogs'
import { PAY_LABEL, poLinesTotal, poPaid, poPayable, poReturned, poTotal } from '../lib/calc'
import { fmtDate, lkr, round2, toInputDate, uid, addDays, downloadCsv } from '../lib/utils'
import type { POStatus, PurchaseOrder } from '../types'

const STATUS_TONE: Record<POStatus, Tone> = { draft: 'gray', ordered: 'blue', partial: 'amber', received: 'green', cancelled: 'red' }

export default function Purchasing() {
  const can = useCan()
  const canEdit = can('purchasing')
  const { purchaseOrders, suppliers } = useStore()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'orders' | 'payables' | 'insights'>('orders')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [sup, setSup] = useState(params.get('supplier') ?? '')
  const [editing, setEditing] = useState<PurchaseOrder | 'new' | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const today = new Date()

  const supName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? '—'
  const rows = useMemo(
    () =>
      purchaseOrders
        .filter((p) => (!status || p.status === status) && (!sup || p.supplierId === sup))
        .filter((p) => !q || [p.no, p.invoiceNo, supName(p.supplierId)].some((x) => (x ?? '').toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [purchaseOrders, status, sup, q, suppliers], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const pg = usePaged(rows, 12)
  const payables = purchaseOrders.filter((p) => poPayable(p) > 0)
  const totalPayable = payables.reduce((a, p) => a + poPayable(p), 0)
  const overdue = payables.filter((p) => p.dueDate && new Date(p.dueDate) < today)
  const open = purchaseOrders.filter((p) => p.status === 'ordered' || p.status === 'partial')

  return (
    <>
      <PageHeader
        title="Purchasing"
        subtitle="Purchase orders, goods received, supplier invoices and payments"
        actions={canEdit && <button className="btn primary" onClick={() => setEditing('new')}><Plus size={16} /> New purchase order</button>}
      />
      <div className="grid cols-4">
        <Stat label="Payable to suppliers" value={lkr(totalPayable, { decimals: false })} tone="amber" sub={`${payables.length} unpaid invoices`} />
        <Stat label="Overdue payments" value={overdue.length} tone={overdue.length ? 'red' : 'green'} sub={lkr(overdue.reduce((a, p) => a + poPayable(p), 0), { decimals: false })} />
        <Stat label="Awaiting goods" value={open.length} tone="blue" sub="Ordered / partly received" />
        <Stat label="Draft orders" value={purchaseOrders.filter((p) => p.status === 'draft').length} tone="gray" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'orders', label: 'Purchase orders', count: purchaseOrders.length }, { id: 'payables', label: 'Supplier payables', count: payables.length }, { id: 'insights', label: 'Price comparison & frequent items' }]} />

      {tab === 'orders' && (
        <Card pad={false}>
          <div className="filters">
            <div className="grow"><SearchBox value={q} onChange={setQ} placeholder="Search PO number, invoice or supplier…" /></div>
            <select className="select" value={sup} onChange={(e) => { setSup(e.target.value); setParams(e.target.value ? { supplier: e.target.value } : {}) }}>
              <option value="">All suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {(['draft', 'ordered', 'partial', 'received', 'cancelled'] as POStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="tbl-wrap">
            <table className="table">
              <thead><tr><th>PO</th><th>Supplier</th><th>Date</th><th>Invoice</th><th>Status</th><th className="r">Total</th><th className="r">Paid</th><th className="r">Outstanding</th><th>Due</th></tr></thead>
              <tbody>
                {pg.rows.map((p) => {
                  const pay = poPayable(p)
                  const od = pay > 0 && p.dueDate && new Date(p.dueDate) < today
                  return (
                    <tr key={p.id} className="clickable" onClick={() => setViewId(p.id)}>
                      <td><b>{p.no}</b></td>
                      <td>{supName(p.supplierId)}</td>
                      <td>{fmtDate(p.date)}</td>
                      <td>{p.invoiceNo ?? '—'}</td>
                      <td><Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge></td>
                      <td className="r">{lkr(poTotal(p))}</td>
                      <td className="r">{lkr(poPaid(p))}</td>
                      <td className="r">{pay > 0 ? <b>{lkr(pay)}</b> : '—'}</td>
                      <td>{pay > 0 && p.dueDate ? <Badge tone={od ? 'red' : 'gray'}>{od ? 'Overdue ' : ''}{fmtDate(p.dueDate)}</Badge> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {rows.length === 0 && <Empty title="No purchase orders" />}
          </div>
          <Pager {...pg} />
        </Card>
      )}
      {tab === 'payables' && <Payables onOpen={setViewId} />}
      {tab === 'insights' && <Insights />}

      {editing && <POEditor po={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); setViewId(id) }} />}
      {viewId && <PODetail id={viewId} onClose={() => setViewId(null)} onEdit={(p) => { setViewId(null); setEditing(p) }} />}
    </>
  )
}

/* ---------------- payables ---------------- */
function Payables({ onOpen }: { onOpen: (id: string) => void }) {
  const { purchaseOrders, suppliers } = useStore()
  const rows = purchaseOrders.filter((p) => poPayable(p) > 0).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const bySup = suppliers.map((s) => ({ s, amt: rows.filter((r) => r.supplierId === s.id).reduce((a, r) => a + poPayable(r), 0) })).filter((x) => x.amt > 0).sort((a, b) => b.amt - a.amt)
  return (
    <div className="grid cols-3-2">
      <Card title="Unpaid supplier invoices" pad={false}>
        <div className="tbl-wrap">
          <table className="table">
            <thead><tr><th>Supplier</th><th>PO / Invoice</th><th>Due</th><th className="r">Outstanding</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => {
                const od = p.dueDate && new Date(p.dueDate) < new Date()
                return (
                  <tr key={p.id}>
                    <td>{suppliers.find((s) => s.id === p.supplierId)?.name}</td>
                    <td><b>{p.no}</b><small className="muted block">{p.invoiceNo ?? '—'}</small></td>
                    <td><Badge tone={od ? 'red' : 'gray'}>{fmtDate(p.dueDate)}</Badge></td>
                    <td className="r"><b>{lkr(poPayable(p))}</b></td>
                    <td className="r"><button className="btn sm" onClick={() => onOpen(p.id)}><CreditCard size={14} /> Pay</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && <Empty title="No unpaid supplier invoices" />}
        </div>
      </Card>
      <Card title="Outstanding by supplier">
        <div className="list">
          {bySup.map(({ s, amt }) => <div key={s.id} className="list-row static"><span>{s.name}</span><b>{lkr(amt, { decimals: false })}</b></div>)}
          {bySup.length === 0 && <p className="muted">All suppliers are paid up.</p>}
        </div>
      </Card>
    </div>
  )
}

/* ---------------- insights ---------------- */
function Insights() {
  const { purchaseOrders, products, suppliers } = useStore()
  const rows = useMemo(() => {
    const m = new Map<string, { orders: number; qty: number; sup: Map<string, { cost: number; date: string }> }>()
    purchaseOrders
      .filter((p) => p.status !== 'cancelled' && p.status !== 'draft')
      .forEach((po) =>
        po.lines.forEach((l) => {
          const r = m.get(l.productId) ?? { orders: 0, qty: 0, sup: new Map() }
          r.orders++
          r.qty += l.qty
          const cur = r.sup.get(po.supplierId)
          if (!cur || cur.date < po.date) r.sup.set(po.supplierId, { cost: l.unitCost, date: po.date })
          m.set(l.productId, r)
        }),
      )
    return [...m.entries()].map(([id, r]) => {
      const sl = [...r.sup.entries()].map(([sid, v]) => ({ name: suppliers.find((s) => s.id === sid)?.name ?? sid, ...v })).sort((a, b) => a.cost - b.cost)
      return { p: products.find((x) => x.id === id)!, ...r, sl }
    }).filter((r) => r.p).sort((a, b) => b.qty - a.qty)
  }, [purchaseOrders, products, suppliers])
  const pg = usePaged(rows, 12)
  return (
    <Card title="What we buy most & where it is cheapest" pad={false} actions={<button className="btn sm" onClick={() => downloadCsv('purchase-insights.csv', [['product', 'orders', 'qty', 'cheapest supplier', 'cost'], ...rows.map((r) => [r.p.title, r.orders, r.qty, r.sl[0]?.name, r.sl[0]?.cost])])}>Export</button>}>
      <div className="tbl-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th className="r">Times ordered</th><th className="r">Qty purchased</th><th>Supplier prices (latest)</th></tr></thead>
          <tbody>
            {pg.rows.map((r) => (
              <tr key={r.p.id}>
                <td><b>{r.p.title}</b></td>
                <td className="r">{r.orders}</td>
                <td className="r">{r.qty}</td>
                <td>{r.sl.map((s, i) => <span key={s.name} className={`chip ${i === 0 && r.sl.length > 1 ? 'good' : ''}`}>{s.name}: <b>{lkr(s.cost)}</b></span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager {...pg} />
    </Card>
  )
}

/* ---------------- PO editor ---------------- */
function POEditor({ po, onClose, onSaved }: { po: PurchaseOrder | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { suppliers, savePO, purchaseOrders, currentUserId } = useStore()
  const [supplierId, setSupplierId] = useState(po?.supplierId ?? suppliers[0]?.id ?? '')
  const [date, setDate] = useState(toInputDate(po?.date ?? new Date()))
  const [invoiceNo, setInvoiceNo] = useState(po?.invoiceNo ?? '')
  const [dueDate, setDueDate] = useState(toInputDate(po?.dueDate ?? addDays(new Date(), 30)))
  const [lines, setLines] = useState<EditLine[]>(po?.lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.unitCost })) ?? [])
  const [charges, setCharges] = useState(po?.charges ?? 0)
  const [discount, setDiscount] = useState(po?.discount ?? 0)
  const [notes, setNotes] = useState(po?.notes ?? '')
  const [attachment, setAttachment] = useState(po?.attachment ?? '')
  const locked = !!po && po.lines.some((l) => l.received > 0)
  const sub = lines.reduce((a, l) => a + l.qty * l.price, 0)

  const save = (status: POStatus) => {
    const base: PurchaseOrder = po ?? { id: uid('po'), no: nextDocNo('PO-', purchaseOrders.map((p) => p.no)), supplierId, date: '', lines: [], charges: 0, discount: 0, status, payments: [], returns: [], createdBy: currentUserId ?? '' }
    const next: PurchaseOrder = {
      ...base,
      supplierId,
      date: new Date(date + 'T09:00:00').toISOString(),
      invoiceNo: invoiceNo || undefined,
      dueDate: dueDate ? new Date(dueDate + 'T09:00:00').toISOString() : undefined,
      lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.price, received: po?.lines.find((x) => x.productId === l.productId)?.received ?? 0, discount: po?.lines.find((x) => x.productId === l.productId)?.discount ?? 0 })),
      charges,
      discount,
      notes: notes || undefined,
      attachment: attachment || undefined,
      status: po && po.status !== 'draft' ? po.status : status,
    }
    savePO(next)
    toast.success(`${next.no} saved`)
    onSaved(next.id)
  }

  return (
    <Modal
      title={po ? `Edit ${po.no}` : 'New purchase order'}
      width={860}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          {(!po || po.status === 'draft') && <button className="btn" disabled={!lines.length || !supplierId} onClick={() => save('draft')}>Save as draft</button>}
          <button className="btn primary" disabled={!lines.length || !supplierId} onClick={() => save(po && po.status !== 'draft' ? po.status : 'ordered')}>{po && po.status !== 'draft' ? 'Save changes' : 'Place order'}</button>
        </>
      }
    >
      <div className="stack">
        <div className="grid cols-4">
          <Field label="Supplier" required className="span2">
            <select className="select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Order / purchase date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Payment due date"><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Field label="Supplier invoice no."><input className="input" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></Field>
          <Field label="Invoice attachment" className="span2">
            <label className="file-pick"><Paperclip size={14} /> {attachment || 'Attach invoice (PDF / photo)'}<input type="file" hidden onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? '')} /></label>
          </Field>
        </div>
        {locked && <p className="warn small">Some goods were already received — items can no longer be removed.</p>}
        <LineEditor lines={lines} onChange={setLines} priceLabel="Unit cost" defaultPrice={(p) => p.cost} readOnly={locked} />
        <div className="grid cols-3">
          <Field label="Delivery / other charges (Rs.)"><NumberInput value={charges} onChange={setCharges} /></Field>
          <Field label="Discount (Rs.)"><NumberInput value={discount} onChange={setDiscount} /></Field>
          <div className="summary-box"><div className="tl"><span>Order total</span><strong>{lkr(sub + charges - discount)}</strong></div></div>
        </div>
        <Field label="Notes"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

/* ---------------- PO detail ---------------- */
function PODetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (p: PurchaseOrder) => void }) {
  const { purchaseOrders, suppliers, products, receivePO, payPO, returnToSupplier, setPOStatus } = useStore()
  const can = useCan()
  const canEdit = can('purchasing')
  const po = purchaseOrders.find((p) => p.id === id)
  const [recv, setRecv] = useState<Record<string, number>>({})
  const [pay, setPay] = useState({ amount: 0, method: 'bank' as 'cash' | 'bank' | 'card' | 'qr', ref: '', date: toInputDate(new Date()) })
  const [ret, setRet] = useState<{ productId: string; qty: number; reason: string } | null>(null)
  const [print, setPrint] = useState(false)
  if (!po) return null
  const sup = suppliers.find((s) => s.id === po.supplierId)
  const payable = poPayable(po)
  const canReceive = canEdit && (po.status === 'ordered' || po.status === 'partial')
  const prod = (pid: string) => products.find((p) => p.id === pid)

  const doReceive = () => {
    const r: Record<string, number> = {}
    po.lines.forEach((l) => {
      const n = Math.min(recv[l.productId] ?? l.qty - l.received, l.qty - l.received)
      if (n > 0) r[l.productId] = n
    })
    if (!Object.keys(r).length) return toast.info('Enter a quantity to receive')
    receivePO(po.id, r)
    setRecv({})
    toast.success('Goods received – stock updated')
  }

  return (
    <>
      <Modal
        title={<span className="row gap-s">{po.no} <Badge tone={STATUS_TONE[po.status]}>{po.status}</Badge></span>}
        subtitle={`${sup?.name} • ${fmtDate(po.date)}${po.invoiceNo ? ` • Invoice ${po.invoiceNo}` : ''}`}
        width={900}
        onClose={onClose}
        footer={
          <>
            <button className="btn" onClick={() => setPrint(true)}><Printer size={15} /> Print PO</button>
            <span className="grow" />
            {canEdit && po.status === 'draft' && <button className="btn" onClick={() => { setPOStatus(po.id, 'ordered'); toast.success('Order placed') }}><CheckCheck size={15} /> Mark as ordered</button>}
            {canEdit && po.status !== 'received' && po.status !== 'cancelled' && <button className="btn" onClick={() => onEdit(po)}>Edit</button>}
            {canEdit && (po.status === 'draft' || po.status === 'ordered') && (
              <button className="btn danger ghost" onClick={async () => { if (await confirmDialog({ title: 'Cancel purchase order?', message: `${po.no} will be marked as cancelled.`, danger: true, confirmLabel: 'Cancel order' })) setPOStatus(po.id, 'cancelled') }}><Ban size={15} /> Cancel order</button>
            )}
          </>
        }
      >
        <div className="stack">
          <div className="grid cols-4">
            <Stat label="Order total" value={lkr(poTotal(po), { decimals: false })} />
            <Stat label="Paid" value={lkr(poPaid(po), { decimals: false })} tone="green" />
            <Stat label="Returned to supplier" value={lkr(poReturned(po), { decimals: false })} tone="gray" />
            <Stat label="Outstanding" value={lkr(payable, { decimals: false })} tone={payable > 0 ? 'amber' : 'green'} sub={po.dueDate ? `Due ${fmtDate(po.dueDate)}` : undefined} />
          </div>
          <div className="tbl-wrap">
            <table className="table compact">
              <thead><tr><th>Product</th><th className="r">Ordered</th><th className="r">Received</th><th className="r">Unit cost</th><th className="r">Line total</th>{canReceive && <th style={{ width: 130 }}>Receive now</th>}</tr></thead>
              <tbody>
                {po.lines.map((l) => (
                  <tr key={l.productId}>
                    <td><b>{prod(l.productId)?.title}</b></td>
                    <td className="r">{l.qty}</td>
                    <td className="r">{l.received}</td>
                    <td className="r">{lkr(l.unitCost)}</td>
                    <td className="r">{lkr(l.qty * l.unitCost - l.discount)}</td>
                    {canReceive && (
                      <td>
                        {l.qty - l.received > 0 ? <NumberInput value={recv[l.productId] ?? l.qty - l.received} max={l.qty - l.received} onChange={(n) => setRecv({ ...recv, [l.productId]: n })} /> : <Badge tone="green">Complete</Badge>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4} className="r muted">Lines {lkr(poLinesTotal(po))} + charges {lkr(po.charges)} − discount {lkr(po.discount)}</td><td className="r"><b>{lkr(poTotal(po))}</b></td>{canReceive && <td />}</tr>
              </tfoot>
            </table>
          </div>
          {canReceive && (
            <div className="row gap">
              <button className="btn primary" onClick={doReceive}><PackageCheck size={16} /> Confirm goods received</button>
              <span className="muted small">Stock quantities and product cost update automatically. Partial deliveries are supported.</span>
            </div>
          )}
          {po.attachment && <p className="muted small"><Paperclip size={13} /> Attachment: {po.attachment}</p>}
          {po.notes && <p className="muted small">Notes: {po.notes}</p>}

          <div className="grid cols-2">
            <Card title="Supplier payments" pad>
              <div className="list">
                {po.payments.map((p) => (
                  <div key={p.id} className="list-row static"><span>{fmtDate(p.date)} • {PAY_LABEL[p.method]}{p.ref ? ` • ${p.ref}` : ''}</span><b>{lkr(p.amount)}</b></div>
                ))}
                {po.payments.length === 0 && <p className="muted small">No payments recorded.</p>}
              </div>
              {canEdit && payable > 0 && (
                <div className="stack mt">
                  <div className="grid cols-2">
                    <Field label="Amount (Rs.)"><NumberInput value={pay.amount} max={payable} onChange={(n) => setPay({ ...pay, amount: n })} placeholder={String(payable)} /></Field>
                    <Field label="Method">
                      <select className="select" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as typeof pay.method })}>
                        {(['bank', 'cash', 'card', 'qr'] as const).map((m) => <option key={m} value={m}>{PAY_LABEL[m]}</option>)}
                      </select>
                    </Field>
                    <Field label="Reference"><input className="input" value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} placeholder="Cheque / transfer no." /></Field>
                    <Field label="Date"><input className="input" type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
                  </div>
                  <div className="row gap-s">
                    <button className="btn primary" disabled={pay.amount <= 0} onClick={() => { payPO(po.id, { amount: round2(pay.amount), method: pay.method, ref: pay.ref || undefined, date: new Date(pay.date + 'T12:00:00').toISOString() }); setPay({ ...pay, amount: 0, ref: '' }); toast.success('Payment recorded') }}>Record payment</button>
                    <button className="btn" onClick={() => setPay({ ...pay, amount: payable })}>Pay full {lkr(payable, { decimals: false })}</button>
                  </div>
                </div>
              )}
            </Card>
            <Card title="Returns to supplier" pad>
              <div className="list">
                {po.returns.map((r) => (
                  <div key={r.id} className="list-row static"><span>{fmtDate(r.date)} • {r.qty} × {prod(r.productId)?.title}<small className="muted block">{r.reason}</small></span><b>− {lkr(r.amount)}</b></div>
                ))}
                {po.returns.length === 0 && <p className="muted small">No returns.</p>}
              </div>
              {canEdit && (po.status === 'received' || po.status === 'partial') && (
                ret ? (
                  <div className="stack mt">
                    <Field label="Product">
                      <select className="select" value={ret.productId} onChange={(e) => setRet({ ...ret, productId: e.target.value })}>
                        {po.lines.filter((l) => l.received > 0).map((l) => <option key={l.productId} value={l.productId}>{prod(l.productId)?.title}</option>)}
                      </select>
                    </Field>
                    <div className="grid cols-2">
                      <Field label="Quantity"><NumberInput value={ret.qty} min={1} onChange={(n) => setRet({ ...ret, qty: n })} /></Field>
                      <Field label="Reason"><input className="input" value={ret.reason} onChange={(e) => setRet({ ...ret, reason: e.target.value })} placeholder="Damaged / wrong item" /></Field>
                    </div>
                    <div className="row gap-s">
                      <button className="btn primary" disabled={!ret.productId || ret.qty <= 0 || !ret.reason} onClick={() => { returnToSupplier(po.id, ret.productId, ret.qty, ret.reason); setRet(null); toast.success('Return recorded – stock and payable updated') }}>Confirm return</button>
                      <button className="btn" onClick={() => setRet(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn mt" onClick={() => setRet({ productId: po.lines.find((l) => l.received > 0)?.productId ?? '', qty: 1, reason: '' })}><Undo2 size={15} /> Return damaged / incorrect goods</button>
                )
              )}
            </Card>
          </div>
        </div>
      </Modal>
      {print && (
        <DocPrintModal
          onClose={() => setPrint(false)}
          doc={{
            title: 'PURCHASE ORDER',
            number: po.no,
            date: fmtDate(po.date),
            meta: [
              { label: 'SUPPLIER', lines: [sup?.name ?? '', sup?.address ?? '', sup?.phone ?? ''] },
              { label: 'DETAILS', lines: [`Status: ${po.status}`, po.invoiceNo ? `Invoice: ${po.invoiceNo}` : 'Invoice: —', `Payment due: ${fmtDate(po.dueDate)}`] },
            ],
            columns: [{ label: '#' }, { label: 'Item' }, { label: 'Qty', align: 'r' }, { label: 'Unit cost', align: 'r' }, { label: 'Amount', align: 'r' }],
            rows: po.lines.map((l, i) => [i + 1, prod(l.productId)?.title ?? '', l.qty, lkr(l.unitCost), lkr(l.qty * l.unitCost - l.discount)]),
            totals: [{ label: 'Charges', value: lkr(po.charges) }, { label: 'Discount', value: `− ${lkr(po.discount)}` }, { label: 'Order total', value: lkr(poTotal(po)), bold: true }],
            notes: po.notes ? [po.notes] : [],
          }}
        />
      )}
    </>
  )
}

