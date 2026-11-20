import { useMemo, useState } from 'react'
import { Download, Edit3, Lock, Paperclip, Plus, Repeat, Trash2, Wallet } from 'lucide-react'
import { useCan, useCurrentUser, useStore, userName } from '../store/useStore'
import { Badge, Card, Empty, Field, Modal, NumberInput, PageHeader, Pager, Stat, Tabs, usePaged } from '../components/ui'
import { DateRangeBar, initialRange } from '../components/DateRange'
import { confirmDialog, toast } from '../components/dialogs'
import { PAY_LABEL, shiftCashBreakdown } from '../lib/calc'
import { expensesIn, inRange, makeRange, sumExpenses } from '../lib/analytics'
import { downloadCsv, fmtDate, fmtDateTime, lkr, toInputDate, uid } from '../lib/utils'
import type { Expense, PayMethod, Shift } from '../types'
import { CHART } from '../lib/colors'

export default function Cash() {
  const can = useCan()
  const [tab, setTab] = useState<'shifts' | 'expenses'>('shifts')
  return (
    <>
      <PageHeader title="Cash & Expenses" subtitle="Cashier shifts, cash reconciliation and shop expenses" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'shifts', label: 'Cashier shifts' }, ...(can('finance') ? [{ id: 'expenses' as const, label: 'Expenses' }] : [])]} />
      {tab === 'shifts' ? <Shifts /> : <Expenses />}
    </>
  )
}

