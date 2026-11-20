import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Download, Printer, Undo2 } from 'lucide-react'
import { useCan, useStore, userName } from '../store/useStore'
import { Badge, Card, Checkbox, Empty, Field, Modal, NumberInput, PageHeader, Pager, SearchBox, Stat, Tabs, usePaged, type Tone } from '../components/ui'
import { DateRangeBar, initialRange } from '../components/DateRange'
import { ReceiptModal } from '../components/Receipt'
import { requestApproval, toast } from '../components/dialogs'
import { PAY_LABEL, saleDiscount } from '../lib/calc'
import { inRange, makeRange } from '../lib/analytics'
import { downloadCsv, fmtDateTime, lkr, round2 } from '../lib/utils'
import type { PayMethod, Sale, SaleReturn } from '../types'

const STATUS_TONE: Record<string, Tone> = { completed: 'green', voided: 'red', refunded: 'purple', partial_return: 'blue' }

export default function Sales() {
  const can = useCan()
  const { sales, returns, users } = useStore()
  const [tab, setTab] = useState<'bills' | 'returns'>('bills')
  const [range, setRange] = useState(initialRange('30d'))
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [cashier, setCashier] = useState('')
  const [viewId, setViewId] = useState<string | null>(null)
  const [returnFor, setReturnFor] = useState<Sale | null>(null)
  const [finding, setFinding] = useState(false)
  const r = makeRange(range.from, range.to)

  const rows = useMemo(
    () =>
      sales
        .filter((s) => inRange(s.date, r) && (!status || s.status === status || (status === 'due' && s.balance > 0 && s.status !== 'voided')) && (!cashier || s.cashierId === cashier))
        .filter((s) => !q || [s.no, s.customerName ?? '', ...s.lines.map((l) => l.title)].some((x) => x.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [sales, range, q, status, cashier], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const pg = usePaged(rows, 14)
  const rr = returns.filter((x) => inRange(x.date, r)).filter((x) => !q || x.no.toLowerCase().includes(q.toLowerCase()) || x.saleNo.toLowerCase().includes(q.toLowerCase()))
  const pgr = usePaged(rr, 14)
  const valid = rows.filter((s) => s.status !== 'voided')

  return (
    <>
      <PageHeader
        title="Sales & Returns"
        subtitle="Bill history, reprints, voids, refunds and exchanges"
        actions={
          <>
            <DateRangeBar value={range} onChange={setRange} />
            {can('export') && <button className="btn" onClick={() => downloadCsv('sales.csv', [['receipt', 'date', 'customer', 'cashier', 'subtotal', 'discount', 'total', 'paid', 'balance', 'status'], ...rows.map((s) => [s.no, s.date, s.customerName, userName(users, s.cashierId), s.subtotal, saleDiscount(s), s.total, s.paid, s.balance, s.status])])}><Download size={16} /> Export</button>}
          </>
        }
      />
      <div className="grid cols-4">
        <Stat label="Bills" value={valid.length} tone="blue" />
        <Stat label="Sales value" value={lkr(valid.reduce((a, s) => a + s.total, 0), { decimals: false })} tone="green" />
        <Stat label="Voided bills" value={rows.filter((s) => s.status === 'voided').length} tone="red" />
        <Stat label="Returns / refunds" value={`${rr.length} • ${lkr(rr.reduce((a, x) => a + x.amount, 0), { decimals: false })}`} tone="purple" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'bills', label: 'Bill history', count: rows.length }, { id: 'returns', label: 'Returns & refunds', count: rr.length }]} />
      <Card pad={false}>
        <div className="filters">
          <div className="grow"><SearchBox value={q} onChange={setQ} placeholder={tab === 'bills' ? 'Search receipt no., customer or item…' : 'Search return or receipt no.…'} /></div>
          {tab === 'bills' ? (
            <>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="due">Balance due (credit)</option>
                <option value="partial_return">Partly returned</option>
                <option value="refunded">Refunded</option>
                <option value="voided">Voided</option>
              </select>
              <select className="select" value={cashier} onChange={(e) => setCashier(e.target.value)}>
                <option value="">All cashiers</option>
                {users.filter((u) => u.permissions.includes('pos')).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </>
          ) : (
            can('refund') && <button className="btn primary" onClick={() => setFinding(true)}><Undo2 size={16} /> New return</button>
          )}
        </div>
        {tab === 'bills' ? (
          <>
            <div className="tbl-wrap">
              <table className="table">
                <thead><tr><th>Receipt</th><th>Date &amp; time</th><th>Customer</th><th>Cashier</th><th>Payment</th><th className="r">Discount</th><th className="r">Total</th><th>Status</th></tr></thead>
                <tbody>
                  {pg.rows.map((s) => (
                    <tr key={s.id} className="clickable" onClick={() => setViewId(s.id)}>
                      <td><b>{s.no}</b></td>
                      <td>{fmtDateTime(s.date)}</td>
                      <td>{s.customerName ?? <span className="muted">Walk-in</span>}</td>
                      <td>{userName(users, s.cashierId)}</td>
                      <td>{s.payments.map((p) => PAY_LABEL[p.method]).join(' + ') || '—'}</td>
                      <td className="r">{saleDiscount(s) > 0 ? lkr(saleDiscount(s)) : '—'}</td>
                      <td className="r"><b>{lkr(s.total)}</b>{s.balance > 0 && s.status !== 'voided' && <small className="muted block">due {lkr(s.balance)}</small>}</td>
                      <td><Badge tone={STATUS_TONE[s.status]}>{s.status.replace('_', ' ')}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <Empty title="No bills match" />}
            </div>
            <Pager {...pg} />
          </>
        ) : (
          <>
            <div className="tbl-wrap">
              <table className="table">
                <thead><tr><th>Return</th><th>Date</th><th>Original bill</th><th>Items</th><th>Type</th><th>Reason</th><th>Staff / approved</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {pgr.rows.map((x) => (
                    <tr key={x.id}>
                      <td><b>{x.no}</b></td>
                      <td>{fmtDateTime(x.date)}</td>
                      <td>{x.saleNo}</td>
                      <td className="muted">{x.lines.map((l) => `${l.qty}× ${l.title}${l.restock ? '' : ' (not restocked)'}`).join(', ')}</td>
                      <td><Badge tone="purple">{x.type === 'storeCredit' ? 'store credit' : x.type === 'balanceAdjustment' ? 'balance adj.' : x.type}</Badge></td>
                      <td className="muted">{x.reason}</td>
                      <td>{userName(users, x.staffId)}{x.approvedBy && <small className="muted block">✓ {userName(users, x.approvedBy)}</small>}</td>
                      <td className="r"><b>{lkr(x.amount)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rr.length === 0 && <Empty title="No returns in this period" />}
            </div>
            <Pager {...pgr} />
          </>
        )}
      </Card>
      {viewId && <BillDetail id={viewId} onClose={() => setViewId(null)} onReturn={(s) => { setViewId(null); setReturnFor(s) }} />}
      {returnFor && <ReturnModal sale={returnFor} onClose={() => setReturnFor(null)} />}
      {finding && <FindBill onClose={() => setFinding(false)} onPick={(b) => { setFinding(false); setReturnFor(b) }} />}
    </>
  )
}

/* ---------------- bill detail ---------------- */
function BillDetail({ id, onClose, onReturn }: { id: string; onClose: () => void; onReturn: (s: Sale) => void }) {
  const { sales, voidSale, users, returns } = useStore()
  const can = useCan()
  const s = sales.find((x) => x.id === id)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [print, setPrint] = useState(false)
  if (!s) return null
  const rs = returns.filter((r) => r.saleId === s.id)
  const canVoid = s.status === 'completed'
  const doVoid = async () => {
    let approver: string | undefined
    if (!can('void')) {
      const u = await requestApproval('void', `Void bill ${s.no} (${lkr(s.total)}). Stock will be restored.`)
      if (!u) return
      approver = u.id
    }
    voidSale(s.id, reason.trim(), approver)
    toast.success(`${s.no} voided`)
    setVoiding(false)
  }
  return (
    <>
      <Modal
        title={<span className="row gap-s">{s.no} <Badge tone={STATUS_TONE[s.status]}>{s.status.replace('_', ' ')}</Badge></span>}
        subtitle={`${fmtDateTime(s.date)} • Cashier ${userName(users, s.cashierId)} • ${s.customerName ?? 'Walk-in'}`}
        width={760}
        onClose={onClose}
        footer={
          <>
            <button className="btn" onClick={() => setPrint(true)}><Printer size={15} /> Reprint / PDF</button>
            <span className="grow" />
            {(s.status === 'completed' || s.status === 'partial_return') && <button className="btn" onClick={() => onReturn(s)}><Undo2 size={15} /> Return / exchange</button>}
            {canVoid && <button className="btn danger" onClick={() => setVoiding(true)}><Ban size={15} /> Void bill</button>}
          </>
        }
      >
        <div className="tbl-wrap">
          <table className="table compact">
            <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Discount</th><th className="r">Total</th></tr></thead>
            <tbody>
              {s.lines.map((l, i) => (
                <tr key={i}><td><b>{l.title}</b>{(l.returnedQty ?? 0) > 0 && <Badge tone="purple">{l.returnedQty} returned</Badge>}</td><td className="r">{l.qty}</td><td className="r">{lkr(l.price)}</td><td className="r">{l.discount ? lkr(l.discount) : '—'}</td><td className="r">{lkr(l.price * l.qty - l.discount)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid cols-2">
          <div className="summary-box">
            {s.payments.map((p, i) => <div key={i} className="tl"><span>{PAY_LABEL[p.method]}{p.ref ? ` (${p.ref})` : ''}</span><b>{lkr(p.amount)}</b></div>)}
            {s.change > 0 && <div className="tl"><span>Change given</span><b>{lkr(s.change)}</b></div>}
            {s.balance > 0 && <div className="tl"><span>Balance due</span><b className="red-text">{lkr(s.balance)}</b></div>}
          </div>
          <div className="summary-box">
            <div className="tl"><span>Subtotal</span><b>{lkr(s.subtotal)}</b></div>
            {s.discount > 0 && <div className="tl"><span>Bill discount</span><b>− {lkr(s.discount)}</b></div>}
            {s.tax > 0 && <div className="tl"><span>Tax</span><b>{lkr(s.tax)}</b></div>}
            <div className="tl grand"><span>Total</span><strong>{lkr(s.total)}</strong></div>
            {s.approvedBy && <small className="muted">Discount/credit approved by {userName(users, s.approvedBy)}</small>}
          </div>
        </div>
        {s.status === 'voided' && <p className="warn">Voided{s.voidedBy ? ` by ${userName(users, s.voidedBy)}` : ''}: {s.voidReason}</p>}
        {rs.length > 0 && <p className="muted small">Returns: {rs.map((r) => `${r.no} (${lkr(r.amount)})`).join(', ')}</p>}
      </Modal>
      {voiding && (
        <Modal title="Void this bill?" subtitle="Stock is restored and the sale is excluded from reports." width={460} onClose={() => setVoiding(false)}
          footer={<><button className="btn" onClick={() => setVoiding(false)}>Cancel</button><button className="btn danger" disabled={reason.trim().length < 3} onClick={doVoid}>Void bill</button></>}>
          <Field label="Reason (required)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="e.g. Wrong items scanned" /></Field>
          {!can('void') && <p className="warn small">You will be asked for a manager PIN.</p>}
        </Modal>
      )}
      {print && <ReceiptModal sale={s} title="Reprint receipt" onClose={() => setPrint(false)} />}
    </>
  )
}

/* ---------------- return modal ---------------- */
function ReturnModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const nav = useNavigate()
  const { settings, processReturn, customers, loadLines } = useStore()
  const can = useCan()
  const customer = customers.find((c) => c.id === sale.customerId)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [cond, setCond] = useState<Record<string, 'Good' | 'Damaged' | 'Opened'>>({})
  const [restock, setRestock] = useState<Record<string, boolean>>({})
  const [type, setType] = useState<SaleReturn['type']>('refund')
  const [method, setMethod] = useState<PayMethod>(sale.payments.find((p) => ['cash', 'card', 'bank', 'qr'].includes(p.method))?.method ?? 'cash')
  const [reason, setReason] = useState('')

  const age = Math.floor((Date.now() - new Date(sale.date).getTime()) / 86400000)
  const outside = age > settings.finance.returnWindowDays
  const billRatio = sale.subtotal > 0 ? sale.discount / sale.subtotal : 0
  const lines = sale.lines.map((l) => {
    const left = l.qty - (l.returnedQty ?? 0)
    const unit = ((l.price * l.qty - l.discount) / l.qty) * (1 - billRatio)
    return { l, left, unit }
  })
  const amount = round2(lines.reduce((a, x) => a + (qty[x.l.productId] ?? 0) * x.unit, 0))
  const any = lines.some((x) => (qty[x.l.productId] ?? 0) > 0)
  const needsApproval = !can('refund') || outside || (settings.finance.requireApprovalForRefund && amount > settings.finance.refundApprovalAbove)
  const typeOk = (type === 'storeCredit' || type === 'balanceAdjustment') ? !!customer : true
  const balanceOk = type !== 'balanceAdjustment' || (customer?.balance ?? 0) > 0

  const submit = async () => {
    let approver: string | undefined
    if (needsApproval) {
      const why = !can('refund') ? 'You do not have permission to process returns.' : outside ? `This bill is ${age} days old – beyond the ${settings.finance.returnWindowDays}-day return window.` : `Refund of ${lkr(amount)} exceeds the ${lkr(settings.finance.refundApprovalAbove, { decimals: false })} approval limit.`
      const u = await requestApproval('refund', why)
      if (!u) return
      approver = u.id
    }
    const ret = processReturn({
      saleId: sale.id,
      lines: lines.filter((x) => (qty[x.l.productId] ?? 0) > 0).map((x) => ({ productId: x.l.productId, qty: qty[x.l.productId], condition: cond[x.l.productId] ?? 'Good', restock: restock[x.l.productId] ?? (cond[x.l.productId] ?? 'Good') === 'Good' })),
      type,
      method: type === 'refund' ? method : undefined,
      reason: reason.trim(),
      approvedBy: approver,
    })
    if (!ret) return
    toast.success(`${ret.no} recorded – ${lkr(ret.amount)} ${type === 'refund' ? 'refunded' : type === 'exchange' ? 'to exchange' : 'credited'}`)
    onClose()
    if (type === 'exchange') {
      loadLines([], { advance: ret.amount, advanceRef: `Exchange ${ret.no}`, customerId: sale.customerId, note: `Exchange for ${sale.no}` })
      toast.info('Pick the replacement items – the return value is applied as credit')
      nav('/pos')
    }
  }

  return (
    <Modal
      title={`Return / exchange – ${sale.no}`}
      subtitle={`${fmtDateTime(sale.date)} • ${sale.customerName ?? 'Walk-in'} • ${age} day(s) ago`}
      width={800}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!any || reason.trim().length < 3 || !typeOk || !balanceOk} onClick={submit}>
            {type === 'refund' ? `Refund ${lkr(amount)}` : type === 'exchange' ? `Exchange – credit ${lkr(amount)}` : type === 'storeCredit' ? `Issue ${lkr(amount)} store credit` : `Reduce balance by ${lkr(amount)}`}
          </button>
        </>
      }
    >
      <div className="stack">
        {outside && <p className="warn small">Outside the {settings.finance.returnWindowDays}-day return window – manager approval will be required.</p>}
        <div className="tbl-wrap">
          <table className="table compact">
            <thead><tr><th>Item</th><th className="r">Returnable</th><th style={{ width: 110 }}>Return qty</th><th style={{ width: 130 }}>Condition</th><th>Restock</th><th className="r">Value</th></tr></thead>
            <tbody>
              {lines.map(({ l, left, unit }) => {
                const q = qty[l.productId] ?? 0
                const c = cond[l.productId] ?? 'Good'
                return (
                  <tr key={l.productId} className={left === 0 ? 'muted' : ''}>
                    <td><b>{l.title}</b><small className="muted block">{lkr(unit)} each (after discounts)</small></td>
                    <td className="r">{left}</td>
                    <td>{left > 0 ? <NumberInput value={q} max={left} onChange={(n) => setQty({ ...qty, [l.productId]: n })} /> : '—'}</td>
                    <td>
                      <select className="select" disabled={left === 0} value={c} onChange={(e) => { const v = e.target.value as 'Good' | 'Damaged' | 'Opened'; setCond({ ...cond, [l.productId]: v }); setRestock({ ...restock, [l.productId]: v === 'Good' }) }}>
                        <option>Good</option><option>Opened</option><option>Damaged</option>
                      </select>
                    </td>
                    <td><Checkbox checked={restock[l.productId] ?? c === 'Good'} onChange={(v) => setRestock({ ...restock, [l.productId]: v })}>Back to stock</Checkbox></td>
                    <td className="r">{q > 0 ? lkr(unit * q) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">Items are returned to saleable stock only when “Back to stock” is ticked — inspect them first.</p>
        <div className="grid cols-3">
          <Field label="Outcome">
            <select className="select" value={type} onChange={(e) => setType(e.target.value as SaleReturn['type'])}>
              <option value="refund">Refund money</option>
              <option value="exchange">Exchange for other items</option>
              <option value="storeCredit" disabled={!customer}>Store credit {customer ? '' : '(needs customer)'}</option>
              <option value="balanceAdjustment" disabled={!customer || (customer?.balance ?? 0) <= 0}>Reduce customer balance</option>
            </select>
          </Field>
          {type === 'refund' && (
            <Field label="Refund method">
              <select className="select" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
                {(['cash', 'card', 'bank', 'qr'] as PayMethod[]).map((m) => <option key={m} value={m}>{PAY_LABEL[m]}</option>)}
              </select>
            </Field>
          )}
          <Field label="Reason (required)" className={type === 'refund' ? '' : 'span2'}><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong edition, defective" /></Field>
        </div>
        {needsApproval && any && <p className="warn small">Manager approval (PIN) will be requested when you confirm.</p>}
      </div>
    </Modal>
  )
}

function FindBill({ onClose, onPick }: { onClose: () => void; onPick: (s: Sale) => void }) {
  const { sales } = useStore()
  const [q, setQ] = useState('')
  const list = sales
    .filter((s) => (s.status === 'completed' || s.status === 'partial_return') && (!q || s.no.toLowerCase().includes(q.toLowerCase()) || (s.customerName ?? '').toLowerCase().includes(q.toLowerCase()) || s.lines.some((l) => l.title.toLowerCase().includes(q.toLowerCase()))))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12)
  return (
    <Modal title="Find the original bill" subtitle="Type the receipt number from the customer’s receipt (or scan its barcode)" width={600} onClose={onClose}>
      <div className="stack">
        <SearchBox value={q} onChange={setQ} autoFocus placeholder="Receipt no., customer name or item…" />
        <div className="list">
          {list.map((s) => (
            <button key={s.id} className="list-row" onClick={() => onPick(s)}>
              <span><b>{s.no}</b><small className="muted block">{fmtDateTime(s.date)} • {s.customerName ?? 'Walk-in'} • {s.lines.length} items</small></span>
              <b>{lkr(s.total)}</b>
            </button>
          ))}
          {list.length === 0 && <p className="muted">No matching bills.</p>}
        </div>
      </div>
    </Modal>
  )
}
