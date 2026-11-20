import type { Permission, RoleId } from '../types'

export const ALL_PERMISSIONS: Permission[] = [
  'pos',
  'products',
  'purchasing',
  'customers',
  'orders',
  'viewCost',
  'overrideDiscount',
  'void',
  'refund',
  'credit',
  'adjustStock',
  'reports',
  'finance',
  'settings',
  'export',
]

export const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  owner: [...ALL_PERMISSIONS],
  manager: ['pos', 'products', 'purchasing', 'customers', 'orders', 'viewCost', 'overrideDiscount', 'void', 'refund', 'credit', 'adjustStock', 'reports', 'finance'],
  cashier: ['pos', 'customers', 'orders'],
  stock: ['products', 'adjustStock'],
  purchasing: ['purchasing', 'products'],
  accountant: ['reports', 'finance', 'viewCost', 'export'],
}

export const ROLE_LABELS: Record<RoleId, string> = {
  owner: 'Owner / Administrator',
  manager: 'Manager',
  cashier: 'Cashier',
  stock: 'Inventory / Stock Clerk',
  purchasing: 'Purchasing Staff',
  accountant: 'Accountant',
}

export const ROLE_DESC: Record<RoleId, string> = {
  owner: 'Full access to business settings, users, products, purchases, POS, finance, reports and all approvals.',
  manager: 'Oversee sales, products, stock, suppliers, discounts, returns, staff activity and selected reports; approve restricted actions.',
  cashier: 'Use POS, search products, register permitted customers, receive payments and print receipts; no access to restricted costs or settings.',
  stock: 'Add and update products, receive stock, print labels and record approved stock adjustments; no unrestricted financial access.',
  purchasing: 'Create purchase orders, record supplier invoices and goods received, and view supplier-related records.',
  accountant: 'View sales, purchases, expenses, supplier/customer balances and financial reports; no product or user administration unless granted.',
}
