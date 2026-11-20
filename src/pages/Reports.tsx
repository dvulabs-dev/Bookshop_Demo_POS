import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp, Download, Printer } from 'lucide-react'
import { useCan, useStore } from '../store/useStore'
import { Card, Empty, PageHeader } from '../components/ui'
import { DateRangeBar, initialRange } from '../components/DateRange'
import { categoryAgg, dailySeries, expensesIn, inRange, makeRange, paymentBreakdown, productAgg, rangeSales, summarise } from '../lib/analytics'
import { PAY_LABEL, poPaid, poPayable, poTotal, saleDiscount } from '../lib/calc'
import { dayKey, downloadCsv, fmtDate, lkr, num, round2 } from '../lib/utils'
import { CHART, PROFIT } from '../lib/colors'
import { tooltipStyle } from './Dashboard'

type Fmt = 'money' | 'int' | 'pct' | 'text' | 'date'
interface Col { key: string; label: string; fmt?: Fmt; sum?: boolean }
type Row = Record<string, string | number | undefined>
interface Built {
  cols: Col[]
  rows: Row[]
  chart?: { kind: 'bar' | 'line' | 'pie'; x: string; series: { key: string; label: string }[]; data: Row[] }
  notes?: string
}

const REPORTS = [
  { id: 'daily', label: 'Daily sales', desc: 'Bills, quantities, sales value and payment-method breakdown', needs: 'reports' },
  { id: 'periodic', label: 'Monthly / annual sales', desc: 'Growth and comparison across periods', needs: 'reports' },
  { id: 'product', label: 'Product sales', desc: 'Best-selling and low-selling books and stationery', needs: 'reports' },
  { id: 'category', label: 'Category performance', desc: 'Sales by books, stationery, school supplies and other categories', needs: 'reports' },
  { id: 'gross', label: 'Gross profit', desc: 'Selling value less recorded product cost', needs: 'viewCost' },
  { id: 'net', label: 'Net profitability', desc: 'Income after recorded operating expenses', needs: 'viewCost' },
  { id: 'valuation', label: 'Inventory valuation', desc: 'Current quantities and estimated stock cost value', needs: 'reports' },
  { id: 'low', label: 'Low-stock / out-of-stock', desc: 'Items that need replenishment', needs: 'reports' },
  { id: 'movement', label: 'Stock movement', desc: 'Purchases, sales, returns, damage and adjustments', needs: 'reports' },
  { id: 'supplier', label: 'Supplier purchases', desc: 'Purchase totals and supplier payment status', needs: 'reports' },
  { id: 'customers', label: 'Customer balances', desc: 'Outstanding customer amounts where credit is enabled', needs: 'reports' },
  { id: 'cashier', label: 'Cashier performance', desc: 'Sales, discounts, voids and refunds by staff member', needs: 'reports' },
  { id: 'expcash', label: 'Expenses and cash', desc: 'Expense categories and shift reconciliation', needs: 'reports' },
] as const
type RId = (typeof REPORTS)[number]['id']

