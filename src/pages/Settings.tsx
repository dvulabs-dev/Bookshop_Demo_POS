import { useMemo, useRef, useState } from 'react'
import { Download, Plus, RotateCcw, Upload, X } from 'lucide-react'
import { useCan, useStore } from '../store/useStore'
import { Card, Field, NumberInput, PageHeader, Segmented, Tabs, Toggle } from '../components/ui'
import { ReceiptView } from '../components/Receipt'
import { confirmDialog, toast } from '../components/dialogs'
import { PAY_LABEL } from '../lib/calc'
import { downloadCsv } from '../lib/utils'
import type { Sale, Settings, ToggleMethod } from '../types'

type Tab = 'business' | 'pos' | 'receipt' | 'inventory' | 'finance' | 'appearance' | 'data'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('business')
  return (
    <>
      <PageHeader title="Settings" subtitle="Change everyday business settings without needing a developer. Changes save automatically." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'business', label: 'Business profile' },
        { id: 'pos', label: 'POS & sales' },
        { id: 'receipt', label: 'Receipts' },
        { id: 'inventory', label: 'Products & inventory' },
        { id: 'finance', label: 'Payments & finance' },
        { id: 'appearance', label: 'Appearance & alerts' },
        { id: 'data', label: 'Data & security' },
      ]} />
      {tab === 'business' && <Business />}
      {tab === 'pos' && <PosSettings />}
      {tab === 'receipt' && <ReceiptSettings />}
      {tab === 'inventory' && <InventorySettings />}
      {tab === 'finance' && <FinanceSettings />}
      {tab === 'appearance' && <Appearance />}
      {tab === 'data' && <DataSecurity />}
    </>
  )
}

function useSet() {
  const setSettings = useStore((s) => s.setSettings)
  const settings = useStore((s) => s.settings)
  const upd = <K extends keyof Settings>(k: K, patch: Partial<Settings[K]>) => setSettings((s) => ({ ...s, [k]: { ...s[k], ...patch } }))
  return { settings, upd }
}

function Business() {
  const { settings, upd } = useSet()
  const b = settings.business
  const logo = useRef<HTMLInputElement>(null)
  return (
    <Card title="Business profile">
      <div className="grid cols-2">
        <Field label="Shop name"><input className="input" value={b.name} onChange={(e) => upd('business', { name: e.target.value })} /></Field>
        <Field label="Tagline"><input className="input" value={b.tagline} onChange={(e) => upd('business', { tagline: e.target.value })} /></Field>
        <Field label="Address" className="span2"><input className="input" value={b.address} onChange={(e) => upd('business', { address: e.target.value })} /></Field>
        <Field label="Telephone"><input className="input" value={b.phone} onChange={(e) => upd('business', { phone: e.target.value })} /></Field>
        <Field label="Email"><input className="input" value={b.email} onChange={(e) => upd('business', { email: e.target.value })} /></Field>
        <Field label="Opening hours"><input className="input" value={b.hours} onChange={(e) => upd('business', { hours: e.target.value })} /></Field>
        <Field label="Registration details (optional)"><input className="input" value={b.regNo} onChange={(e) => upd('business', { regNo: e.target.value })} /></Field>
        <Field label="Shop logo" hint="The demo uses the DVULabs placeholder mark. Logo upload is available in the production build.">
          <input ref={logo} type="file" accept="image/*" hidden onChange={() => toast.info('Logo upload is part of the full system – the placeholder logo is shown in this demo')} />
          <button className="btn" onClick={() => logo.current?.click()}><Upload size={15} /> Upload / replace logo</button>
        </Field>
      </div>
      <ListEditor title="Branches / stock locations" items={b.branches} onChange={(branches) => upd('business', { branches })} hint="Multi-branch operation is a future expansion; the structure is ready for it." />
    </Card>
  )
}

