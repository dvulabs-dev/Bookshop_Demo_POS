import { Route, Routes, Navigate } from 'react-router-dom'
import AppLayout, { Guard } from './layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import Products from './pages/Products'
import Stock from './pages/Stock'
import Purchasing from './pages/Purchasing'
import Suppliers from './pages/Suppliers'
import Customers from './pages/Customers'
import Orders from './pages/Orders'
import Sales from './pages/Sales'
import Cash from './pages/Cash'
import Reports from './pages/Reports'
import Staff from './pages/Staff'
import SettingsPage from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<Guard any={['pos']}><POS /></Guard>} />
        <Route path="sales" element={<Guard any={['pos', 'refund', 'reports']}><Sales /></Guard>} />
        <Route path="customers" element={<Guard any={['customers', 'pos']}><Customers /></Guard>} />
        <Route path="orders" element={<Guard any={['orders']}><Orders /></Guard>} />
        <Route path="products" element={<Guard any={['products', 'pos', 'purchasing']}><Products /></Guard>} />
        <Route path="stock" element={<Guard any={['products', 'adjustStock', 'reports']}><Stock /></Guard>} />
        <Route path="purchasing" element={<Guard any={['purchasing', 'reports', 'finance']}><Purchasing /></Guard>} />
        <Route path="suppliers" element={<Guard any={['purchasing', 'reports', 'finance']}><Suppliers /></Guard>} />
        <Route path="cash" element={<Guard any={['finance', 'pos']}><Cash /></Guard>} />
        <Route path="reports" element={<Guard any={['reports']}><Reports /></Guard>} />
        <Route path="staff" element={<Guard any={['settings']}><Staff /></Guard>} />
        <Route path="settings" element={<Guard any={['settings']}><SettingsPage /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