export default function Reports() {
  const can = useCan()
  const s = useStore()
  const [id, setId] = useState<RId>('daily')
  const [range, setRange] = useState(initialRange('30d'))
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const r = useMemo(() => makeRange(range.from, range.to), [range])
  const list = REPORTS.filter((x) => can(x.needs as 'reports' | 'viewCost'))
  const active = list.find((x) => x.id === id) ?? list[0]
  const costOk = can('viewCost')

  const built: Built | null = useMemo(() => (active ? build(active.id, s, r, costOk, range.from, range.to) : null), [active, s.sales, s.returns, s.products, s.expenses, s.purchaseOrders, s.customers, s.movements, s.shifts, s.users, r, costOk]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    if (!built) return []
    if (!sort) return built.rows
    return [...built.rows].sort((a, b) => {
      const x = a[sort.key] ?? ''
      const y = b[sort.key] ?? ''
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir
    })
  }, [built, sort])

  if (!active || !built) return <Empty title="No reports available for your role" />

  const fmt = (v: string | number | undefined, f: Fmt = 'text') => {
    if (v == null || v === '') return '—'
    if (f === 'money') return lkr(Number(v))
    if (f === 'int') return num(Number(v))
    if (f === 'pct') return `${Number(v).toFixed(1)}%`
    if (f === 'date') return fmtDate(String(v))
    return String(v)
  }
  const totals = built.cols.some((c) => c.sum)
    ? built.cols.map((c) => (c.sum ? rows.reduce((a, x) => a + Number(x[c.key] ?? 0), 0) : undefined))
    : null

  return (
    <>
      <PageHeader title="Reports & analytics" subtitle="Choose a report, set a date range, then print or export to Excel (CSV)" />
      <div className="reports">
        <nav className="report-nav">
          {list.map((x) => (
            <button key={x.id} className={`report-item ${x.id === active.id ? 'active' : ''}`} onClick={() => { setId(x.id); setSort(null) }}>
              <b>{x.label}</b>
              <small>{x.desc}</small>
            </button>
          ))}
        </nav>
        <div className="report-body">
          <Card
            title={active.label}
            actions={
              <>
                <DateRangeBar value={range} onChange={setRange} />
                <button className="btn sm" onClick={() => downloadCsv(`${active.id}-report.csv`, [built.cols.map((c) => c.label), ...rows.map((x) => built.cols.map((c) => x[c.key]))])}><Download size={14} /> Excel / CSV</button>
                <button className="btn sm" onClick={() => window.print()}><Printer size={14} /> Print / PDF</button>
              </>
            }
          >
            <div className="print-area report-print">
              <div className="print-only report-title">
                <h2>Dinuda Bookshop — {active.label}</h2>
                <p>{fmtDate(r.from.toISOString())} to {fmtDate(r.to.toISOString())}</p>
              </div>
              {built.notes && <p className="muted small">{built.notes}</p>}
              {built.chart && rows.length > 0 && (
                <div className="chart no-print">
                  <ResponsiveContainer width="100%" height={260}>
                    {built.chart.kind === 'pie' ? (
                      <PieChart>
                        <Pie data={built.chart.data as never} dataKey={built.chart.series[0].key} nameKey={built.chart.x} innerRadius={55} outerRadius={95} paddingAngle={2}>
                          {built.chart.data.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} stroke="var(--card)" />)}
                        </Pie>
                        <Tooltip formatter={(v) => lkr(Number(v), { decimals: false })} contentStyle={tooltipStyle} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    ) : built.chart.kind === 'line' ? (
                      <LineChart data={built.chart.data as never} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                        <XAxis dataKey={built.chart.x} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                        <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                        <Tooltip formatter={(v) => lkr(Number(v), { decimals: false })} contentStyle={tooltipStyle} />
                        {built.chart.series.map((sr, i) => <Line key={sr.key} dataKey={sr.key} name={sr.label} stroke={i === 0 ? CHART[0] : PROFIT} strokeWidth={2} dot={false} />)}
                        {built.chart.series.length > 1 && <Legend />}
                      </LineChart>
                    ) : (
                      <BarChart data={built.chart.data as never} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                        <XAxis dataKey={built.chart.x} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval={built.chart.data.length > 12 ? 'preserveStartEnd' : 0} minTickGap={18} height={built.chart.data.length > 12 ? 30 : 50} angle={built.chart.data.length > 12 ? 0 : -12} textAnchor={built.chart.data.length > 12 ? 'middle' : 'end'} />
                        <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--hover)' }} />
                        {built.chart.series.map((sr, i) => <Bar key={sr.key} dataKey={sr.key} name={sr.label} fill={CHART[i % CHART.length]} radius={[4, 4, 0, 0]} />)}
                        {built.chart.series.length > 1 && <Legend />}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
              <div className="tbl-wrap">
                <table className="table compact">
                  <thead>
                    <tr>
                      {built.cols.map((c) => (
                        <th key={c.key} className={c.fmt && c.fmt !== 'text' && c.fmt !== 'date' ? 'r sortable' : 'sortable'} onClick={() => setSort(sort?.key === c.key ? { key: c.key, dir: (sort.dir * -1) as 1 | -1 } : { key: c.key, dir: -1 })}>
                          {c.label} {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((x, i) => (
                      <tr key={i}>
                        {built.cols.map((c) => <td key={c.key} className={c.fmt === 'date' ? 'date' : c.fmt && c.fmt !== 'text' ? 'r' : ''}>{fmt(x[c.key], c.fmt)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                  {totals && (
                    <tfoot>
                      <tr>
                        {built.cols.map((c, i) => <td key={c.key} className={c.fmt && c.fmt !== 'text' && c.fmt !== 'date' ? 'r' : ''}>{i === 0 ? <b>Total</b> : totals[i] != null ? <b>{fmt(round2(totals[i]!), c.fmt)}</b> : ''}</td>)}
                      </tr>
                    </tfoot>
                  )}
                </table>
                {rows.length === 0 && <Empty title="No data for this period" />}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

/* ================== report builders ================== */
type S = ReturnType<typeof useStore.getState>

function build(id: RId, s: S, r: ReturnType<typeof makeRange>, costOk: boolean, fromStr: string, toStr: string): Built {
  const sales = rangeSales(s.sales, r)
  const pm = new Map(s.products.map((p) => [p.id, p]))
  const um = new Map(s.users.map((u) => [u.id, u.name]))

  switch (id) {
    case 'daily': {
      const ser = dailySeries(s.sales, s.returns, r)
      const rows: Row[] = ser.map((d) => {
        const ds = sales.filter((x) => dayKey(x.date) === d.key)
        const pay = paymentBreakdown(ds)
        const amt = (m: string) => pay.find((p) => p.method === m)?.amount ?? 0
        return { date: d.key, bills: d.bills, items: ds.reduce((a, x) => a + x.lines.reduce((q, l) => q + l.qty - (l.returnedQty ?? 0), 0), 0), discount: ds.reduce((a, x) => a + saleDiscount(x), 0), sales: d.sales, cash: amt('cash'), card: amt('card'), bank: amt('bank'), qr: amt('qr') }
      })
      return {
        cols: [{ key: 'date', label: 'Date', fmt: 'date' }, { key: 'bills', label: 'Bills', fmt: 'int', sum: true }, { key: 'items', label: 'Items', fmt: 'int', sum: true }, { key: 'discount', label: 'Discounts', fmt: 'money', sum: true }, { key: 'sales', label: 'Net sales', fmt: 'money', sum: true }, { key: 'cash', label: 'Cash', fmt: 'money', sum: true }, { key: 'card', label: 'Card', fmt: 'money', sum: true }, { key: 'bank', label: 'Bank', fmt: 'money', sum: true }, { key: 'qr', label: 'QR', fmt: 'money', sum: true }],
        rows: rows.filter((x) => Number(x.bills) > 0),
        chart: { kind: 'bar', x: 'label', series: [{ key: 'sales', label: 'Net sales' }], data: ser as unknown as Row[] },
        notes: 'Payment columns show amounts received against bills (including part payments). Net sales are after refunds.',
      }
    }
    case 'periodic': {
      const m = new Map<string, Row>()
      rangeSales(s.sales, { from: new Date(r.from.getFullYear(), r.from.getMonth(), 1), to: r.to }).forEach((x) => {
        const d = new Date(x.date)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const row = m.get(k) ?? { period: k, label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), bills: 0, sales: 0, avg: 0 }
        row.bills = Number(row.bills) + 1
        row.sales = round2(Number(row.sales) + x.total)
        m.set(k, row)
      })
      const rows = [...m.values()].sort((a, b) => String(a.period).localeCompare(String(b.period)))
      rows.forEach((x, i) => {
        x.avg = Number(x.bills) ? round2(Number(x.sales) / Number(x.bills)) : 0
        x.growth = i > 0 && Number(rows[i - 1].sales) > 0 ? ((Number(x.sales) - Number(rows[i - 1].sales)) / Number(rows[i - 1].sales)) * 100 : undefined
      })
      return {
        cols: [{ key: 'label', label: 'Month' }, { key: 'bills', label: 'Bills', fmt: 'int', sum: true }, { key: 'sales', label: 'Sales', fmt: 'money', sum: true }, { key: 'avg', label: 'Avg bill', fmt: 'money' }, { key: 'growth', label: 'Growth vs previous', fmt: 'pct' }],
        rows,
        chart: { kind: 'bar', x: 'label', series: [{ key: 'sales', label: 'Sales' }], data: rows },
        notes: 'Select “This year” to compare every month. The first month may be partial if it starts before the data does.',
      }
    }
    case 'product': {
      const agg = productAgg(sales, s.products)
      const sold = new Set(agg.map((a) => a.productId))
      const rows: Row[] = [
        ...agg.map((a) => ({ title: a.title, category: a.category, qty: a.qty, revenue: a.revenue, ...(costOk ? { profit: a.profit } : {}) })),
        ...s.products.filter((p) => !sold.has(p.id) && p.status === 'active').map((p) => ({ title: p.title, category: p.category, qty: 0, revenue: 0, ...(costOk ? { profit: 0 } : {}) })),
      ].sort((a, b) => Number(b.qty) - Number(a.qty))
      return {
        cols: [{ key: 'title', label: 'Product' }, { key: 'category', label: 'Category' }, { key: 'qty', label: 'Units sold', fmt: 'int', sum: true }, { key: 'revenue', label: 'Revenue', fmt: 'money', sum: true }, ...(costOk ? [{ key: 'profit', label: 'Gross profit', fmt: 'money' as Fmt, sum: true }] : [])],
        rows,
        chart: { kind: 'bar', x: 'name', series: [{ key: 'qty', label: 'Units sold' }], data: rows.slice(0, 10).map((x) => ({ name: String(x.title).slice(0, 18), qty: x.qty })) },
        notes: 'Sorted by units sold. Products with zero sales appear at the bottom (slow movers). Click a column heading to re-sort.',
      }
    }
    case 'category': {
      const aggs = categoryAgg(productAgg(sales, s.products))
      const total = aggs.reduce((a, c) => a + c.revenue, 0)
      const rows: Row[] = aggs.map((c) => ({ category: c.category, qty: c.qty, revenue: c.revenue, share: total ? (c.revenue / total) * 100 : 0, ...(costOk ? { profit: c.profit } : {}) }))
      return {
        cols: [{ key: 'category', label: 'Category' }, { key: 'qty', label: 'Units', fmt: 'int', sum: true }, { key: 'revenue', label: 'Revenue', fmt: 'money', sum: true }, { key: 'share', label: 'Share', fmt: 'pct' }, ...(costOk ? [{ key: 'profit', label: 'Gross profit', fmt: 'money' as Fmt, sum: true }] : [])],
        rows,
        chart: { kind: 'pie', x: 'category', series: [{ key: 'revenue', label: 'Revenue' }], data: rows },
      }
    }
    case 'gross': {
      const agg = productAgg(sales, s.products)
      const rows: Row[] = agg.map((a) => ({ title: a.title, category: a.category, qty: a.qty, revenue: a.revenue, cost: round2(a.revenue - a.profit), profit: a.profit, margin: a.revenue ? (a.profit / a.revenue) * 100 : 0 })).sort((a, b) => Number(b.profit) - Number(a.profit))
      const ser = dailySeries(s.sales, s.returns, r)
      return {
        cols: [{ key: 'title', label: 'Product' }, { key: 'category', label: 'Category' }, { key: 'qty', label: 'Units', fmt: 'int', sum: true }, { key: 'revenue', label: 'Selling value', fmt: 'money', sum: true }, { key: 'cost', label: 'Cost', fmt: 'money', sum: true }, { key: 'profit', label: 'Gross profit', fmt: 'money', sum: true }, { key: 'margin', label: 'Margin', fmt: 'pct' }],
        rows,
        chart: { kind: 'line', x: 'label', series: [{ key: 'sales', label: 'Sales' }, { key: 'profit', label: 'Gross profit' }], data: ser as unknown as Row[] },
        notes: 'Revenue is after discounts and refunds; cost uses the product cost recorded at the time of sale.',
      }
    }
    case 'net': {
      const sum = summarise(sales, s.returns)
      const ex = expensesIn(s.expenses, r)
      const byCat = new Map<string, number>()
      ex.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount))
      const totalEx = round2(ex.reduce((a, e) => a + e.amount, 0))
      const revenue = round2(sum.profit + sum.cost)
      const rows: Row[] = [
        { item: 'Net sales (after discounts & refunds, excl. tax)', amount: revenue },
        { item: 'Less: cost of goods sold', amount: -sum.cost },
        { item: 'Gross profit', amount: sum.profit },
        ...[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ item: `Expense – ${c}`, amount: -v })),
        { item: 'Total operating expenses', amount: -totalEx },
        { item: 'NET PROFIT', amount: round2(sum.profit - totalEx) },
      ]
      return { cols: [{ key: 'item', label: 'Statement' }, { key: 'amount', label: 'Amount', fmt: 'money' }], rows, notes: 'Estimated from recorded sales costs and recorded expenses only (not an accounting statement). One-off stock purchases are not expenses — cost is recognised when goods are sold.' }
    }
    case 'valuation': {
      const rows: Row[] = s.products.filter((p) => p.qty > 0).map((p) => ({ title: p.title, category: p.category, qty: p.qty, cost: p.cost, value: round2(p.qty * p.cost), retail: round2(p.qty * p.price) })).sort((a, b) => Number(b.value) - Number(a.value))
      return {
        cols: [{ key: 'title', label: 'Product' }, { key: 'category', label: 'Category' }, { key: 'qty', label: 'Qty', fmt: 'int', sum: true }, ...(costOk ? [{ key: 'cost', label: 'Unit cost', fmt: 'money' as Fmt }, { key: 'value', label: 'Stock value (cost)', fmt: 'money' as Fmt, sum: true }] : []), { key: 'retail', label: 'Retail value', fmt: 'money', sum: true }],
        rows: rows.map((x) => (costOk ? x : { ...x, cost: undefined, value: undefined })),
        notes: 'Snapshot of current stock (date range does not apply).',
      }
    }
    case 'low': {
      const rows: Row[] = s.products.filter((p) => p.status === 'active' && p.qty <= p.minStock).map((p) => ({ title: p.title, category: p.category, qty: p.qty, min: p.minStock, suggest: Math.max(p.minStock * 3 - p.qty, 1), supplier: s.suppliers.find((x) => x.id === p.supplierId)?.name ?? '—', status: p.qty === 0 ? 'Out of stock' : 'Low stock' })).sort((a, b) => Number(a.qty) - Number(b.qty))
      return { cols: [{ key: 'title', label: 'Product' }, { key: 'category', label: 'Category' }, { key: 'qty', label: 'On hand', fmt: 'int' }, { key: 'min', label: 'Minimum', fmt: 'int' }, { key: 'suggest', label: 'Suggested order', fmt: 'int' }, { key: 'supplier', label: 'Supplier' }, { key: 'status', label: 'Status' }], rows, notes: 'Current snapshot. Use Stock → Low stock & reorder to create draft purchase orders.' }
    }
    case 'movement': {
      const m = new Map<string, Row>()
      s.movements.filter((x) => inRange(x.date, r)).forEach((x) => {
        const p = pm.get(x.productId)
        const row = m.get(x.productId) ?? { title: p?.title ?? '—', purchase: 0, sale: 0, ret: 0, damage: 0, adj: 0, net: 0 }
        const q = x.qty
        const k = x.type === 'purchase' ? 'purchase' : x.type === 'sale' || x.type === 'void' ? 'sale' : x.type === 'return' ? 'ret' : x.type === 'damage' || x.type === 'lost' || x.type === 'supplier_return' ? 'damage' : 'adj'
        if (x.type !== 'opening') {
          row[k] = Number(row[k]) + q
          row.net = Number(row.net) + q
          m.set(x.productId, row)
        }
      })
      return { cols: [{ key: 'title', label: 'Product' }, { key: 'purchase', label: 'Purchased', fmt: 'int', sum: true }, { key: 'sale', label: 'Sold', fmt: 'int', sum: true }, { key: 'ret', label: 'Returned', fmt: 'int', sum: true }, { key: 'damage', label: 'Damaged / lost / sent back', fmt: 'int', sum: true }, { key: 'adj', label: 'Adjustments', fmt: 'int', sum: true }, { key: 'net', label: 'Net change', fmt: 'int', sum: true }], rows: [...m.values()].sort((a, b) => Math.abs(Number(b.net)) - Math.abs(Number(a.net))) }
    }
    case 'supplier': {
      const rows: Row[] = s.suppliers.map((sp) => {
        const pos = s.purchaseOrders.filter((p) => p.supplierId === sp.id && p.status !== 'cancelled' && p.status !== 'draft' && inRange(p.date, r))
        return { name: sp.name, orders: pos.length, total: round2(pos.reduce((a, p) => a + poTotal(p), 0)), paid: round2(pos.reduce((a, p) => a + poPaid(p), 0)), payable: round2(s.purchaseOrders.filter((p) => p.supplierId === sp.id).reduce((a, p) => a + poPayable(p), 0)) }
      }).filter((x) => Number(x.orders) > 0 || Number(x.payable) > 0).sort((a, b) => Number(b.total) - Number(a.total))
      return { cols: [{ key: 'name', label: 'Supplier' }, { key: 'orders', label: 'Orders', fmt: 'int', sum: true }, { key: 'total', label: 'Purchased', fmt: 'money', sum: true }, { key: 'paid', label: 'Paid', fmt: 'money', sum: true }, { key: 'payable', label: 'Total payable now', fmt: 'money', sum: true }], rows, chart: { kind: 'bar', x: 'name', series: [{ key: 'total', label: 'Purchased' }, { key: 'paid', label: 'Paid' }], data: rows }, notes: '“Total payable now” is the current outstanding amount across all orders, regardless of date range.' }
    }
    case 'customers': {
      const rows: Row[] = s.customers.filter((c) => c.balance > 0).map((c) => ({ name: c.name, group: c.group, phone: c.phone, balance: c.balance, limit: c.creditLimit, last: s.sales.filter((x) => x.customerId === c.id).map((x) => x.date).sort().pop() })).sort((a, b) => Number(b.balance) - Number(a.balance))
      return { cols: [{ key: 'name', label: 'Customer' }, { key: 'group', label: 'Group' }, { key: 'phone', label: 'Phone' }, { key: 'balance', label: 'Outstanding', fmt: 'money', sum: true }, { key: 'limit', label: 'Credit limit', fmt: 'money' }, { key: 'last', label: 'Last purchase', fmt: 'date' }], rows }
    }
    case 'cashier': {
      const rows: Row[] = s.users.filter((u) => u.permissions.includes('pos')).map((u) => {
        const mine = s.sales.filter((x) => x.cashierId === u.id && inRange(x.date, r))
        const ok = mine.filter((x) => x.status !== 'voided')
        return { name: um.get(u.id), bills: ok.length, sales: round2(ok.reduce((a, x) => a + x.total, 0)), avg: ok.length ? round2(ok.reduce((a, x) => a + x.total, 0) / ok.length) : 0, discount: round2(ok.reduce((a, x) => a + saleDiscount(x), 0)), voids: mine.filter((x) => x.status === 'voided').length, refunds: round2(s.returns.filter((x) => x.staffId === u.id && inRange(x.date, r)).reduce((a, x) => a + x.amount, 0)) }
      }).filter((x) => Number(x.bills) > 0 || Number(x.voids) > 0)
      return { cols: [{ key: 'name', label: 'Staff member' }, { key: 'bills', label: 'Bills', fmt: 'int', sum: true }, { key: 'sales', label: 'Sales', fmt: 'money', sum: true }, { key: 'avg', label: 'Avg bill', fmt: 'money' }, { key: 'discount', label: 'Discounts given', fmt: 'money', sum: true }, { key: 'voids', label: 'Voided bills', fmt: 'int', sum: true }, { key: 'refunds', label: 'Refunds processed', fmt: 'money', sum: true }], rows, chart: { kind: 'bar', x: 'name', series: [{ key: 'sales', label: 'Sales' }], data: rows } }
    }
    case 'expcash': {
      const ex = expensesIn(s.expenses, r)
      const byCat = new Map<string, number>()
      ex.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount))
      const sh = s.shifts.filter((x) => x.closedAt && inRange(x.openedAt, r))
      const rows: Row[] = [
        ...[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ item: `Expense – ${c}`, detail: `${ex.filter((e) => e.category === c).length} entries`, amount: v })),
        { item: 'TOTAL EXPENSES', detail: `${ex.length} entries`, amount: round2(ex.reduce((a, e) => a + e.amount, 0)) },
        { item: 'Shifts closed', detail: `${sh.length} shifts`, amount: undefined },
        { item: 'Shifts with a cash difference', detail: `${sh.filter((x) => x.difference).length} shifts`, amount: round2(sh.reduce((a, x) => a + (x.difference ?? 0), 0)) },
        { item: 'Cash payments received', detail: PAY_LABEL.cash, amount: paymentBreakdown(sales).find((p) => p.method === 'cash')?.amount ?? 0 },
      ]
      return { cols: [{ key: 'item', label: 'Item' }, { key: 'detail', label: 'Detail' }, { key: 'amount', label: 'Amount', fmt: 'money' }], rows, chart: { kind: 'pie', x: 'name', series: [{ key: 'v', label: 'Expenses' }], data: [...byCat.entries()].map(([name, v]) => ({ name, v })) }, notes: `Period: ${fromStr} to ${toStr}. “Cash difference” total is the net over/short across closed shifts.` }
    }
  }
}
