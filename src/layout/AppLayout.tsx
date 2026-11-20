import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  Languages,
  LogOut,
  Menu,
  Moon,
  Package,
  Receipt,
  Settings as SettingsIcon,
  ShoppingCart,
  Sun,
  Truck,
  UserCog,
  Users,
  Wallet,
  BarChart3,
  Boxes,
  ShieldAlert,
  Plus,
  X,
} from 'lucide-react'
import { useCan, useCurrentUser, useStore } from '../store/useStore'
import { useT } from '../i18n'
import { LogoMark } from '../components/Receipt'
import { DialogHost, toast } from '../components/dialogs'
import { ROLE_LABELS } from '../data/roles'
import { poPayable } from '../lib/calc'
import { fmtDate, startOfDay } from '../lib/utils'
import type { Permission } from '../types'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  any?: Permission[]
}

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Front office',
    items: [
      { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { to: '/pos', label: 'POS / Sales', icon: <ShoppingCart size={18} />, any: ['pos'] },
      { to: '/sales', label: 'Sales & Returns', icon: <Receipt size={18} />, any: ['pos', 'refund', 'reports'] },
      { to: '/customers', label: 'Customers', icon: <Users size={18} />, any: ['customers', 'pos'] },
      { to: '/orders', label: 'Orders & Quotes', icon: <ClipboardList size={18} />, any: ['orders'] },
    ],
  },
  {
    group: 'Back office',
    items: [
      { to: '/products', label: 'Products', icon: <BookOpen size={18} />, any: ['products', 'pos', 'purchasing'] },
      { to: '/stock', label: 'Stock', icon: <Boxes size={18} />, any: ['products', 'adjustStock', 'reports'] },
      { to: '/purchasing', label: 'Purchasing', icon: <Package size={18} />, any: ['purchasing', 'reports', 'finance'] },
      { to: '/suppliers', label: 'Suppliers', icon: <Truck size={18} />, any: ['purchasing', 'reports', 'finance'] },
      { to: '/cash', label: 'Cash & Expenses', icon: <Wallet size={18} />, any: ['finance', 'pos'] },
      { to: '/reports', label: 'Reports', icon: <BarChart3 size={18} />, any: ['reports'] },
    ],
  },
  {
    group: 'Administration',
    items: [
      { to: '/staff', label: 'Staff', icon: <UserCog size={18} />, any: ['settings'] },
      { to: '/settings', label: 'Settings', icon: <SettingsIcon size={18} />, any: ['settings'] },
    ],
  },
]

export function Guard({ any, children }: { any?: Permission[]; children: ReactNode }) {
  const can = useCan()
  if (any && !any.some(can)) {
    return (
      <div className="empty" style={{ marginTop: 60 }}>
        <div className="empty-icon">
          <ShieldAlert size={30} />
        </div>
        <strong>You don’t have access to this page</strong>
        <p className="muted">Ask the owner or a manager to grant the required permission in Staff → Permissions.</p>
      </div>
    )
  }
  return <>{children}</>
}

