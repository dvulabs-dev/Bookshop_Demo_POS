import { useMemo, useRef, useState } from 'react'
import { Download, Edit3, History, Plus, Printer, Tag, Upload, FileSpreadsheet, Trash2, Copy } from 'lucide-react'
import { useCan, useStore, userName } from '../store/useStore'
import { Badge, Barcode, Card, Checkbox, Cover, Empty, Field, Modal, NumberInput, PageHeader, Pager, SearchBox, Tabs, usePaged } from '../components/ui'
import { confirmDialog, toast } from '../components/dialogs'
import { downloadCsv, fmtDateTime, internalBarcode, isValidEan13, lkr, matchesProduct, normaliseIsbn, parseCsv, stockState, STOCK_LABEL, uid, type StockState } from '../lib/utils'
import type { Product, ProductType } from '../types'
import { useT } from '../i18n'

const TYPE_LABEL: Record<ProductType, string> = { book: 'Book', school: 'School item / guide', stationery: 'Stationery', art: 'Art supplies', office: 'Office supplies' }
const TYPE_PREFIX: Record<ProductType, string> = { book: 'BK', school: 'SC', stationery: 'ST', art: 'AR', office: 'OF' }
const toneOf = (s: StockState) => (s === 'available' ? 'green' : s === 'low' ? 'amber' : s === 'out' ? 'red' : 'gray')