function PosSettings() {
  const { settings, upd } = useSet()
  const p = settings.pos
  return (
    <div className="grid cols-2">
      <Card title="Selling rules">
        <div className="stack">
          <Toggle checked={p.requireShift} onChange={(v) => upd('pos', { requireShift: v })} label="Require an open cashier shift to sell" hint="Needed for cash reconciliation" />
          <Toggle checked={p.allowPriceEdit} onChange={(v) => upd('pos', { allowPriceEdit: v })} label="Allow price editing during a sale" hint="Staff without price permission still need manager approval" />
          <Toggle checked={p.allowParking} onChange={(v) => upd('pos', { allowParking: v })} label="Allow parking / holding bills" />
          <Toggle checked={p.allowCredit} onChange={(v) => upd('pos', { allowCredit: v })} label="Allow credit & part-payment sales" hint="Only for registered customers with a credit limit" />
          <Field label="Cashier discount limit (%)" hint="Discounts above this need manager approval"><NumberInput value={p.cashierDiscountPct} max={100} onChange={(n) => upd('pos', { cashierDiscountPct: n })} /></Field>
          <Field label="Walk-in customer label"><input className="input" value={p.walkInLabel} onChange={(e) => upd('pos', { walkInLabel: e.target.value })} /></Field>
        </div>
      </Card>
      <Card title="Payment methods & tax">
        <div className="stack">
          {(Object.keys(p.methods) as ToggleMethod[]).map((m) => (
            <Toggle key={m} checked={p.methods[m]} onChange={(v) => upd('pos', { methods: { ...p.methods, [m]: v } })} label={PAY_LABEL[m]} />
          ))}
          <div className="divider" />
          <div className="grid cols-2">
            <Field label="Tax label"><input className="input" value={p.taxLabel} onChange={(e) => upd('pos', { taxLabel: e.target.value })} /></Field>
            <Field label="Tax rate (%)" hint="0 = no tax added (books are usually exempt)"><NumberInput value={p.taxPct} max={50} step={0.5} onChange={(n) => upd('pos', { taxPct: n })} /></Field>
          </div>
          <div className="divider" />
          <Toggle checked={p.loyaltyEnabled} onChange={(v) => upd('pos', { loyaltyEnabled: v })} label="Customer loyalty points" />
          {p.loyaltyEnabled && (
            <div className="grid cols-2">
              <Field label="Rs. spent per 1 point"><NumberInput value={p.pointsPerLkr} onChange={(n) => upd('pos', { pointsPerLkr: Math.max(1, n) })} /></Field>
              <Field label="Value of 1 point (Rs.)"><NumberInput value={p.pointValue} step={0.5} onChange={(n) => upd('pos', { pointValue: n })} /></Field>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function ReceiptSettings() {
  const { settings, upd } = useSet()
  const { products, users } = useStore()
  const r = settings.receipt
  const sample: Sale = useMemo(() => {
    const ps = products.slice(0, 3)
    const lines = ps.map((p, i) => ({ productId: p.id, title: p.title, code: p.code, barcode: p.barcode, qty: i + 1, price: p.price, cost: p.cost, discount: i === 0 ? 50 : 0 }))
    const subtotal = lines.reduce((a, l) => a + l.price * l.qty - l.discount, 0)
    return { id: 'sample', no: `${r.prefix}${String(r.nextNo).padStart(6, '0')}`, date: new Date().toISOString(), cashierId: users[2]?.id ?? '', customerName: 'Sample Customer', lines, subtotal, discount: 0, tax: 0, total: subtotal, payments: [{ method: 'cash', amount: subtotal }], paid: subtotal, change: 200, balance: 0, status: 'completed' }
  }, [products, users, r.prefix, r.nextNo])
  return (
    <div className="grid cols-3-2">
      <Card title="Receipt customisation">
        <div className="stack">
          <Field label="Layout"><Segmented value={r.layout} onChange={(v) => upd('receipt', { layout: v })} options={[{ id: 'thermal', label: 'Thermal receipt (80mm)' }, { id: 'a4', label: 'A4 invoice' }]} /></Field>
          <div className="grid cols-2">
            <Field label="Receipt prefix"><input className="input mono" value={r.prefix} onChange={(e) => upd('receipt', { prefix: e.target.value })} /></Field>
            <Field label="Next receipt number"><NumberInput value={r.nextNo} onChange={(n) => upd('receipt', { nextNo: Math.max(1, n) })} /></Field>
          </div>
          <Field label="Thank-you message"><input className="input" value={r.thankYou} onChange={(e) => upd('receipt', { thankYou: e.target.value })} /></Field>
          <Field label="Footer wording"><input className="input" value={r.footer} onChange={(e) => upd('receipt', { footer: e.target.value })} /></Field>
          <Field label="Return / exchange policy"><textarea className="input" rows={2} value={r.returnPolicy} onChange={(e) => upd('receipt', { returnPolicy: e.target.value })} /></Field>
          <Field label="Tax information (optional)"><input className="input" value={r.taxInfo} onChange={(e) => upd('receipt', { taxInfo: e.target.value })} placeholder="e.g. VAT Reg. No." /></Field>
          <div className="grid cols-2">
            <Toggle checked={r.showIsbn} onChange={(v) => upd('receipt', { showIsbn: v })} label="Show ISBN / barcode" />
            <Toggle checked={r.showCashier} onChange={(v) => upd('receipt', { showCashier: v })} label="Show cashier" />
            <Toggle checked={r.showCustomer} onChange={(v) => upd('receipt', { showCustomer: v })} label="Show customer" />
            <Toggle checked={r.showPaymentRef} onChange={(v) => upd('receipt', { showPaymentRef: v })} label="Show payment reference" />
            <Toggle checked={r.showQr} onChange={(v) => upd('receipt', { showQr: v })} label="Show QR code" />
          </div>
        </div>
      </Card>
      <Card title="Live preview">
        <div className="receipt-stage small"><ReceiptView sale={sample} settings={settings} /></div>
      </Card>
    </div>
  )
}

function ListEditor({ title, items, onChange, hint }: { title: string; items: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const [v, setV] = useState('')
  const add = () => {
    const t = v.trim()
    if (t && !items.includes(t)) onChange([...items, t])
    setV('')
  }
  return (
    <div className="list-editor">
      <h4>{title}</h4>
      <div className="chips">
        {items.map((i) => (
          <span key={i} className="chip removable">
            {i}
            <button onClick={() => onChange(items.filter((x) => x !== i))} aria-label={`Remove ${i}`}><X size={12} /></button>
          </span>
        ))}
      </div>
      <div className="row gap-s">
        <input className="input" value={v} placeholder="Add new…" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn" onClick={add}><Plus size={15} /> Add</button>
      </div>
      {hint && <small className="muted">{hint}</small>}
    </div>
  )
}

function InventorySettings() {
  const { settings, upd } = useSet()
  const i = settings.inventory
  return (
    <Card title="Products & inventory lists">
      <div className="grid cols-2">
        <ListEditor title="Categories" items={i.categories} onChange={(categories) => upd('inventory', { categories })} />
        <ListEditor title="Publishers" items={i.publishers} onChange={(publishers) => upd('inventory', { publishers })} />
        <ListEditor title="Brands" items={i.brands} onChange={(brands) => upd('inventory', { brands })} />
        <ListEditor title="Units of measure" items={i.units} onChange={(units) => upd('inventory', { units })} />
        <ListEditor title="Stock locations / shelves" items={i.locations} onChange={(locations) => upd('inventory', { locations })} />
        <div className="stack">
          <h4>Defaults</h4>
          <Field label="Default low-stock threshold (units)" hint="Used when adding new products"><NumberInput value={i.defaultMinStock} onChange={(n) => upd('inventory', { defaultMinStock: n })} /></Field>
          <p className="muted small">Barcode format: EAN-13 (ISBN-13 for books; internal codes start with 200). Label layouts: barcode label &amp; shelf label are available from the Products page.</p>
        </div>
      </div>
    </Card>
  )
}

function FinanceSettings() {
  const { settings, upd } = useSet()
  const f = settings.finance
  return (
    <div className="grid cols-2">
      <Card title="Approvals & returns">
        <div className="stack">
          <Toggle checked={f.requireApprovalForRefund} onChange={(v) => upd('finance', { requireApprovalForRefund: v })} label="Require approval for high-value refunds" />
          <Field label="Refund approval threshold (Rs.)"><NumberInput value={f.refundApprovalAbove} onChange={(n) => upd('finance', { refundApprovalAbove: n })} /></Field>
          <Field label="Return window (days)" hint="Returns after this need manager approval"><NumberInput value={f.returnWindowDays} onChange={(n) => upd('finance', { returnWindowDays: n })} /></Field>
          <Toggle checked={f.requireApprovalForAdjust} onChange={(v) => upd('finance', { requireApprovalForAdjust: v })} label="Require approval for stock adjustments" hint="Applies to staff without discount/override rights" />
          <Field label="Low drawer-cash alert (Rs.)"><NumberInput value={f.lowCashAlert} onChange={(n) => upd('finance', { lowCashAlert: n })} /></Field>
        </div>
      </Card>
      <Card title="Expense categories">
        <ListEditor title="Categories" items={f.expenseCategories} onChange={(expenseCategories) => upd('finance', { expenseCategories })} />
      </Card>
    </div>
  )
}

const ACCENTS = ['#1b8196', '#14355a', '#2e7d5b', '#7a5cc7', '#c0572d', '#b83a6b']

function Appearance() {
  const { settings, upd } = useSet()
  const a = settings.appearance
  const n = settings.notifications
  return (
    <div className="grid cols-2">
      <Card title="Appearance & language">
        <div className="stack">
          <Field label="Theme"><Segmented value={a.theme} onChange={(v) => upd('appearance', { theme: v })} options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]} /></Field>
          <Field label="Interface & receipt language"><Segmented value={a.language} onChange={(v) => upd('appearance', { language: v })} options={[{ id: 'en', label: 'English' }, { id: 'si', label: 'සිංහල (Sinhala)' }]} /></Field>
          <p className="muted small">Sinhala covers navigation, POS and receipts. Wording should be reviewed with the shop’s staff before go-live.</p>
          <Field label="Brand accent colour">
            <div className="swatches">
              {ACCENTS.map((c) => <button key={c} className={`swatch ${a.accent === c ? 'on' : ''}`} style={{ background: c }} onClick={() => upd('appearance', { accent: c })} aria-label={c} />)}
            </div>
          </Field>
          <p className="muted small">Currency: Sri Lankan Rupees (LKR) • Dates: DD MMM YYYY</p>
        </div>
      </Card>
      <Card title="Notifications & alerts">
        <div className="stack">
          <Toggle checked={n.lowStock} onChange={(v) => upd('notifications', { lowStock: v })} label="Low-stock alerts" />
          <Toggle checked={n.pendingOrders} onChange={(v) => upd('notifications', { pendingOrders: v })} label="Pending special-order alerts" />
          <Toggle checked={n.reservations} onChange={(v) => upd('notifications', { reservations: v })} label="Overdue reservation alerts" />
          <Toggle checked={n.dailySummary} onChange={(v) => upd('notifications', { dailySummary: v })} label="Daily summary" hint="E-mail / WhatsApp summary is configured at go-live" />
        </div>
      </Card>
    </div>
  )
}

function DataSecurity() {
  const { settings, upd } = useSet()
  const can = useCan()
  const state = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const backup = () => {
    const snap = JSON.stringify(useStore.getState())
    const blob = new Blob([snap], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dinuda-pos-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    toast.success('Backup downloaded')
  }
  const restore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text())
      if (!data.products || !data.sales || !data.settings) throw new Error('Not a valid backup')
      if (!(await confirmDialog({ title: 'Restore backup?', message: 'This replaces all current data in this browser with the backup file.', confirmLabel: 'Restore', danger: true }))) return
      useStore.setState({ ...data, currentUserId: useStore.getState().currentUserId })
      toast.success('Backup restored')
    } catch {
      toast.error('That file is not a valid backup')
    }
  }
  return (
    <div className="grid cols-2">
      <Card title="Backup, restore & export">
        <div className="stack">
          <p className="muted small">In this demo, data lives in the browser. The production system uses scheduled server backups with the same export options.</p>
          <div className="row gap wrap">
            <button className="btn primary" onClick={backup}><Download size={15} /> Download full backup</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
            <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={15} /> Restore from backup</button>
          </div>
          {can('export') ? (
            <div className="row gap wrap">
              <button className="btn" onClick={() => downloadCsv('products.csv', [['code', 'barcode', 'title', 'category', 'cost', 'price', 'qty'], ...state.products.map((p) => [p.code, p.barcode, p.title, p.category, p.cost, p.price, p.qty])])}>Products CSV</button>
              <button className="btn" onClick={() => downloadCsv('customers.csv', [['code', 'name', 'phone', 'group', 'balance'], ...state.customers.map((c) => [c.code, c.name, c.phone, c.group, c.balance])])}>Customers CSV</button>
              <button className="btn" onClick={() => downloadCsv('sales.csv', [['receipt', 'date', 'customer', 'total', 'paid', 'balance', 'status'], ...state.sales.map((s) => [s.no, s.date, s.customerName, s.total, s.paid, s.balance, s.status])])}>Sales CSV</button>
              <button className="btn" onClick={() => downloadCsv('expenses.csv', [['date', 'category', 'amount', 'note'], ...state.expenses.map((e) => [e.date, e.category, e.amount, e.note])])}>Expenses CSV</button>
            </div>
          ) : <p className="muted small">Export requires the “Export customer or financial data” permission.</p>}
          <div className="divider" />
          <button
            className="btn danger"
            onClick={async () => {
              if (await confirmDialog({ title: 'Reset demo data?', message: 'All changes made in this browser are discarded and the original sample data is restored.', confirmLabel: 'Reset demo', danger: true })) {
                state.resetDemo()
                toast.success('Demo data restored')
              }
            }}
          >
            <RotateCcw size={15} /> Reset demo data
          </button>
        </div>
      </Card>
      <Card title="Login & security">
        <div className="stack">
          <Field label="Minimum password length"><NumberInput value={settings.security.minPasswordLength} min={4} max={32} onChange={(n) => upd('security', { minPasswordLength: Math.max(4, n) })} /></Field>
          <Field label="Session timeout (minutes)"><NumberInput value={settings.security.sessionMinutes} onChange={(n) => upd('security', { sessionMinutes: n })} /></Field>
          <p className="muted small">Audit history of important changes (price edits, stock adjustments, voids, refunds, permission changes) is available under Staff → Activity log.</p>
        </div>
      </Card>
    </div>
  )
}