/* ============================ shifts ============================ */
function Shifts() {
  const state = useStore()
  const { shifts, users, openShift } = state
  const me = useCurrentUser()
  const can = useCan()
  const [closing, setClosing] = useState<Shift | null>(null)
  const [opening, setOpening] = useState(false)
  const [cash, setCash] = useState(5000)
  const [range, setRange] = useState(initialRange('30d'))
  const r = makeRange(range.from, range.to)

  const open = shifts.filter((s) => !s.closedAt)
  const mine = open.find((s) => s.cashierId === me?.id)
  const history = useMemo(() => shifts.filter((s) => s.closedAt && inRange(s.openedAt, r)).sort((a, b) => b.openedAt.localeCompare(a.openedAt)), [shifts, range]) // eslint-disable-line react-hooks/exhaustive-deps
  const pg = usePaged(history, 12)
  const visibleOpen = can('finance') ? open : open.filter((s) => s.cashierId === me?.id)

  return (
    <>
      <div className="grid cols-2">
        {visibleOpen.map((sh) => {
          const b = shiftCashBreakdown(sh, state)
          return (
            <Card key={sh.id} title={<span className="row gap-s"><Wallet size={18} /> Open shift – {userName(users, sh.cashierId)}</span>} actions={(sh.cashierId === me?.id || can('finance')) && <button className="btn primary sm" onClick={() => setClosing(sh)}><Lock size={14} /> Close shift</button>}>
              <small className="muted">Opened {fmtDateTime(sh.openedAt)}</small>
              <div className="grid cols-3 mt">
                <Stat label="Bills" value={b.bills} tone="blue" />
                <Stat label="Sales" value={lkr(b.salesTotal, { decimals: false })} tone="green" />
                <Stat label="Cash expected" value={lkr(b.expected, { decimals: false })} tone="teal" />
              </div>
              <div className="chips mt">
                <span className="chip">Opening {lkr(sh.openingCash, { decimals: false })}</span>
                <span className="chip">Cash sales {lkr(b.cashSales, { decimals: false })}</span>
                <span className="chip">Card {lkr(b.card, { decimals: false })}</span>
                <span className="chip">Bank {lkr(b.bank, { decimals: false })}</span>
                <span className="chip">QR {lkr(b.qr, { decimals: false })}</span>
                {b.refundsCash > 0 && <span className="chip">Cash refunds −{lkr(b.refundsCash, { decimals: false })}</span>}
                {b.expCash > 0 && <span className="chip">Cash expenses −{lkr(b.expCash, { decimals: false })}</span>}
              </div>
            </Card>
          )
        })}
        {!mine && can('pos') && (
          <Card title="Start a shift">
            <p className="muted">You have no open shift. Open one to take sales at the POS.</p>
            <button className="btn primary mt" onClick={() => setOpening(true)}>Open shift</button>
          </Card>
        )}
        {visibleOpen.length === 0 && !can('pos') && <Card><Empty title="No open shifts" /></Card>}
      </div>

      <Card
        title="Shift history & reconciliation"
        pad={false}
        actions={<><DateRangeBar value={range} onChange={setRange} presets={['7d', '30d', 'month', 'lastmonth', 'custom']} /></>}
      >
        <div className="tbl-wrap">
          <table className="table">
            <thead><tr><th>Cashier</th><th>Opened</th><th>Closed</th><th className="r">Opening</th><th className="r">Expected</th><th className="r">Counted</th><th className="r">Difference</th><th>Note</th></tr></thead>
            <tbody>
              {pg.rows.filter((s) => can('finance') || s.cashierId === me?.id).map((s) => (
                <tr key={s.id}>
                  <td><b>{userName(users, s.cashierId)}</b></td>
                  <td>{fmtDateTime(s.openedAt)}</td>
                  <td>{fmtDateTime(s.closedAt)}</td>
                  <td className="r">{lkr(s.openingCash)}</td>
                  <td className="r">{lkr(s.expectedCash ?? 0)}</td>
                  <td className="r">{lkr(s.countedCash ?? 0)}</td>
                  <td className="r"><Badge tone={!s.difference ? 'green' : s.difference > 0 ? 'blue' : 'red'}>{!s.difference ? 'Balanced' : `${s.difference > 0 ? '+' : ''}${lkr(s.difference)}`}</Badge></td>
                  <td className="muted">{s.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && <Empty title="No closed shifts in this period" />}
        </div>
        <Pager {...pg} />
      </Card>

      {closing && <CloseShift shift={closing} onClose={() => setClosing(null)} />}
      {opening && (
        <Modal title="Open shift" width={420} onClose={() => setOpening(false)} footer={<><button className="btn" onClick={() => setOpening(false)}>Cancel</button><button className="btn primary" onClick={() => { openShift(cash); setOpening(false); toast.success('Shift opened') }}>Open shift</button></>}>
          <Field label="Opening cash in drawer (Rs.)"><NumberInput value={cash} onChange={setCash} autoFocus /></Field>
        </Modal>
      )}
    </>
  )
}

function CloseShift({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const state = useStore()
  const b = shiftCashBreakdown(shift, state)
  const [counted, setCounted] = useState(b.expected)
  const [note, setNote] = useState('')
  const diff = Math.round((counted - b.expected) * 100) / 100
  return (
    <Modal
      title="Close shift & reconcile cash"
      subtitle={`${userName(state.users, shift.cashierId)} • opened ${fmtDateTime(shift.openedAt)}`}
      width={560}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => { state.closeShift(shift.id, counted, note || undefined); toast.success(diff === 0 ? 'Shift closed – cash balanced' : `Shift closed – difference ${lkr(diff)}`); onClose() }}>Close shift</button></>}
    >
      <div className="stack">
        <div className="summary-box">
          <div className="tl"><span>Opening cash</span><b>{lkr(shift.openingCash)}</b></div>
          <div className="tl"><span>+ Cash sales ({b.bills} bills)</span><b>{lkr(b.cashSales)}</b></div>
          {b.custCash > 0 && <div className="tl"><span>+ Customer payments (cash)</span><b>{lkr(b.custCash)}</b></div>}
          {b.refundsCash > 0 && <div className="tl"><span>− Cash refunds</span><b>{lkr(b.refundsCash)}</b></div>}
          {b.expCash > 0 && <div className="tl"><span>− Cash expenses</span><b>{lkr(b.expCash)}</b></div>}
          <div className="tl grand"><span>Expected in drawer</span><strong>{lkr(b.expected)}</strong></div>
        </div>
        <div className="chips">
          <span className="chip">Card {lkr(b.card, { decimals: false })}</span>
          <span className="chip">Bank {lkr(b.bank, { decimals: false })}</span>
          <span className="chip">QR {lkr(b.qr, { decimals: false })}</span>
          {b.advance > 0 && <span className="chip">Advances {lkr(b.advance, { decimals: false })}</span>}
          {b.storeCredit > 0 && <span className="chip">Store credit {lkr(b.storeCredit, { decimals: false })}</span>}
        </div>
        <Field label="Counted cash in drawer (Rs.)"><NumberInput value={counted} onChange={setCounted} autoFocus /></Field>
        <div className={`recon ${diff === 0 ? 'ok' : 'bad'}`}>{diff === 0 ? '✓ Cash balances' : diff > 0 ? `Over by ${lkr(diff)}` : `Short by ${lkr(Math.abs(diff))}`}</div>
        {diff !== 0 && <Field label="Explain the difference"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>}
      </div>
    </Modal>
  )
}

/* ============================ expenses ============================ */
function Expenses() {
  const { expenses, settings, saveExpense, deleteExpense, users, currentUserId } = useStore()
  const [range, setRange] = useState(initialRange('month'))
  const [cat, setCat] = useState('')
  const [edit, setEdit] = useState<Expense | null>(null)
  const r = makeRange(range.from, range.to)
  const rows = useMemo(() => expensesIn(expenses, r).filter((e) => !cat || e.category === cat).sort((a, b) => b.date.localeCompare(a.date)), [expenses, range, cat]) // eslint-disable-line react-hooks/exhaustive-deps
  const pg = usePaged(rows, 12)
  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    expensesIn(expenses, r).forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses, range]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = sumExpenses(expensesIn(expenses, r))
  const recurring = expenses.filter((e) => e.recurring)
  const recurringMonthly = [...new Map(recurring.map((e) => [e.category + e.note, e])).values()]

  return (
    <>
      <div className="grid cols-3">
        <Stat label="Expenses (selected period)" value={lkr(total, { decimals: false })} tone="red" />
        <Stat label="Recurring monthly costs" value={lkr(recurringMonthly.reduce((a, e) => a + e.amount, 0), { decimals: false })} sub={`${recurringMonthly.length} recurring items`} tone="amber" icon={<Repeat size={18} />} />
        <Stat label="Entries" value={rows.length} tone="blue" />
      </div>
      <div className="grid cols-3-2">
        <Card
          title="Expense records"
          pad={false}
          actions={
            <>
              <DateRangeBar value={range} onChange={setRange} presets={['today', '7d', 'month', 'lastmonth', 'year', 'custom']} />
              <button className="btn sm" onClick={() => downloadCsv('expenses.csv', [['date', 'category', 'amount', 'method', 'note'], ...rows.map((e) => [e.date, e.category, e.amount, e.method, e.note])])}><Download size={14} /></button>
              <button className="btn primary sm" onClick={() => setEdit({ id: uid('ex'), date: new Date().toISOString(), category: settings.finance.expenseCategories[0], amount: 0, method: 'cash', userId: currentUserId ?? '' })}><Plus size={15} /> Add expense</button>
            </>
          }
        >
          <div className="filters">
            <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories</option>
              {settings.finance.expenseCategories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="tbl-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Method</th><th>By</th><th className="r">Amount</th><th /></tr></thead>
              <tbody>
                {pg.rows.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.date)}</td>
                    <td><b>{e.category}</b>{e.recurring && <Badge tone="amber">recurring</Badge>}</td>
                    <td className="muted">{e.note ?? '—'}{e.attachment && <small className="block"><Paperclip size={11} /> {e.attachment}</small>}</td>
                    <td>{PAY_LABEL[e.method]}</td>
                    <td>{userName(users, e.userId)}</td>
                    <td className="r"><b>{lkr(e.amount)}</b></td>
                    <td className="r nowrap">
                      <button className="icon-btn sm" onClick={() => setEdit(e)}><Edit3 size={14} /></button>
                      <button className="icon-btn sm" onClick={async () => { if (await confirmDialog({ title: 'Delete expense?', message: `${e.category} – ${lkr(e.amount)}`, danger: true, confirmLabel: 'Delete' })) deleteExpense(e.id) }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <Empty title="No expenses in this period" />}
          </div>
          <Pager {...pg} />
        </Card>
        <Card title="By category">
          <div className="bars">
            {byCat.map(([c, v], i) => (
              <div key={c} className="bar-row">
                <div className="row between"><span>{c}</span><b>{lkr(v, { decimals: false })}</b></div>
                <div className="bar"><i style={{ width: `${(v / (byCat[0]?.[1] || 1)) * 100}%`, background: CHART[i % CHART.length] }} /></div>
              </div>
            ))}
            {byCat.length === 0 && <p className="muted">—</p>}
          </div>
        </Card>
      </div>
      {edit && (
        <Modal title={expenses.some((e) => e.id === edit.id) ? 'Edit expense' : 'Record expense'} width={560} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" disabled={edit.amount <= 0} onClick={() => { saveExpense(edit); toast.success('Expense saved'); setEdit(null) }}>Save expense</button></>}>
          <div className="grid cols-2">
            <Field label="Category"><select className="select" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{settings.finance.expenseCategories.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Amount (Rs.)" required><NumberInput value={edit.amount} onChange={(n) => setEdit({ ...edit, amount: n })} autoFocus /></Field>
            <Field label="Date"><input className="input" type="date" value={toInputDate(edit.date)} onChange={(e) => setEdit({ ...edit, date: new Date(e.target.value + 'T12:00:00').toISOString() })} /></Field>
            <Field label="Paid by" hint={edit.method === 'cash' ? 'Cash expenses reduce the drawer total of your open shift' : undefined}>
              <select className="select" value={edit.method} onChange={(e) => setEdit({ ...edit, method: e.target.value as PayMethod })}>{(['cash', 'bank', 'card', 'qr'] as PayMethod[]).map((m) => <option key={m} value={m}>{PAY_LABEL[m]}</option>)}</select>
            </Field>
            <Field label="Recurring">
              <select className="select" value={edit.recurring ?? ''} onChange={(e) => setEdit({ ...edit, recurring: (e.target.value || null) as Expense['recurring'] })}>
                <option value="">One-time</option><option value="monthly">Every month</option><option value="weekly">Every week</option>
              </select>
            </Field>
            <Field label="Supporting document">
              <label className="file-pick"><Paperclip size={14} /> {edit.attachment || 'Attach bill / photo'}<input type="file" hidden onChange={(e) => setEdit({ ...edit, attachment: e.target.files?.[0]?.name })} /></label>
            </Field>
            <Field label="Note" className="span2"><input className="input" value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  )
}
