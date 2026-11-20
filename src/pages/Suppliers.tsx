import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit3, Mail, Phone, Plus, Trash2 } from 'lucide-react'
import { useCan, useStore } from '../store/useStore'
import { Badge, Card, Empty, Field, Modal, PageHeader, SearchBox, Tabs } from '../components/ui'
import { confirmDialog, toast } from '../components/dialogs'
import { poPaid, poPayable, poTotal } from '../lib/calc'
import { fmtDate, lkr, uid } from '../lib/utils'
import type { Supplier } from '../types'

export default function Suppliers() {
  const can = useCan()
  const nav = useNavigate()
  const { suppliers, purchaseOrders, products, saveSupplier, deleteSupplier } = useStore()
  const canEdit = can('purchasing')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Supplier | null>(null)
  const [view, setView] = useState<Supplier | null>(null)

  const rows = useMemo(
    () =>
      suppliers
        .filter((s) => !q || [s.name, s.contact, s.phone].some((x) => x.toLowerCase().includes(q.toLowerCase())))
        .map((s) => {
          const pos = purchaseOrders.filter((p) => p.supplierId === s.id && p.status !== 'cancelled' && p.status !== 'draft')
          return {
            s,
            orders: pos.length,
            total: pos.reduce((a, p) => a + poTotal(p), 0),
            payable: pos.reduce((a, p) => a + poPayable(p), 0),
            last: pos.map((p) => p.date).sort().pop(),
            products: products.filter((p) => p.supplierId === s.id).length,
          }
        }),
    [suppliers, purchaseOrders, products, q],
  )

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle="Who supplies what, what we have bought and what is still payable"
        actions={canEdit && <button className="btn primary" onClick={() => setEdit({ id: uid('s'), name: '', contact: '', phone: '' })}><Plus size={16} /> Add supplier</button>}
      />
      <Card pad={false}>
        <div className="filters"><div className="grow"><SearchBox value={q} onChange={setQ} placeholder="Search suppliers…" /></div></div>
        <div className="tbl-wrap">
          <table className="table">
            <thead><tr><th>Supplier</th><th>Contact</th><th className="r">Products</th><th className="r">Orders</th><th className="r">Total purchased</th><th className="r">Payable</th><th>Last order</th><th /></tr></thead>
            <tbody>
              {rows.map(({ s, orders, total, payable, last, products: np }) => (
                <tr key={s.id} className="clickable" onClick={() => setView(s)}>
                  <td><b>{s.name}</b><small className="muted block">{s.address}</small></td>
                  <td>{s.contact}<small className="muted block">{s.phone}</small></td>
                  <td className="r">{np}</td>
                  <td className="r">{orders}</td>
                  <td className="r">{lkr(total, { decimals: false })}</td>
                  <td className="r">{payable > 0 ? <Badge tone="amber">{lkr(payable, { decimals: false })}</Badge> : <Badge tone="green">Paid up</Badge>}</td>
                  <td>{fmtDate(last)}</td>
                  <td className="r" onClick={(e) => e.stopPropagation()}>{canEdit && <button className="icon-btn sm" onClick={() => setEdit(s)}><Edit3 size={15} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty title="No suppliers found" />}
        </div>
      </Card>

      {edit && (
        <SupplierForm
          initial={edit}
          isNew={!suppliers.some((s) => s.id === edit.id)}
          onClose={() => setEdit(null)}
          onSave={(s) => { saveSupplier(s); toast.success('Supplier saved'); setEdit(null) }}
          onDelete={async () => {
            if (purchaseOrders.some((p) => p.supplierId === edit.id)) return toast.error('This supplier has purchase orders and cannot be deleted')
            if (await confirmDialog({ title: 'Delete supplier?', message: edit.name, danger: true, confirmLabel: 'Delete' })) { deleteSupplier(edit.id); setEdit(null) }
          }}
        />
      )}
      {view && <SupplierView s={view} onClose={() => setView(null)} onOpenPOs={() => nav(`/purchasing?supplier=${view.id}`)} />}
    </>
  )
}

function SupplierForm({ initial, isNew, onClose, onSave, onDelete }: { initial: Supplier; isNew: boolean; onClose: () => void; onSave: (s: Supplier) => void; onDelete: () => void }) {
  const [s, setS] = useState(initial)
  const set = (k: keyof Supplier, v: string) => setS({ ...s, [k]: v })
  return (
    <Modal title={isNew ? 'Add supplier' : 'Edit supplier'} onClose={onClose} width={560}
      footer={<>{!isNew && <button className="btn danger ghost" onClick={onDelete}><Trash2 size={15} /> Delete</button>}<span className="grow" /><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!s.name.trim() || !s.phone.trim()} onClick={() => onSave(s)}>Save</button></>}>
      <div className="grid cols-2">
        <Field label="Supplier name" required className="span2"><input className="input" value={s.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <Field label="Contact person"><input className="input" value={s.contact} onChange={(e) => set('contact', e.target.value)} /></Field>
        <Field label="Telephone" required><input className="input" value={s.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" value={s.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Address"><input className="input" value={s.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Notes (terms, delivery days…)" className="span2"><textarea className="input" rows={3} value={s.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function SupplierView({ s, onClose, onOpenPOs }: { s: Supplier; onClose: () => void; onOpenPOs: () => void }) {
  const { purchaseOrders, products } = useStore()
  const [tab, setTab] = useState<'orders' | 'products'>('orders')
  const pos = purchaseOrders.filter((p) => p.supplierId === s.id).sort((a, b) => b.date.localeCompare(a.date))
  const prods = products.filter((p) => p.supplierId === s.id)
  return (
    <Modal title={s.name} subtitle={`${s.contact} • ${s.phone}`} width={760} onClose={onClose} footer={<><button className="btn" onClick={onOpenPOs}>Open in Purchasing</button><button className="btn primary" onClick={onClose}>Close</button></>}>
      <div className="row gap wrap muted small">
        <span><Phone size={13} /> {s.phone}</span>
        {s.email && <span><Mail size={13} /> {s.email}</span>}
        {s.address && <span>{s.address}</span>}
      </div>
      {s.notes && <p className="summary-box small">{s.notes}</p>}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'orders', label: 'Purchase history', count: pos.length }, { id: 'products', label: 'Products supplied', count: prods.length }]} />
      <div className="tbl-wrap" style={{ maxHeight: 340 }}>
        {tab === 'orders' ? (
          <table className="table compact">
            <thead><tr><th>PO</th><th>Date</th><th>Status</th><th className="r">Total</th><th className="r">Paid</th><th className="r">Payable</th></tr></thead>
            <tbody>{pos.map((p) => <tr key={p.id}><td><b>{p.no}</b></td><td>{fmtDate(p.date)}</td><td><Badge tone={p.status === 'received' ? 'green' : p.status === 'cancelled' ? 'red' : 'blue'}>{p.status}</Badge></td><td className="r">{lkr(poTotal(p))}</td><td className="r">{lkr(poPaid(p))}</td><td className="r">{lkr(poPayable(p))}</td></tr>)}</tbody>
          </table>
        ) : (
          <table className="table compact">
            <thead><tr><th>Product</th><th>Supplier code</th><th className="r">In stock</th></tr></thead>
            <tbody>{prods.map((p) => <tr key={p.id}><td><b>{p.title}</b></td><td className="mono">{p.supplierCode}</td><td className="r">{p.qty}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </Modal>
  )
}
