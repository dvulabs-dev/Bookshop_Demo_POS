export type Permission =
  | 'pos' // use POS & take payments
  | 'products' // add / edit products, print labels
  | 'purchasing' // POs, supplier invoices, goods received
  | 'customers' // register / edit customers
  | 'orders' // quotations, reservations, special orders
  | 'viewCost' // view cost prices & margins
  | 'overrideDiscount' // change selling price / discount above cashier limit
  | 'void' // void / cancel / delete transactions
  | 'refund' // refunds, returns, exchanges
  | 'credit' // credit sales & balance adjustments
  | 'adjustStock' // adjust stock / mark damaged-lost
  | 'reports' // sales, profit & financial reports
  | 'finance' // expenses, cash & shifts overview
  | 'settings' // users, roles, settings, backups
  | 'export' // export customer / financial data

export const PERMISSION_LABELS: Record<Permission, string> = {
  pos: 'Use POS & take payments',
  products: 'Manage products & labels',
  purchasing: 'Purchasing & suppliers',
  customers: 'Manage customers',
  orders: 'Quotations, reservations & special orders',
  viewCost: 'View / edit cost prices & profit margins',
  overrideDiscount: 'Change prices / discount above cashier limit',
  void: 'Void, cancel or delete transactions',
  refund: 'Process refunds, returns & exchanges',
  credit: 'Create / approve credit sales & balance adjustments',
  adjustStock: 'Adjust stock or mark damaged / lost',
  reports: 'View sales, profit, expense & financial reports',
  finance: 'Expenses, cash & shift management',
  settings: 'Manage users, roles, settings & backups',
  export: 'Export customer or financial data',
}

export type RoleId = 'owner' | 'manager' | 'cashier' | 'stock' | 'purchasing' | 'accountant'

export interface User {
  id: string
  name: string
  username: string
  password: string
  pin: string // manager approval PIN
  role: RoleId
  permissions: Permission[]
  active: boolean
  phone?: string
  lastLogin?: string
}

export type ProductType = 'book' | 'stationery' | 'school' | 'art' | 'office'
export type ProductStatus = 'active' | 'discontinued' | 'damaged'

export interface Product {
  id: string
  code: string // internal product code
  barcode: string // EAN-13 (ISBN-13 for books or internal)
  isbn?: string
  title: string
  author?: string
  publisher?: string
  edition?: string
  language?: string
  year?: number
  type: ProductType
  category: string
  subcategory?: string
  grade?: string
  subject?: string
  brand?: string
  format?: string
  binding?: string
  size?: string
  colour?: string
  unit: string
  cost: number
  price: number
  wholesale?: number
  minPrice?: number
  supplierId?: string
  supplierCode?: string
  location: string
  qty: number
  reserved: number
  minStock: number
  status: ProductStatus
  createdAt: string
  hue: number // used to draw the cover swatch
}

export interface Customer {
  id: string
  code: string
  name: string
  phone: string
  email?: string
  address?: string
  group: 'Regular' | 'Student' | 'Teacher' | 'School' | 'Wholesale'
  discountPct: number
  points: number
  balance: number // outstanding (credit) owed by customer
  deposit: number
  creditLimit: number
  notes?: string
  contactPref: 'Phone' | 'WhatsApp' | 'Email' | 'SMS'
  createdAt: string
}

export interface Supplier {
  id: string
  name: string
  contact: string
  phone: string
  email?: string
  address?: string
  notes?: string
}

export type PayMethod = 'cash' | 'card' | 'bank' | 'qr' | 'storeCredit' | 'advance'
export type ToggleMethod = Exclude<PayMethod, 'advance'>

export interface CustomerPayment {
  id: string
  date: string
  customerId: string
  amount: number
  method: PayMethod
  ref?: string
  userId: string
  shiftId?: string
}

export interface PriceChange {
  id: string
  date: string
  productId: string
  cost: number
  price: number
  userId: string
  source: string
}

export interface Payment {
  method: PayMethod
  amount: number
  ref?: string
}

export interface SaleLine {
  productId: string
  title: string
  code: string
  barcode: string
  qty: number
  price: number // unit price at time of sale
  cost: number // unit cost snapshot
  discount: number // line discount amount (total for line)
  returnedQty?: number
}

export type SaleStatus = 'completed' | 'voided' | 'refunded' | 'partial_return'

export interface Sale {
  id: string
  no: string
  date: string
  cashierId: string
  customerId?: string
  customerName?: string
  lines: SaleLine[]
  subtotal: number
  discount: number // bill-level discount amount
  tax: number
  total: number
  payments: Payment[]
  paid: number
  change: number
  balance: number // due (credit / partial)
  status: SaleStatus
  voidReason?: string
  voidedBy?: string
  approvedBy?: string
  shiftId?: string
  note?: string
}

export interface ReturnLine {
  productId: string
  title: string
  qty: number
  amount: number
  condition: 'Good' | 'Damaged' | 'Opened'
  restock: boolean
}

export interface SaleReturn {
  id: string
  no: string
  saleId: string
  saleNo: string
  date: string
  lines: ReturnLine[]
  amount: number
  type: 'refund' | 'exchange' | 'storeCredit' | 'balanceAdjustment'
  method?: PayMethod
  reason: string
  staffId: string
  approvedBy?: string
  shiftId?: string
}

