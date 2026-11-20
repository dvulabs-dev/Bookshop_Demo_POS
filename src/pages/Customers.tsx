import { useMemo, useState } from 'react'
import { Download, Edit3, Gift, MessageCircle, Plus, Trash2, Wallet } from 'lucide-react'
import { useCan, useStore } from '../store/useStore'
import { Badge, Card, Empty, Field, Modal, NumberInput, PageHeader, Pager, SearchBox, Stat, Tabs, usePaged } from '../components/ui'
import { ReceiptModal } from '../components/Receipt'
import { confirmDialog, toast } from '../components/dialogs'
import { PAY_LABEL } from '../lib/calc'
import { downloadCsv, fmtDate, fmtDateTime, lkr, uid } from '../lib/utils'
import type { Customer, Sale } from '../types'
import { useT } from '../i18n'

const GROUPS: Customer['group'][] = ['Regular', 'Student', 'Teacher', 'School', 'Wholesale']
const GROUP_TONE = { Regular: 'gray', Student: 'blue', Teacher: 'purple', School: 'teal', Wholesale: 'amber' } as const

export default function Customers() {
  const t = useT()
  const can = useCan()
  const { customers, sales, saveCustomer, deleteCustomer } = useStore()
  const canEdit = can('customers')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [owing, setOwing] = useState(false)
  const [edit, setEdit] = useState<Customer | null>(null)
  const [view, setView] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      customers
        .filter((c) => (!group || c.group === group) && (!owing || c.balance > 0))
        .filter((c) => !q || [c.name, c.phone, c.code, c.email ?? ''].some((x) => x.toLowerCase().includes(q.toLowerCase())))
        .map((c) => {
          const cs = sales.filter((s) => s.customerId === c.id && s.status !== 'voided')
          return { c, bills: cs.length, spent: cs.reduce((a, s) => a + s.total, 0), last: cs.map((s) => s.date).sort().pop() }
        })
        .sort((a, b) => b.spent - a.spent),
    [customers, sales, q, group, owing],
  )
  const pg = usePaged(rows, 12)
  const totalOwed = customers.reduce((a, c) => a + c.balance, 0)

  const blank = (): Customer => ({
    id: uid('c'),
    code: `CUS-${String(customers.length + 1).padStart(4, '0')}`,
    name: '',
    phone: '',
    group: 'Regular',
    discountPct: 0,
    points: 0,
    balance: 0,
    deposit: 0,
    creditLimit: 0,
    contactPref: 'WhatsApp',
    createdAt: new Date().toISOString(),
  })

  return (
    <>
      <PageHeader
        title={t('Customers')}
        subtitle="Regular customers, parents, students, teachers, schools and wholesale buyers"
        actions={
          <>
            {can('export') && (
              <button className="btn" onClick={() => downloadCsv('customers.csv', [['code', 'name', 'phone', 'email', 'group', 'balance', 'points'], ...rows.map(({ c }) => [c.code, c.name, c.phone, c.email, c.group, c.balance, c.points])])}>
                <Download size={16} /> Export
              </button>
            )}
            {canEdit && <button className="btn primary" onClick={() => setEdit(blank())}><Plus size={16} /> Add customer</button>}
          </>
        }
      />
      <div className="grid cols-3">
        <Stat label="Customers" value={customers.length} tone="blue" />
        <Stat label="Outstanding balances" value={lkr(totalOwed, { decimals: false })} sub={`${customers.filter((c) => c.balance > 0).length} customers owe`} tone="amber" />
        <Stat label="Loyalty points issued" value={customers.reduce((a, c) => a + c.points, 0).toLocaleString()} tone="purple" />
      </div>
      <Card pad={false}>
        <div className="filters">
          <div className="grow"><SearchBox value={q} onChange={setQ} placeholder="Search by name, phone number or customer ID…" /></div>
          <select className="select" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">All groups</option>
            {GROUPS.map((g) => <option key={g}>{g}</option>)}
          </select>
          <label className="checkbox"><input type="checkbox" checked={owing} onChange={(e) => setOwing(e.target.checked)} /><span className="box">{owing ? '✓' : ''}</span> Owing only</label>
        </div>
        <div className="tbl-wrap">
          <table className="table">
            <thead><tr><th>Customer</th><th>Phone</th><th>Group</th><th className="r">Bills</th><th className="r">Total spent</th><th className="r">Points</th><th className="r">Balance</th><th>Last purchase</th><th /></tr></thead>
            <tbody>
              {pg.rows.map(({ c, bills, spent, last }) => (
                <tr key={c.id} className="clickable" onClick={() => setView(c.id)}>
                  <td><b>{c.name}</b><small className="muted block">{c.code}</small></td>
                  <td>{c.phone}</td>
                  <td><Badge tone={GROUP_TONE[c.group]}>{c.group}</Badge></td>
                  <td className="r">{bills}</td>
                  <td className="r">{lkr(spent, { decimals: false })}</td>
                  <td className="r">{c.points}</td>
                  <td className="r">{c.balance > 0 ? <Badge tone="amber">{lkr(c.balance, { decimals: false })}</Badge> : '—'}</td>
                  <td>{fmtDate(last)}</td>
                  <td className="r" onClick={(e) => e.stopPropagation()}>{canEdit && <button className="icon-btn sm" onClick={() => setEdit(c)}><Edit3 size={15} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty title="No customers found" />}
        </div>
        <Pager {...pg} />
      </Card>

      {edit && (
        <CustomerForm
          initial={edit}
          isNew={!customers.some((c) => c.id === edit.id)}
          canCredit={can('credit')}
          onClose={() => setEdit(null)}
          onSave={(c) => { saveCustomer(c); toast.success('Customer saved'); setEdit(null) }}
          onDelete={async () => { if (await confirmDialog({ title: 'Delete customer?', message: `${edit.name} will be removed. Their past bills stay in sales history.`, danger: true, confirmLabel: 'Delete' })) { deleteCustomer(edit.id); setEdit(null) } }}
        />
      )}
      {view && <CustomerView id={view} onClose={() => setView(null)} onEdit={(c) => { setView(null); setEdit(c) }} />}
    </>
  )
}

function CustomerForm({ initial, isNew, canCredit, onClose, onSave, onDelete }: { initial: Customer; isNew: boolean; canCredit: boolean; onClose: () => void; onSave: (c: Customer) => void; onDelete: () => void }) {
  const [c, setC] = useState(initial)
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setC({ ...c, [k]: v })
  return (
    <Modal
      title={isNew ? 'Add customer' : 'Edit customer'}
      subtitle={c.code}
      width={680}
      onClose={onClose}
      footer={<>{!isNew && <button className="btn danger ghost" onClick={onDelete}><Trash2 size={15} /> Delete</button>}<span className="grow" /><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!c.name.trim() || !c.phone.trim()} onClick={() => onSave({ ...c, name: c.name.trim() })}>Save customer</button></>}
    >
      <div className="grid cols-2">
        <Field label="Name" required><input className="input" value={c.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <Field label="Telephone" required><input className="input" value={c.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" value={c.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Address"><input className="input" value={c.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Customer group">
          <select className="select" value={c.group} onChange={(e) => set('group', e.target.value as Customer['group'])}>
            {GROUPS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Preferred contact method">
          <select className="select" value={c.contactPref} onChange={(e) => set('contactPref', e.target.value as Customer['contactPref'])}>
            {['Phone', 'WhatsApp', 'Email', 'SMS'].map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Customer-specific discount (%)"><NumberInput value={c.discountPct} max={50} onChange={(n) => set('discountPct', n)} /></Field>
        <Field label="Credit limit (Rs.)" hint={canCredit ? 'Set above 0 to allow credit / part-payment sales' : 'Needs “credit” permission'}>
          <NumberInput value={c.creditLimit} disabled={!canCredit} onChange={(n) => set('creditLimit', n)} />
        </Field>
        <Field label="Notes" className="span2"><textarea className="input" rows={3} value={c.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function CustomerView({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (c: Customer) => void }) {
  const { customers, sales, returns, customerPayments, receiveCustomerPayment, settings } = useStore()
  const can = useCan()
  const c = customers.find((x) => x.id === id)
  const [tab, setTab] = useState<'bills' | 'returns' | 'payments'>('bills')
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [pay, setPay] = useState({ amount: 0, method: 'cash' as 'cash' | 'card' | 'bank' | 'qr', ref: '' })
  if (!c) return null
  const cs = sales.filter((s) => s.customerId === c.id).sort((a, b) => b.date.localeCompare(a.date))
  const rs = returns.filter((r) => cs.some((s) => s.id === r.saleId))
  const ps = customerPayments.filter((p) => p.customerId === c.id)
  const spent = cs.filter((s) => s.status !== 'voided').reduce((a, s) => a + s.total, 0)
  return (
    <>
      <Modal
        title={c.name}
        subtitle={`${c.code} • ${c.group} • ${c.phone}${c.email ? ` • ${c.email}` : ''}`}
        width={800}
        onClose={onClose}
        footer={<>
          <a className="btn" href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^0/, '94')}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
          <span className="grow" />
          {can('customers') && <button className="btn" onClick={() => onEdit(c)}><Edit3 size={15} /> Edit</button>}
          <button className="btn primary" onClick={onClose}>Close</button>
        </>}
      >
        <div className="grid cols-4">
          <Stat label="Total spent" value={lkr(spent, { decimals: false })} tone="green" />
          <Stat label="Outstanding" value={lkr(c.balance, { decimals: false })} tone={c.balance > 0 ? 'amber' : 'gray'} sub={c.creditLimit ? `Limit ${lkr(c.creditLimit, { decimals: false })}` : 'No credit'} />
          <Stat label="Loyalty points" value={c.points} tone="purple" icon={<Gift size={18} />} sub={settings.pos.loyaltyEnabled ? `Worth ${lkr(c.points * settings.pos.pointValue, { decimals: false })}` : 'Loyalty disabled'} />
          <Stat label="Store credit" value={lkr(c.deposit, { decimals: false })} tone="blue" />
        </div>
        {c.notes && <p className="summary-box small">📝 {c.notes}</p>}
        {c.balance > 0 && can('credit') && (
          <div className="summary-box">
            <div className="row gap wrap">
              <Wallet size={18} />
              <b>Receive payment</b>
              <div style={{ width: 130 }}><NumberInput value={pay.amount} max={c.balance} onChange={(n) => setPay({ ...pay, amount: n })} placeholder={String(c.balance)} /></div>
              <select className="select" style={{ width: 150 }} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as typeof pay.method })}>
                {(['cash', 'card', 'bank', 'qr'] as const).map((m) => <option key={m} value={m}>{PAY_LABEL[m]}</option>)}
              </select>
              <button className="btn" onClick={() => setPay({ ...pay, amount: c.balance })}>Full balance</button>
              <button className="btn primary" disabled={pay.amount <= 0} onClick={() => { receiveCustomerPayment(c.id, pay.amount, pay.method, pay.ref || undefined); toast.success(`Received ${lkr(pay.amount)}`); setPay({ ...pay, amount: 0 }) }}>Record</button>
            </div>
          </div>
        )}
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'bills', label: 'Purchase history', count: cs.length }, { id: 'returns', label: 'Returned items', count: rs.length }, { id: 'payments', label: 'Payments received', count: ps.length }]} />
        <div className="tbl-wrap" style={{ maxHeight: 300 }}>
          {tab === 'bills' && (
            <table className="table compact">
              <thead><tr><th>Receipt</th><th>Date</th><th>Items</th><th className="r">Total</th><th className="r">Due</th></tr></thead>
              <tbody>{cs.map((s) => <tr key={s.id} className="clickable" onClick={() => setReceipt(s)}><td><b>{s.no}</b></td><td>{fmtDateTime(s.date)}</td><td className="muted">{s.lines.map((l) => l.title).join(', ').slice(0, 60)}…</td><td className="r">{lkr(s.total)}</td><td className="r">{s.balance > 0 ? <Badge tone="amber">{lkr(s.balance)}</Badge> : '—'}</td></tr>)}</tbody>
            </table>
          )}
          {tab === 'returns' && (
            <table className="table compact">
              <thead><tr><th>Return</th><th>Date</th><th>Items</th><th className="r">Amount</th></tr></thead>
              <tbody>{rs.map((r) => <tr key={r.id}><td><b>{r.no}</b></td><td>{fmtDate(r.date)}</td><td>{r.lines.map((l) => `${l.qty}× ${l.title}`).join(', ')}</td><td className="r">{lkr(r.amount)}</td></tr>)}</tbody>
            </table>
          )}
          {tab === 'payments' && (
            <table className="table compact">
              <thead><tr><th>Date</th><th>Method</th><th className="r">Amount</th></tr></thead>
              <tbody>{ps.map((p) => <tr key={p.id}><td>{fmtDateTime(p.date)}</td><td>{PAY_LABEL[p.method]}</td><td className="r">{lkr(p.amount)}</td></tr>)}</tbody>
            </table>
          )}
          {((tab === 'bills' && !cs.length) || (tab === 'returns' && !rs.length) || (tab === 'payments' && !ps.length)) && <Empty title="Nothing here yet" />}
        </div>
      </Modal>
      {receipt && <ReceiptModal sale={receipt} title="Receipt copy" onClose={() => setReceipt(null)} />}
    </>
  )
}