export default function AppLayout() {
  const user = useCurrentUser()
  const can = useCan()
  const nav = useNavigate()
  const loc = useLocation()
  const t = useT()
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const logout = useStore((s) => s.logout)
  const products = useStore((s) => s.products)
  const reservations = useStore((s) => s.reservations)
  const specialOrders = useStore((s) => s.specialOrders)
  const purchaseOrders = useStore((s) => s.purchaseOrders)
  const [open, setOpen] = useState(false)
  const [bell, setBell] = useState(false)

  useEffect(() => setOpen(false), [loc.pathname])
  useEffect(() => {
    document.documentElement.dataset.theme = settings.appearance.theme
    document.documentElement.style.setProperty('--accent', settings.appearance.accent)
  }, [settings.appearance.theme, settings.appearance.accent])

  useEffect(() => {
    if (!user) nav('/login', { replace: true })
  }, [user, nav])

  // idle session timeout (Settings → Data & security)
  const userId = user?.id
  const sessionMinutes = settings.security.sessionMinutes
  useEffect(() => {
    if (!userId || !sessionMinutes) return
    let last = Date.now()
    const bump = () => (last = Date.now())
    const evs = ['mousemove', 'keydown', 'click', 'touchstart'] as const
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const timer = setInterval(() => {
      if (Date.now() - last > sessionMinutes * 60000) {
        logout()
        toast.info('Signed out after a period of inactivity')
        nav('/login')
      }
    }, 20000)
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(timer)
    }
  }, [userId, sessionMinutes, logout, nav])

  const alerts = useMemo(() => {
    const n = settings.notifications
    const out: { id: string; text: string; to: string; tone: 'red' | 'amber' | 'blue' }[] = []
    const today = startOfDay()
    if (n.lowStock && can('products')) {
      const low = products.filter((p) => p.status === 'active' && p.qty <= p.minStock)
      const outOf = low.filter((p) => p.qty === 0).length
      if (low.length) out.push({ id: 'low', text: `${low.length} products at/below minimum stock (${outOf} out of stock)`, to: '/stock', tone: 'red' })
    }
    if (n.reservations && can('orders')) {
      const od = reservations.filter((r) => r.status === 'active' && new Date(r.until) < today)
      if (od.length) out.push({ id: 'res', text: `${od.length} overdue reservation${od.length > 1 ? 's' : ''} – contact customers`, to: '/orders', tone: 'amber' })
    }
    if (n.pendingOrders && can('orders')) {
      const so = specialOrders.filter((o) => o.status === 'received')
      if (so.length) out.push({ id: 'so', text: `${so.length} special order${so.length > 1 ? 's' : ''} received – notify customer`, to: '/orders', tone: 'blue' })
    }
    if (can('purchasing') || can('finance')) {
      const od = purchaseOrders.filter((p) => poPayable(p) > 0 && p.dueDate && new Date(p.dueDate) < today)
      if (od.length) out.push({ id: 'pay', text: `${od.length} supplier payment${od.length > 1 ? 's' : ''} overdue`, to: '/purchasing', tone: 'red' })
    }
    return out
  }, [products, reservations, specialOrders, purchaseOrders, settings.notifications, can])

  if (!user) return null
  const dark = settings.appearance.theme === 'dark'
  const lang = settings.appearance.language

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <LogoMark size={38} />
          <div>
            <strong>{settings.business.name}</strong>
            <small>POS &amp; Management</small>
          </div>
          <button className="icon-btn only-mobile" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        {can('pos') && (
          <button className="btn primary lg new-sale" onClick={() => nav('/pos')}>
            <Plus size={18} /> {t('New Sale')}
          </button>
        )}
        <nav>
          {NAV.map((g) => {
            const items = g.items.filter((i) => !i.any || i.any.some(can))
            if (!items.length) return null
            return (
              <div key={g.group} className="nav-group">
                <div className="nav-title">{g.group}</div>
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    {i.icon}
                    <span>{t(i.label)}</span>
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="powered">
            Built by <b>DVULabs</b>
            <br />
            <span>Demo build • data stored in this browser</span>
          </div>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <span className="muted small">{fmtDate(new Date().toISOString())}</span>
            <strong>
              {t('Welcome')}, {user.name.split(' ')[0]}
            </strong>
          </div>
          <div className="spacer" />
          <button
            className="icon-btn"
            title="Switch language / භාෂාව"
            onClick={() => setSettings((s) => ({ ...s, appearance: { ...s.appearance, language: lang === 'en' ? 'si' : 'en' } }))}
          >
            <Languages size={18} />
            <span className="lang-tag">{lang === 'en' ? 'EN' : 'සිං'}</span>
          </button>
          <button className="icon-btn" title="Toggle dark mode" onClick={() => setSettings((s) => ({ ...s, appearance: { ...s.appearance, theme: dark ? 'light' : 'dark' } }))}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="bell-wrap">
            <button className="icon-btn" onClick={() => setBell((b) => !b)} aria-label="Notifications">
              <Bell size={18} />
              {alerts.length > 0 && <span className="dot">{alerts.length}</span>}
            </button>
            {bell && (
              <>
                <div className="scrim clear" onClick={() => setBell(false)} />
                <div className="popover">
                  <strong>Notifications</strong>
                  {alerts.length === 0 && <p className="muted">All clear — nothing needs attention.</p>}
                  {alerts.map((a) => (
                    <button
                      key={a.id}
                      className={`alert-row ${a.tone}`}
                      onClick={() => {
                        setBell(false)
                        nav(a.to)
                      }}
                    >
                      {a.text}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="user-chip">
            <div className="avatar">{user.name[0]}</div>
            <div className="user-meta">
              <strong>{user.name}</strong>
              <small>{ROLE_LABELS[user.role]}</small>
            </div>
            <button
              className="icon-btn"
              title={t('Sign out')}
              onClick={() => {
                logout()
                nav('/login')
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      <DialogHost />
    </div>
  )
}