export type POStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'

export interface POLine {
  productId: string
  qty: number
  received: number
  unitCost: number
  discount: number // per line total
}

export interface SupplierPayment {
  id: string
  date: string
  amount: number
  method: PayMethod
  ref?: string
  note?: string
}

export interface SupplierReturn {
  id: string
  date: string
  productId: string
  qty: number
  amount: number
  reason: string
}

export interface PurchaseOrder {
  id: string
  no: string
  supplierId: string
  date: string
  invoiceNo?: string
  dueDate?: string
  lines: POLine[]
  charges: number
  discount: number
  status: POStatus
  payments: SupplierPayment[]
  returns: SupplierReturn[]
  notes?: string
  attachment?: string
  createdBy: string
}

export type MovementType =
  | 'opening'
  | 'purchase'
  | 'sale'
  | 'return'
  | 'damage'
  | 'lost'
  | 'adjustment'
  | 'supplier_return'
  | 'void'

export interface StockMovement {
  id: string
  date: string
  productId: string
  type: MovementType
  qty: number // signed
  ref?: string
  userId: string
  reason?: string
}

export interface Expense {
  id: string
  date: string
  category: string
  amount: number
  method: PayMethod
  note?: string
  attachment?: string
  recurring?: 'monthly' | 'weekly' | null
  userId: string
  shiftId?: string
}

export interface Shift {
  id: string
  cashierId: string
  openedAt: string
  closedAt?: string
  openingCash: number
  countedCash?: number
  expectedCash?: number
  difference?: number
  note?: string
}

export interface DocLine {
  productId: string
  qty: number
  price: number
}

export interface Quotation {
  id: string
  no: string
  customerId?: string
  customerName: string
  phone?: string
  date: string
  validUntil: string
  lines: DocLine[]
  discount: number
  status: 'draft' | 'sent' | 'approved' | 'converted' | 'expired' | 'cancelled'
  note?: string
}

export interface Reservation {
  id: string
  no: string
  customerId?: string
  customerName: string
  phone?: string
  date: string
  until: string
  lines: DocLine[]
  advance: number
  status: 'active' | 'collected' | 'cancelled' | 'expired'
  note?: string
}

export type SpecialOrderStatus =
  | 'requested'
  | 'supplier_ordered'
  | 'received'
  | 'customer_notified'
  | 'completed'
  | 'cancelled'

export interface SpecialOrder {
  id: string
  no: string
  customerName: string
  phone: string
  title: string
  author?: string
  isbn?: string
  qty: number
  advance: number
  expectedDate?: string
  status: SpecialOrderStatus
  supplierId?: string
  note?: string
  date: string
}

export interface SchoolList {
  id: string
  name: string
  school: string
  grade: string
  lines: { productId: string; qty: number }[]
}

export interface Bundle {
  id: string
  name: string
  price: number
  lines: { productId: string; qty: number }[]
}

export interface HeldBill {
  id: string
  date: string
  cashierId: string
  customerId?: string
  lines: CartLine[]
  billDiscount: DiscountInput
  note?: string
}

export interface DiscountInput {
  type: 'amount' | 'percent'
  value: number
}

export interface CartLine {
  productId: string
  qty: number
  price: number // editable if allowed
  discount: DiscountInput
}

export interface AuditEntry {
  id: string
  date: string
  userId: string
  action: string
  detail: string
  sensitive?: boolean
}

export interface Settings {
  business: {
    name: string
    tagline: string
    address: string
    phone: string
    email: string
    hours: string
    regNo: string
    branches: string[]
  }
  pos: {
    allowPriceEdit: boolean
    cashierDiscountPct: number // max % cashier can give without approval
    allowCredit: boolean
    allowParking: boolean
    requireShift: boolean
    walkInLabel: string
    methods: Record<ToggleMethod, boolean>
    taxPct: number
    taxLabel: string
    loyaltyEnabled: boolean
    pointsPerLkr: number // LKR spent per 1 point
    pointValue: number // LKR value of 1 point
  }
  receipt: {
    layout: 'thermal' | 'a4'
    prefix: string
    nextNo: number
    footer: string
    returnPolicy: string
    thankYou: string
    showIsbn: boolean
    showCashier: boolean
    showCustomer: boolean
    showPaymentRef: boolean
    showQr: boolean
    taxInfo: string
  }
  inventory: {
    categories: string[]
    publishers: string[]
    brands: string[]
    units: string[]
    locations: string[]
    defaultMinStock: number
  }
  finance: {
    expenseCategories: string[]
    refundApprovalAbove: number
    requireApprovalForRefund: boolean
    requireApprovalForAdjust: boolean
    returnWindowDays: number
    lowCashAlert: number
  }
  appearance: {
    theme: 'light' | 'dark'
    language: 'en' | 'si'
    accent: string
    dashboardCards: Record<string, boolean>
  }
  notifications: {
    lowStock: boolean
    pendingOrders: boolean
    reservations: boolean
    dailySummary: boolean
  }
  security: {
    minPasswordLength: number
    sessionMinutes: number
  }
}
