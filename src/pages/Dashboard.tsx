import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle,
  Banknote,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Package,
  PackageX,
  Receipt,
  Settings2,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useCan, useStore, userName } from '../store/useStore'
import { Badge, Card, PageHeader, Stat, Tabs, Empty, Toggle } from '../components/ui'
import { DateRangeBar, initialRange } from '../components/DateRange'
import { categoryAgg, dailySeries, expensesIn, makeRange, paymentBreakdown, productAgg, rangeSales, summarise, sumExpenses } from '../lib/analytics'
import { PAY_LABEL, poPayable } from '../lib/calc'
import { addDays, fmtDate, fmtDateTime, lkr, num, startOfDay, startOfMonth, startOfWeek, startOfYear } from '../lib/utils'
import { CHART, PROFIT } from '../lib/colors'
import { useT } from '../i18n'

const CARD_LABELS: Record<string, string> = {
  sales: 'Sales summary',
  profit: 'Profit cards',
  stock: 'Stock cards',
  trend: 'Sales trend chart',
  topProducts: 'Top selling products',
  categories: 'Category chart',
  pending: 'Pending payments & orders',
  recent: 'Recent activity',
}

export default function Dashboard() {
  const nav = useNavigate()
  const can = useCan()
  const t = useT()
  const { sales, returns, products, expenses, purchaseOrders, customers, movements, users, audit, specialOrders, settings, setSettings } = useStore()
  const [range, setRange] = useState(initialRange('30d'))
  const [tab, setTab] = useState<'sales' | 'returns' | 'stock' | 'expenses' | 'activity'>('sales')
  const [customize, setCustomize] = useState(false)
  const showFinance = can('reports') || can('viewCost')
  const cards = settings.appearance.dashboardCards
  const r = useMemo(() => makeRange(range.from, range.to), [range])

  const data = useMemo(() => {
    const today = startOfDay()
    const mk = (a: Date, b: Date) => summarise(rangeSales(sales, { from: a, to: b }), returns)
    const endToday = addDays(today, 1)
    const periodSales = rangeSales(sales, r)
    const period = summarise(periodSales, returns)
    const exp = sumExpenses(expensesIn(expenses, r))
    const aggs = productAgg(periodSales, products)
    return {
      today: mk(today, endToday),
      yesterday: mk(addDays(today, -1), today),
      week: mk(startOfWeek(), endToday),
      month: mk(startOfMonth(), endToday),
      year: mk(startOfYear(), endToday),
      period,
      exp,
      series: dailySeries(sales, returns, r),
      top: [...aggs].sort((a, b) => b.qty - a.qty).slice(0, 7),
      cats: categoryAgg(aggs),
      pays: paymentBreakdown(periodSales),
      topBooks: aggs.filter((a) => ['School Textbooks', 'Novels & Literature', "Children's Books", 'Religious', 'Reference & Dictionaries'].includes(a.category)).sort((a, b) => b.qty - a.qty)[0],
      topStat: aggs.filter((a) => !['School Textbooks', 'Novels & Literature', "Children's Books", 'Religious', 'Reference & Dictionaries'].includes(a.category)).sort((a, b) => b.qty - a.qty)[0],
    }
  }, [sales, returns, products, expenses, r])

  const stock = useMemo(() => {
    const active = products.filter((p) => p.status !== 'discontinued')
    return {
      count: products.length,
      units: products.reduce((a, p) => a + p.qty, 0),
      low: active.filter((p) => p.qty > 0 && p.qty <= p.minStock).length,
      out: active.filter((p) => p.qty === 0).length,
      value: products.reduce((a, p) => a + p.qty * p.cost, 0),
    }
  }, [products])

  const pending = useMemo(
    () => ({
      payables: purchaseOrders.reduce((a, p) => a + poPayable(p), 0),
      receivables: customers.reduce((a, c) => a + c.balance, 0),
      openPOs: purchaseOrders.filter((p) => p.status === 'ordered' || p.status === 'partial').length,
      specials: specialOrders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length,
    }),
    [purchaseOrders, customers, specialOrders],
  )

  const pieData = data.cats.slice(0, 6).map((c) => ({ name: c.category, value: Math.round(c.revenue) }))
  const net = data.period.profit - data.exp

  return (
    <>
      <PageHeader
        title={t('Dashboard')}
        subtitle="Live overview calculated from the records in the system."
        actions={
          <>
            <DateRangeBar value={range} onChange={setRange} />
            <div className="pop-wrap">
              <button className="btn" onClick={() => setCustomize((c) => !c)}>
                <Settings2 size={16} /> Customize
              </button>
              {customize && (
                <>
                  <div className="scrim clear" onClick={() => setCustomize(false)} />
                  <div className="popover right">
                    <strong>Dashboard cards</strong>
                    {Object.keys(CARD_LABELS).map((k) => (
                      <Toggle key={k} checked={cards[k] !== false} label={CARD_LABELS[k]} onChange={(v) => setSettings((s) => ({ ...s, appearance: { ...s.appearance, dashboardCards: { ...s.appearance.dashboardCards, [k]: v } } }))} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        }
      />

      {cards.sales !== false && (
        <div className="grid cols-5 tiles">
          {[
            ['Today', data.today.net, `${data.today.bills} bills`],
            ['Yesterday', data.yesterday.net, `${data.yesterday.bills} bills`],
            ['This week', data.week.net, `${data.week.bills} bills`],
            ['This month', data.month.net, `${data.month.bills} bills`],
            ['This year', data.year.net, `${data.year.bills} bills`],
          ].map(([l, v, s]) => (
            <div key={l as string} className="tile">
              <span>{l as string}</span>
              <strong>{lkr(v as number, { decimals: false })}</strong>
              <small>{s as string}</small>
            </div>
          ))}
        </div>
      )}

      <div className="grid cols-4">
        <Stat label="Sales (selected period)" value={lkr(data.period.net, { decimals: false })} sub={data.period.refunds > 0 ? `After ${lkr(data.period.refunds, { decimals: false })} refunds` : `${data.period.bills} bills`} icon={<CircleDollarSign size={20} />} />
        <Stat label="Bills • Items sold" value={`${num(data.period.bills)} • ${num(data.period.items)}`} sub={`Avg bill ${lkr(data.period.avg, { decimals: false })}`} icon={<ShoppingBag size={20} />} tone="blue" />
        {showFinance && cards.profit !== false && (
          <>
            <Stat label="Gross profit" value={lkr(data.period.profit, { decimals: false })} sub={`Margin ${data.period.net > 0 ? ((data.period.profit / (data.period.net - 0)) * 100).toFixed(1) : '0'}%`} icon={<TrendingUp size={20} />} tone="green" />
            <Stat label="Net profit (after expenses)" value={lkr(net, { decimals: false })} sub={`Expenses ${lkr(data.exp, { decimals: false })}`} icon={<Wallet size={20} />} tone={net >= 0 ? 'green' : 'red'} />
          </>
        )}
        {!showFinance && (
          <>
            <Stat label="Discounts given" value={lkr(data.period.discount, { decimals: false })} icon={<Receipt size={20} />} tone="amber" />
            <Stat label="Refunds" value={lkr(data.period.refunds, { decimals: false })} icon={<Banknote size={20} />} tone="red" />
          </>
        )}
      </div>

      {cards.stock !== false && (
        <div className="grid cols-4">
          <Stat label="Products • Units in stock" value={`${num(stock.count)} • ${num(stock.units)}`} sub={can('viewCost') ? `Stock value ${lkr(stock.value, { decimals: false })}` : undefined} icon={<Boxes size={20} />} tone="blue" onClick={() => nav('/stock')} />
          <Stat label="Low stock" value={stock.low} sub="At or below minimum" icon={<AlertTriangle size={20} />} tone="amber" onClick={() => nav('/stock')} />
          <Stat label="Out of stock" value={stock.out} sub="Needs replenishment" icon={<PackageX size={20} />} tone="red" onClick={() => nav('/stock')} />
          <Stat label="Best sellers" value={<span className="small-val">{data.topBooks?.title ?? '—'}</span>} sub={data.topStat ? `Top stationery: ${data.topStat.title}` : undefined} icon={<TrendingUp size={20} />} tone="purple" />
        </div>
      )}

      <div className="grid cols-3-2">
        {cards.trend !== false && (
          <Card title="Sales trend" actions={<span className="muted small">{fmtDate(r.from.toISOString())} – {fmtDate(r.to.toISOString())}</span>}>
            <div className="chart">
              <ResponsiveContainer width="100%" height={270}>
                <AreaChart data={data.series} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART[0]} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART[0]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={40} />
                  <Tooltip formatter={(v) => lkr(Number(v), { decimals: false })} contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="sales" name="Sales" stroke={CHART[0]} strokeWidth={2} fill="url(#gs)" />
                  {showFinance && <Area type="monotone" dataKey="profit" name="Gross profit" stroke={PROFIT} strokeWidth={2} fill="none" />}
                  {showFinance && <Legend />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        {cards.categories !== false && (
          <Card title="Sales by category">
            {pieData.length === 0 ? (
              <Empty title="No sales in this period" />
            ) : (
              <div className="chart">
                <ResponsiveContainer width="100%" height={270}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART[i % CHART.length]} stroke="var(--card)" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => lkr(Number(v), { decimals: false })} contentStyle={tooltipStyle} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="grid cols-2">
        {cards.topProducts !== false && (
          <Card title="Top selling products" actions={<span className="muted small">by units</span>}>
            {data.top.length === 0 ? (
              <Empty title="No sales in this period" />
            ) : (
              <div className="chart">
                <ResponsiveContainer width="100%" height={Math.max(220, data.top.length * 38)}>
                  <BarChart data={data.top.map((a) => ({ name: a.title.length > 30 ? a.title.slice(0, 29) + '…' : a.title, qty: a.qty }))} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={170} tick={{ fill: 'var(--text)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--hover)' }} />
                    <Bar dataKey="qty" name="Units sold" fill={CHART[0]} radius={[0, 5, 5, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        )}
        {cards.pending !== false && (
          <Card title="Payments & pending work">
            <div className="list">
              {showFinance || can('purchasing') ? (
                <button className="list-row" onClick={() => nav('/purchasing')}>
                  <span className="row gap-s"><Package size={18} /> Pending supplier payments</span>
                  <b>{lkr(pending.payables, { decimals: false })}</b>
                </button>
              ) : null}
              <button className="list-row" onClick={() => nav('/customers')}>
                <span className="row gap-s"><Banknote size={18} /> Customer balances (credit)</span>
                <b>{lkr(pending.receivables, { decimals: false })}</b>
              </button>
              <button className="list-row" onClick={() => nav('/purchasing')}>
                <span className="row gap-s"><ClipboardList size={18} /> Purchase orders awaiting goods</span>
                <b>{pending.openPOs}</b>
              </button>
              <button className="list-row" onClick={() => nav('/orders')}>
                <span className="row gap-s"><ClipboardList size={18} /> Open special orders</span>
                <b>{pending.specials}</b>
              </button>
              <button className="list-row" onClick={() => nav('/stock')}>
                <span className="row gap-s"><AlertTriangle size={18} /> Items to reorder</span>
                <b>{stock.low + stock.out}</b>
              </button>
            </div>
            <div className="divider" />
            <p className="muted small">Payment methods in this period</p>
            <div className="chips">
              {data.pays.map((p) => (
                <span key={p.method} className="chip">
                  {PAY_LABEL[p.method]}: <b>{lkr(p.amount, { decimals: false })}</b>
                </span>
              ))}
              {data.pays.length === 0 && <span className="muted">—</span>}
            </div>
          </Card>
        )}
      </div>

      {cards.recent !== false && (
        <Card
          title="Recent activity"
          pad={false}
          actions={
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'sales', label: 'Sales' },
                { id: 'returns', label: 'Returns' },
                { id: 'stock', label: 'Stock receipts' },
                { id: 'expenses', label: 'Expenses' },
                { id: 'activity', label: 'User activity' },
              ].filter((x) => (x.id === 'expenses' ? can('finance') || can('reports') : x.id === 'activity' ? can('settings') : true)) as { id: typeof tab; label: string }[]}
            />
          }
        >
          <div className="tbl-wrap">
            <table className="table">
              {tab === 'sales' && (
                <>
                  <thead><tr><th>Receipt</th><th>Time</th><th>Customer</th><th>Cashier</th><th className="r">Total</th><th>Status</th></tr></thead>
                  <tbody>
                    {[...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((s) => (
                      <tr key={s.id} className="clickable" onClick={() => nav('/sales')}>
                        <td><b>{s.no}</b></td>
                        <td>{fmtDateTime(s.date)}</td>
                        <td>{s.customerName ?? '—'}</td>
                        <td>{userName(users, s.cashierId)}</td>
                        <td className="r">{lkr(s.total)}</td>
                        <td><Badge tone={s.status === 'completed' ? (s.balance > 0 ? 'amber' : 'green') : s.status === 'voided' ? 'red' : 'blue'}>{s.status === 'completed' && s.balance > 0 ? 'Part paid' : s.status.replace('_', ' ')}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {tab === 'returns' && (
                <>
                  <thead><tr><th>Return</th><th>Date</th><th>Original bill</th><th>Reason</th><th className="r">Amount</th></tr></thead>
                  <tbody>
                    {returns.slice(0, 8).map((x) => (
                      <tr key={x.id}><td><b>{x.no}</b></td><td>{fmtDateTime(x.date)}</td><td>{x.saleNo}</td><td>{x.reason}</td><td className="r">{lkr(x.amount)}</td></tr>
                    ))}
                    {returns.length === 0 && <tr><td colSpan={5} className="muted">No returns yet</td></tr>}
                  </tbody>
                </>
              )}
              {tab === 'stock' && (
                <>
                  <thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="r">Qty</th><th>Reference</th></tr></thead>
                  <tbody>
                    {movements.filter((m) => m.type === 'purchase').slice(0, 8).map((m) => (
                      <tr key={m.id}><td>{fmtDateTime(m.date)}</td><td>{products.find((p) => p.id === m.productId)?.title}</td><td><Badge tone="green">Received</Badge></td><td className="r">+{m.qty}</td><td>{m.ref}</td></tr>
                    ))}
                  </tbody>
                </>
              )}
              {tab === 'expenses' && (
                <>
                  <thead><tr><th>Date</th><th>Category</th><th>Note</th><th className="r">Amount</th></tr></thead>
                  <tbody>
                    {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((e) => (
                      <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{e.category}</td><td className="muted">{e.note ?? '—'}</td><td className="r">{lkr(e.amount)}</td></tr>
                    ))}
                  </tbody>
                </>
              )}
              {tab === 'activity' && (
                <>
                  <thead><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
                  <tbody>
                    {audit.slice(0, 8).map((a) => (
                      <tr key={a.id}><td>{fmtDateTime(a.date)}</td><td>{userName(users, a.userId)}</td><td>{a.sensitive ? <Badge tone="amber">{a.action}</Badge> : a.action}</td><td className="muted">{a.detail}</td></tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

export const tooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,.14)',
  color: 'var(--text)',
}