export default function Products() {
  const t = useT()
  const can = useCan()
  const { products, suppliers, settings, deleteProduct, saveProduct, importProducts } = useStore()
  const canEdit = can('products')
  const canCost = can('viewCost')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [sup, setSup] = useState('')
  const [edit, setEdit] = useState<Product | null>(null)
  const [hist, setHist] = useState<Product | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [labels, setLabels] = useState<Product[] | null>(null)
  const [importing, setImporting] = useState(false)

  const filtered = useMemo(
    () =>
      products
        .filter((p) => matchesProduct(p, q) || p.barcode === normaliseIsbn(q))
        .filter((p) => (!cat || p.category === cat) && (!type || p.type === type) && (!sup || p.supplierId === sup))
        .filter((p) => !status || stockState(p) === status)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [products, q, cat, type, status, sup],
  )
  const pg = usePaged(filtered, 14)

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const blank = (): Product => {
    const n = products.length + 1
    return {
      id: uid('p'),
      code: `BK-${String(n).padStart(4, '0')}`,
      barcode: '',
      title: '',
      type: 'book',
      category: settings.inventory.categories[0],
      unit: 'pcs',
      cost: 0,
      price: 0,
      location: settings.inventory.locations[0],
      qty: 0,
      reserved: 0,
      minStock: settings.inventory.defaultMinStock,
      status: 'active',
      createdAt: new Date().toISOString(),
      hue: Math.floor(Math.random() * 360),
    }
  }

  return (
    <>
      <PageHeader
        title={t('Products')}
        subtitle={`${products.length} products • ${canEdit ? 'Books, stationery, school and office supplies' : 'Book availability lookup'}`}
        actions={
          <>
            {selected.size > 0 && canEdit && (
              <button className="btn" onClick={() => setLabels(products.filter((p) => selected.has(p.id)))}>
                <Printer size={16} /> Print labels ({selected.size})
              </button>
            )}
            {can('export') || canEdit ? (
              <button
                className="btn"
                onClick={() =>
                  downloadCsv('products.csv', [
                    ['code', 'barcode', 'isbn', 'title', 'author', 'publisher', 'category', 'type', 'brand', 'unit', ...(canCost ? ['cost'] : []), 'price', 'qty', 'minStock', 'location'],
                    ...filtered.map((p) => [p.code, p.barcode, p.isbn, p.title, p.author, p.publisher, p.category, p.type, p.brand, p.unit, ...(canCost ? [p.cost] : []), p.price, p.qty, p.minStock, p.location]),
                  ])
                }
              >
                <Download size={16} /> Export
              </button>
            ) : null}
            {canEdit && (
              <>
                <button className="btn" onClick={() => setImporting(true)}>
                  <Upload size={16} /> Import CSV
                </button>
                <button className="btn primary" onClick={() => setEdit(blank())}>
                  <Plus size={16} /> Add product
                </button>
              </>
            )}
          </>
        }
      />
      <Card pad={false}>
        <div className="filters">
          <div className="grow">
            <SearchBox value={q} onChange={setQ} placeholder="Search title, author, ISBN, barcode, publisher, brand, code…" />
          </div>
          <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {settings.inventory.categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any stock status</option>
            {(['available', 'low', 'out', 'discontinued', 'damaged'] as StockState[]).map((s) => <option key={s} value={s}>{STOCK_LABEL[s]}</option>)}
          </select>
          {can('purchasing') || canEdit ? (
            <select className="select" value={sup} onChange={(e) => setSup(e.target.value)}>
              <option value="">All suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : null}
        </div>
        <div className="tbl-wrap">
          <table className="table">
            <thead>
              <tr>
                {canEdit && <th style={{ width: 34 }}><Checkbox checked={pg.rows.length > 0 && pg.rows.every((p) => selected.has(p.id))} onChange={(v) => setSelected((s) => { const n = new Set(s); pg.rows.forEach((p) => (v ? n.add(p.id) : n.delete(p.id))); return n })} /></th>}
                <th>Product</th>
                <th>Code / ISBN</th>
                <th>Category</th>
                <th>Location</th>
                <th className="r">Stock</th>
                {canCost && <th className="r">Cost</th>}
                <th className="r">Price</th>
                {canCost && <th className="r">Margin</th>}
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pg.rows.map((p) => {
                const st = stockState(p)
                return (
                  <tr key={p.id}>
                    {canEdit && <td><Checkbox checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>}
                    <td>
                      <div className="row gap-s">
                        <Cover product={p} size={38} />
                        <div>
                          <b>{p.title}</b>
                          <small className="muted block">{p.author ?? p.brand ?? '—'}{p.publisher ? ` • ${p.publisher}` : ''}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className="mono">{p.code}</span><small className="muted block mono">{p.isbn ?? p.barcode}</small></td>
                    <td>{p.category}</td>
                    <td>{p.location}</td>
                    <td className="r">
                      <b>{p.qty}</b> <small className="muted">{p.unit}</small>
                      {p.reserved > 0 && <small className="muted block">{p.reserved} reserved</small>}
                    </td>
                    {canCost && <td className="r">{lkr(p.cost)}</td>}
                    <td className="r">{lkr(p.price)}</td>
                    {canCost && <td className="r">{p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : 0}%</td>}
                    <td><Badge tone={toneOf(st)}>{STOCK_LABEL[st]}</Badge></td>
                    <td className="r nowrap">
                      <button className="icon-btn sm" title="Price & stock history" onClick={() => setHist(p)}><History size={15} /></button>
                      {canEdit && (
                        <>
                          <button className="icon-btn sm" title="Print label" onClick={() => setLabels([p])}><Tag size={15} /></button>
                          <button className="icon-btn sm" title="Edit" onClick={() => setEdit(p)}><Edit3 size={15} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <Empty title="No products match your filters" text="Clear filters or add a new product." />}
        </div>
        <Pager {...pg} />
      </Card>

      {edit && (
        <ProductForm
          initial={edit}
          isNew={!products.some((p) => p.id === edit.id)}
          canCost={canCost}
          onClose={() => setEdit(null)}
          onSave={(p) => {
            saveProduct(p)
            toast.success(`${p.title} saved`)
            setEdit(null)
          }}
          onDelete={async () => {
            if (await confirmDialog({ title: 'Delete product?', message: `“${edit.title}” will be removed. Past sales keep their history.`, confirmLabel: 'Delete', danger: true })) {
              deleteProduct(edit.id)
              setEdit(null)
              toast.success('Product deleted')
            }
          }}
          onDuplicate={() => setEdit({ ...edit, id: uid('p'), code: `${TYPE_PREFIX[edit.type]}-${String(products.length + 1).padStart(4, '0')}`, barcode: '', isbn: undefined, title: `${edit.title} (copy)`, qty: 0 })}
        />
      )}
      {hist && <HistoryModal product={hist} canCost={canCost} onClose={() => setHist(null)} />}
      {labels && <LabelModal products={labels} onClose={() => setLabels(null)} />}
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImport={(items) => {
            importProducts(items)
            toast.success(`${items.length} products imported`)
            setImporting(false)
          }}
        />
      )}
    </>
  )
}

/* ============================ product form ============================ */

function ProductForm({ initial, isNew, canCost, onClose, onSave, onDelete, onDuplicate }: { initial: Product; isNew: boolean; canCost: boolean; onClose: () => void; onSave: (p: Product) => void; onDelete: () => void; onDuplicate: () => void }) {
  const { products, suppliers, settings } = useStore()
  const [p, setP] = useState<Product>(initial)
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }))
  const dupBarcode = p.barcode && products.some((x) => x.id !== p.id && (x.barcode === p.barcode || x.isbn === p.barcode))
  const dupIsbn = p.isbn && products.some((x) => x.id !== p.id && (x.isbn === p.isbn || x.barcode === p.isbn))
  const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0
  const isBook = p.type === 'book' || p.type === 'school'
  const err = !p.title.trim() ? 'Title is required' : p.price <= 0 ? 'Selling price must be greater than 0' : ''

  const genBarcode = () => {
    const seq = products.filter((x) => x.barcode.startsWith('200')).reduce((m, x) => Math.max(m, Number(x.barcode.slice(3, 12)) || 0), 0) + 1
    set('barcode', internalBarcode(seq))
  }

  return (
    <Modal
      title={isNew ? 'Add product' : 'Edit product'}
      subtitle={`${p.code} — ${isNew ? 'a new item in the catalogue' : 'update details, pricing and stock settings'}`}
      width={860}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn danger ghost" onClick={onDelete}><Trash2 size={15} /> Delete</button>}
          {!isNew && <button className="btn" onClick={onDuplicate}><Copy size={15} /> Duplicate</button>}
          <span className="grow" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!!err} title={err} onClick={() => onSave({ ...p, title: p.title.trim(), barcode: p.barcode || (() => { const seq = products.filter((x) => x.barcode.startsWith('200')).reduce((m, x) => Math.max(m, Number(x.barcode.slice(3, 12)) || 0), 0) + 1; return internalBarcode(seq) })() })}>
            Save product
          </button>
        </>
      }
    >
      <div className="form-sections">
        <section>
          <h4>Identification</h4>
          <div className="grid cols-3">
            <Field label="Product type" required>
              <select className="select" value={p.type} onChange={(e) => { const ty = e.target.value as ProductType; setP((x) => ({ ...x, type: ty, code: isNew ? `${TYPE_PREFIX[ty]}-${x.code.split('-')[1]}` : x.code })) }}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Internal product code" hint="Auto-generated"><input className="input mono" value={p.code} onChange={(e) => set('code', e.target.value)} /></Field>
            <Field label="ISBN-10 / ISBN-13" hint={dupIsbn ? '⚠ Another product already uses this ISBN' : 'ISBN-10 is converted to ISBN-13 automatically'}>
              <input
                className={`input mono ${dupIsbn ? 'invalid' : ''}`}
                value={p.isbn ?? ''}
                onChange={(e) => set('isbn', e.target.value)}
                onBlur={(e) => {
                  const n = normaliseIsbn(e.target.value)
                  setP((x) => ({ ...x, isbn: n || undefined, barcode: x.barcode || (n.length === 13 ? n : '') }))
                }}
                placeholder="978…"
              />
            </Field>
          </div>
          <div className="grid cols-3">
            <Field label="Barcode (EAN-13)" hint={dupBarcode ? '⚠ Duplicate barcode' : p.barcode && !isValidEan13(p.barcode) ? 'Not a valid EAN-13 (check digit)' : 'Leave blank to auto-generate an internal barcode'}>
              <div className="row gap-s">
                <input className={`input mono ${dupBarcode ? 'invalid' : ''}`} value={p.barcode} onChange={(e) => set('barcode', e.target.value.replace(/\D/g, '').slice(0, 13))} />
                <button type="button" className="btn sm" onClick={genBarcode}>Generate</button>
              </div>
            </Field>
            <Field label="Title" required className="span2"><input className="input" value={p.title} onChange={(e) => set('title', e.target.value)} autoFocus /></Field>
          </div>
          {isValidEan13(p.barcode) && <div className="barcode-preview"><Barcode code={p.barcode} height={36} scale={1.3} /></div>}
        </section>

        {isBook && (
          <section>
            <h4>Book details</h4>
            <div className="grid cols-3">
              <Field label="Author(s)"><input className="input" value={p.author ?? ''} onChange={(e) => set('author', e.target.value)} /></Field>
              <Field label="Publisher">
                <input className="input" list="publishers" value={p.publisher ?? ''} onChange={(e) => set('publisher', e.target.value)} />
                <datalist id="publishers">{settings.inventory.publishers.map((x) => <option key={x} value={x} />)}</datalist>
              </Field>
              <Field label="Edition"><input className="input" value={p.edition ?? ''} onChange={(e) => set('edition', e.target.value)} /></Field>
              <Field label="Language">
                <select className="select" value={p.language ?? ''} onChange={(e) => set('language', e.target.value)}>
                  <option value="">—</option>
                  {['Sinhala', 'English', 'Tamil', 'Bilingual'].map((l) => <option key={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Publication year"><NumberInput value={p.year ?? 0} onChange={(n) => set('year', n || undefined)} placeholder="e.g. 2025" /></Field>
              <Field label="Binding / format">
                <select className="select" value={p.binding ?? ''} onChange={(e) => set('binding', e.target.value)}>
                  <option value="">—</option>
                  {['Paperback', 'Hardcover', 'Spiral', 'Pamphlet'].map((l) => <option key={l}>{l}</option>)}
                </select>
              </Field>
            </div>
          </section>
        )}

        <section>
          <h4>Classification &amp; details</h4>
          <div className="grid cols-3">
            <Field label="Category" required>
              <select className="select" value={p.category} onChange={(e) => set('category', e.target.value)}>
                {settings.inventory.categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Subcategory"><input className="input" value={p.subcategory ?? ''} onChange={(e) => set('subcategory', e.target.value)} /></Field>
            <Field label="Brand">
              <input className="input" list="brands" value={p.brand ?? ''} onChange={(e) => set('brand', e.target.value)} />
              <datalist id="brands">{settings.inventory.brands.map((x) => <option key={x} value={x} />)}</datalist>
            </Field>
            <Field label="School grade"><input className="input" value={p.grade ?? ''} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. Grade 10" /></Field>
            <Field label="Subject / curriculum"><input className="input" value={p.subject ?? ''} onChange={(e) => set('subject', e.target.value)} /></Field>
            <Field label="Unit of measure">
              <select className="select" value={p.unit} onChange={(e) => set('unit', e.target.value)}>
                {settings.inventory.units.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Size"><input className="input" value={p.size ?? ''} onChange={(e) => set('size', e.target.value)} placeholder="A4, A5…" /></Field>
            <Field label="Colour"><input className="input" value={p.colour ?? ''} onChange={(e) => set('colour', e.target.value)} /></Field>
          </div>
        </section>

        <section>
          <h4>Stock &amp; pricing</h4>
          <div className="grid cols-4">
            {canCost ? (
              <Field label="Cost price (Rs.)"><NumberInput value={p.cost} onChange={(n) => set('cost', n)} step={0.5} /></Field>
            ) : (
              <Field label="Cost price" hint="Restricted"><input className="input" disabled value="••••••" /></Field>
            )}
            <Field label="Selling price (Rs.)" required><NumberInput value={p.price} onChange={(n) => set('price', n)} step={0.5} /></Field>
            <Field label="Wholesale price"><NumberInput value={p.wholesale ?? 0} onChange={(n) => set('wholesale', n || undefined)} /></Field>
            <Field label="Minimum price" hint="Lowest allowed selling price"><NumberInput value={p.minPrice ?? 0} onChange={(n) => set('minPrice', n || undefined)} /></Field>
          </div>
          {canCost && p.price > 0 && <p className="muted small">Margin: <b>{margin.toFixed(1)}%</b> • Profit per unit {lkr(p.price - p.cost)}</p>}
          <div className="grid cols-4">
            <Field label={isNew ? 'Opening quantity' : 'Quantity on hand'} hint={isNew ? undefined : 'Change stock via Stock → Adjust so it is logged'}>
              <NumberInput value={p.qty} onChange={(n) => set('qty', n)} disabled={!isNew} />
            </Field>
            <Field label="Minimum stock level" hint="Low-stock alert threshold"><NumberInput value={p.minStock} onChange={(n) => set('minStock', n)} /></Field>
            <Field label="Stock status">
              <select className="select" value={p.status} onChange={(e) => set('status', e.target.value as Product['status'])}>
                <option value="active">Active (available)</option>
                <option value="discontinued">Discontinued</option>
                <option value="damaged">Damaged</option>
              </select>
            </Field>
            <Field label="Location (branch / shelf)">
              <input className="input" list="locs" value={p.location} onChange={(e) => set('location', e.target.value)} />
              <datalist id="locs">{settings.inventory.locations.map((x) => <option key={x} value={x} />)}</datalist>
            </Field>
          </div>
        </section>

        <section>
          <h4>Supplier</h4>
          <div className="grid cols-3">
            <Field label="Main supplier">
              <select className="select" value={p.supplierId ?? ''} onChange={(e) => set('supplierId', e.target.value || undefined)}>
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Supplier product code"><input className="input" value={p.supplierCode ?? ''} onChange={(e) => set('supplierCode', e.target.value)} /></Field>
          </div>
        </section>
      </div>
    </Modal>
  )
}

/* ============================ history ============================ */

function HistoryModal({ product, canCost, onClose }: { product: Product; canCost: boolean; onClose: () => void }) {
  const { movements, priceHistory, users } = useStore()
  const [tab, setTab] = useState<'stock' | 'price'>('stock')
  const mv = movements.filter((m) => m.productId === product.id).sort((a, b) => b.date.localeCompare(a.date))
  const ph = priceHistory.filter((p) => p.productId === product.id)
  return (
    <Modal title={product.title} subtitle={`${product.code} • ${product.qty} in stock • ${lkr(product.price)}`} width={720} onClose={onClose}>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'stock', label: 'Stock movements', count: mv.length }, ...(canCost ? [{ id: 'price' as const, label: 'Price history', count: ph.length + 1 }] : [])]} />
      <div className="tbl-wrap" style={{ maxHeight: 380 }}>
        {tab === 'stock' ? (
          <table className="table compact">
            <thead><tr><th>Date</th><th>Type</th><th className="r">Qty</th><th>Ref</th><th>User</th><th>Reason</th></tr></thead>
            <tbody>
              {mv.slice(0, 60).map((m) => (
                <tr key={m.id}>
                  <td>{fmtDateTime(m.date)}</td>
                  <td><Badge tone={m.qty > 0 ? 'green' : m.qty < 0 ? 'red' : 'gray'}>{m.type.replace('_', ' ')}</Badge></td>
                  <td className="r">{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                  <td className="mono">{m.ref ?? '—'}</td>
                  <td>{userName(users, m.userId)}</td>
                  <td className="muted">{m.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="table compact">
            <thead><tr><th>Date</th><th className="r">Cost</th><th className="r">Selling price</th><th>Source</th><th>By</th></tr></thead>
            <tbody>
              <tr><td>Current</td><td className="r">{lkr(product.cost)}</td><td className="r">{lkr(product.price)}</td><td colSpan={2} className="muted">Current values</td></tr>
              {ph.map((p) => (
                <tr key={p.id}><td>{fmtDateTime(p.date)}</td><td className="r">{lkr(p.cost)}</td><td className="r">{lkr(p.price)}</td><td>{p.source}</td><td>{userName(users, p.userId)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  )
}

/* ============================ labels ============================ */

function LabelModal({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const { settings } = useStore()
  const [kind, setKind] = useState<'barcode' | 'shelf'>('barcode')
  const [copies, setCopies] = useState(1)
  const items = products.flatMap((p) => Array.from({ length: copies }, () => p))
  return (
    <Modal
      title="Print labels"
      subtitle={`${products.length} product(s) × ${copies} = ${items.length} labels`}
      width={820}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Print labels</button>
        </>
      }
    >
      <div className="row gap wrap">
        <Tabs value={kind} onChange={setKind} tabs={[{ id: 'barcode', label: 'Barcode labels' }, { id: 'shelf', label: 'Shelf / price labels' }]} />
        <Field label="Copies per product" className="inline"><NumberInput value={copies} min={1} max={50} onChange={(n) => setCopies(Math.max(1, n))} /></Field>
      </div>
      <div className="print-area labels">
        {items.map((p, i) => (
          <div key={i} className={`label ${kind}`}>
            {kind === 'barcode' ? (
              <>
                <small>{settings.business.name}</small>
                <b className="label-title">{p.title}</b>
                <Barcode code={p.barcode} height={34} scale={1.25} />
                <strong>{lkr(p.price, { decimals: false })}</strong>
              </>
            ) : (
              <>
                <b className="label-title">{p.title}</b>
                <small>{p.author ?? p.brand ?? p.category}</small>
                <div className="label-price">{lkr(p.price)}</div>
                <small className="mono">{p.code} • {p.location}</small>
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}

/* ============================ import ============================ */

const TEMPLATE = [
  ['title', 'author', 'publisher', 'isbn', 'category', 'type', 'brand', 'unit', 'cost', 'price', 'qty', 'minStock', 'location', 'supplier'],
  ['Sample Novel', 'A. Writer', 'Sarasavi Publishers', '9789551234567', 'Novels & Literature', 'book', '', 'pcs', '700', '950', '10', '3', 'B-01', 'M.D. Gunasena & Co.'],
  ['Atlas Pen Blue', '', '', '', 'Pens & Pencils', 'stationery', 'Atlas', 'pcs', '25', '35', '200', '50', 'S-2', 'Stationery World Lanka'],
]

function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (p: Product[]) => void }) {
  const { products, suppliers, settings } = useStore()
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => {
    if (!text.trim()) return { items: [] as Product[], errors: [] as string[] }
    const rows = parseCsv(text)
    const head = rows[0].map((h) => h.trim().toLowerCase())
    const idx = (n: string) => head.indexOf(n.toLowerCase())
    const items: Product[] = []
    const errors: string[] = []
    let seq = products.length
    let isb = products.filter((x) => x.barcode.startsWith('200')).reduce((m, x) => Math.max(m, Number(x.barcode.slice(3, 12)) || 0), 0)
    rows.slice(1).forEach((r, i) => {
      const g = (n: string) => (idx(n) >= 0 ? (r[idx(n)] ?? '').trim() : '')
      const title = g('title')
      const price = Number(g('price'))
      if (!title || !price) return errors.push(`Row ${i + 2}: title and price are required`)
      const type = (['book', 'school', 'stationery', 'art', 'office'].includes(g('type')) ? g('type') : 'book') as ProductType
      const isbn = g('isbn') ? normaliseIsbn(g('isbn')) : ''
      let barcode = isbn.length === 13 && isValidEan13(isbn) ? isbn : ''
      if (barcode && (products.some((x) => x.barcode === barcode) || items.some((x) => x.barcode === barcode))) {
        errors.push(`Row ${i + 2}: duplicate ISBN/barcode ${barcode} – skipped`)
        return
      }
      if (!barcode) barcode = internalBarcode(++isb)
      seq++
      const sup = suppliers.find((s) => s.name.toLowerCase() === g('supplier').toLowerCase())
      items.push({
        id: uid('p'),
        code: `${TYPE_PREFIX[type]}-${String(seq).padStart(4, '0')}`,
        barcode,
        isbn: isbn.length === 13 ? isbn : undefined,
        title,
        author: g('author') || undefined,
        publisher: g('publisher') || undefined,
        type,
        category: g('category') || settings.inventory.categories[0],
        brand: g('brand') || undefined,
        unit: g('unit') || 'pcs',
        cost: Number(g('cost')) || 0,
        price,
        supplierId: sup?.id,
        location: g('location') || settings.inventory.locations[0],
        qty: Number(g('qty')) || 0,
        reserved: 0,
        minStock: Number(g('minstock')) || settings.inventory.defaultMinStock,
        status: 'active',
        createdAt: new Date().toISOString(),
        hue: Math.floor(Math.random() * 360),
      })
    })
    return { items, errors }
  }, [text, products, suppliers, settings])

  return (
    <Modal
      title="Import products from CSV / Excel"
      subtitle="Export your Excel sheet as CSV, then upload it here or paste the rows"
      width={720}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={() => downloadCsv('product-import-template.csv', TEMPLATE)}><FileSpreadsheet size={16} /> Download template</button>
          <span className="grow" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!parsed.items.length} onClick={() => onImport(parsed.items)}>Import {parsed.items.length || ''} products</button>
        </>
      }
    >
      <div className="stack">
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()) }} />
        <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Choose CSV file</button>
        <Field label="…or paste CSV text (first row = column names)">
          <textarea className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={TEMPLATE.map((r) => r.join(',')).join('\n')} />
        </Field>
        {text && (
          <div className="summary-box">
            <b>{parsed.items.length}</b> valid rows ready to import
            {parsed.errors.length > 0 && (
              <ul className="error-list">
                {parsed.errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
