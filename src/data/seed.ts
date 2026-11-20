import type {
  AuditEntry,
  Bundle,
  Customer,
  Expense,
  PayMethod,
  Product,
  ProductType,
  PurchaseOrder,
  Quotation,
  Reservation,
  Sale,
  SaleLine,
  SaleReturn,
  SchoolList,
  Settings,
  Shift,
  SpecialOrder,
  StockMovement,
  Supplier,
  User,
} from '../types'
import { addDays, internalBarcode, round2, startOfDay, withCheck } from '../lib/utils'
import { ROLE_PERMISSIONS } from './roles'

/* ---------- deterministic RNG so the demo always looks the same ---------- */
function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const defaultSettings = (): Settings => ({
  business: {
    name: 'Dinuda Bookshop',
    tagline: 'Books • Stationery • School Supplies',
    address: 'Colombo Road, Hanwella, Sri Lanka',
    phone: '+94 77 123 4567',
    email: 'hello@dinudabookshop.lk',
    hours: 'Mon–Sat 8:30 AM – 7:30 PM • Sun 9:00 AM – 1:00 PM',
    regNo: 'BR/WP/HW/12345',
    branches: ['Hanwella (Main)'],
  },
  pos: {
    allowPriceEdit: true,
    cashierDiscountPct: 10,
    allowCredit: true,
    allowParking: true,
    requireShift: true,
    walkInLabel: 'Walk-in Customer',
    methods: { cash: true, card: true, bank: true, qr: true, storeCredit: true },
    taxPct: 0,
    taxLabel: 'VAT',
    loyaltyEnabled: true,
    pointsPerLkr: 100,
    pointValue: 1,
  },
  receipt: {
    layout: 'thermal',
    prefix: 'DBS-',
    nextNo: 1,
    footer: 'Books open minds — thank you for shopping with us!',
    returnPolicy: 'Goods may be exchanged within 7 days with the receipt, if unused and undamaged.',
    thankYou: 'Thank you! Please visit again.',
    showIsbn: true,
    showCashier: true,
    showCustomer: true,
    showPaymentRef: true,
    showQr: true,
    taxInfo: '',
  },
  inventory: {
    categories: [
      'School Textbooks',
      'Novels & Literature',
      "Children's Books",
      'Religious',
      'Reference & Dictionaries',
      'Exercise Books',
      'Pens & Pencils',
      'School Supplies',
      'Art Supplies',
      'Office Supplies',
    ],
    publishers: [
      'Sarasavi Publishers',
      'M.D. Gunasena',
      'Godage International',
      'Educational Publications Dept.',
      'Vijitha Yapa Publications',
      'Bloomsbury',
      'Penguin Random House',
      'Oxford University Press',
    ],
    brands: ['Atlas', 'Pilot', 'Faber-Castell', 'Staedtler', 'Camlin', 'Casio', 'Pelikan', 'Stabilo', 'UHU', 'Kangaro', 'Double A', '3M', 'Maped'],
    units: ['pcs', 'pack', 'set', 'box', 'ream', 'roll', 'dozen'],
    locations: ['A-01', 'A-02', 'A-03', 'B-01', 'B-02', 'B-03', 'C-01', 'C-02', 'S-1', 'S-2', 'S-3', 'O-1', 'O-2', 'Storeroom'],
    defaultMinStock: 5,
  },
  finance: {
    expenseCategories: ['Rent', 'Electricity', 'Water', 'Internet & Telephone', 'Transport & Delivery', 'Packaging', 'Cleaning', 'Salaries & Wages', 'Maintenance', 'Other'],
    refundApprovalAbove: 5000,
    requireApprovalForRefund: true,
    requireApprovalForAdjust: false,
    returnWindowDays: 7,
    lowCashAlert: 2000,
  },
  appearance: {
    theme: 'light',
    language: 'en',
    accent: '#1b8196',
    dashboardCards: {
      sales: true,
      profit: true,
      stock: true,
      topProducts: true,
      categories: true,
      pending: true,
      recent: true,
      trend: true,
    },
  },
  notifications: { lowStock: true, pendingOrders: true, reservations: true, dailySummary: true },
  security: { minPasswordLength: 6, sessionMinutes: 480 },
})

/* ---------- master data ---------- */

export const seedUsers = (): User[] => {
  const mk = (id: string, name: string, username: string, role: User['role'], pin: string, phone: string): User => ({
    id,
    name,
    username,
    password: 'demo',
    pin,
    role,
    permissions: [...ROLE_PERMISSIONS[role]],
    active: true,
    phone,
  })
  return [
    mk('u1', 'Shop Owner', 'owner', 'owner', '1111', '077 111 1111'),
    mk('u2', 'Nimali Perera', 'manager', 'manager', '2222', '071 222 2222'),
    mk('u3', 'Kasun Silva', 'cashier', 'cashier', '3333', '076 333 3333'),
    mk('u4', 'Sanduni Fernando', 'sanduni', 'cashier', '4444', '070 444 4444'),
    mk('u5', 'Ruwan Jayasinghe', 'stock', 'stock', '5555', '072 555 5555'),
    mk('u6', 'Amal Wijesekara', 'purchasing', 'purchasing', '6666', '075 666 6666'),
    mk('u7', 'Tharindu Gamage', 'accountant', 'accountant', '7777', '078 777 7777'),
  ]
}

export const seedSuppliers = (): Supplier[] => [
  { id: 's1', name: 'M.D. Gunasena & Co.', contact: 'Mr. Chaminda', phone: '011 232 0001', email: 'orders@mdgunasena.example', address: 'Olcott Mawatha, Colombo 11', notes: 'Novels, reference, general books. 30-day credit.' },
  { id: 's2', name: 'Sarasavi Distributors', contact: 'Ms. Dilani', phone: '011 281 4455', email: 'sales@sarasavi.example', address: 'Nugegoda', notes: 'School guide books and past papers.' },
  { id: 's3', name: 'Atlas Axillia Distributors', contact: 'Mr. Pradeep', phone: '011 255 7788', email: 'dist@atlas.example', address: 'Colombo 10', notes: 'Exercise books and pens – weekly delivery.' },
  { id: 's4', name: 'Stationery World Lanka', contact: 'Mr. Imran', phone: '011 244 9090', email: 'info@stationeryworld.example', address: 'Pettah, Colombo 11', notes: 'Pens, school supplies, geometry sets.' },
  { id: 's5', name: 'Educational Publications Dept.', contact: 'Records Office', phone: '011 288 5000', email: 'epd@example.gov.lk', address: 'Isurupaya, Battaramulla', notes: 'Cash on delivery.' },
  { id: 's6', name: 'Vijitha Yapa Distributors', contact: 'Ms. Shanika', phone: '011 271 5500', email: 'trade@vijithayapa.example', address: 'Colombo 05', notes: 'English books and international titles.' },
  { id: 's7', name: 'Art & Craft Lanka', contact: 'Mr. Dhanushka', phone: '011 268 3434', email: 'sales@artcraft.example', address: 'Maradana', notes: 'Art & craft supplies.' },
  { id: 's8', name: 'Office Mart Colombo', contact: 'Ms. Rashmi', phone: '011 230 6767', email: 'orders@officemart.example', address: 'Fort, Colombo 01', notes: 'Office supplies, paper, calculators.' },
]

const catSupplier: Record<string, string> = {
  'School Textbooks': 's2',
  'Novels & Literature': 's1',
  "Children's Books": 's6',
  Religious: 's1',
  'Reference & Dictionaries': 's1',
  'Exercise Books': 's3',
  'Pens & Pencils': 's4',
  'School Supplies': 's4',
  'Art Supplies': 's7',
  'Office Supplies': 's8',
}

interface Extra {
  grade?: string
  subject?: string
  lang?: string
  year?: number
  edition?: string
  unit?: string
  binding?: string
  size?: string
  colour?: string
  fmt?: string
  mfr?: boolean // has manufacturer barcode
  pop?: number // popularity weight in generated sales
}
type Row = [ProductType, string, string, string, string, number, number, number, string, Extra?]
// [type, category, title, author/brand, publisher, price, qty(target), minStock, location, extras]

const ROWS: Row[] = [
  // ---- School textbooks & guides
  ['school', 'School Textbooks', 'Mathematics Grade 10 – Guide Book', 'Sarasavi Editorial', 'Sarasavi Publishers', 1250, 34, 10, 'A-01', { grade: 'Grade 10', subject: 'Mathematics', lang: 'Sinhala', year: 2025, pop: 5 }],
  ['school', 'School Textbooks', 'Science Grade 9 – Revision Guide', 'Sarasavi Editorial', 'Sarasavi Publishers', 1100, 28, 10, 'A-01', { grade: 'Grade 9', subject: 'Science', lang: 'Sinhala', year: 2025, pop: 4 }],
  ['school', 'School Textbooks', 'O/L Past Papers – Mathematics (2015–2024)', 'Examination Team', 'Godage International', 1450, 22, 8, 'A-01', { grade: 'Grade 11', subject: 'Mathematics', lang: 'English', year: 2025, pop: 4 }],
  ['school', 'School Textbooks', 'O/L Past Papers – Science (2015–2024)', 'Examination Team', 'Godage International', 1450, 6, 8, 'A-01', { grade: 'Grade 11', subject: 'Science', lang: 'English', year: 2025, pop: 3 }],
  ['school', 'School Textbooks', 'A/L Combined Mathematics Part I', 'Dr. R. Wijeratne', 'M.D. Gunasena', 2850, 14, 5, 'A-02', { grade: 'Grade 12', subject: 'Combined Maths', lang: 'English', year: 2024, pop: 2 }],
  ['school', 'School Textbooks', 'A/L Biology Part II', 'Dr. S. Amarasinghe', 'M.D. Gunasena', 2650, 11, 5, 'A-02', { grade: 'Grade 13', subject: 'Biology', lang: 'English', year: 2024, pop: 2 }],
  ['school', 'School Textbooks', 'Grade 5 Scholarship Exam – Model Papers', 'Teachers Panel', 'Sarasavi Publishers', 890, 48, 15, 'A-01', { grade: 'Grade 5', subject: 'Scholarship', lang: 'Sinhala', year: 2025, pop: 5 }],
  ['school', 'School Textbooks', 'English Grammar Workbook – Grade 8', 'M. Perera', 'Godage International', 780, 25, 8, 'A-01', { grade: 'Grade 8', subject: 'English', lang: 'English', year: 2025, pop: 3 }],
  ['school', 'School Textbooks', 'Sinhala Language Workbook – Grade 7', 'K. Dissanayake', 'Educational Publications Dept.', 520, 30, 10, 'A-01', { grade: 'Grade 7', subject: 'Sinhala', lang: 'Sinhala', year: 2025, pop: 3 }],
  ['school', 'School Textbooks', 'History Grade 11 – Study Notes', 'S. Ranasinghe', 'Sarasavi Publishers', 950, 18, 6, 'A-01', { grade: 'Grade 11', subject: 'History', lang: 'Sinhala', year: 2025, pop: 2 }],
  ['school', 'School Textbooks', 'ICT Grade 10 – Practical Guide', 'N. Fernando', 'Godage International', 1150, 3, 6, 'A-01', { grade: 'Grade 10', subject: 'ICT', lang: 'English', year: 2025, pop: 2 }],
  ['school', 'School Textbooks', 'Grade 1 Activity Book (Sinhala medium)', 'Educational Publications Dept.', 'Educational Publications Dept.', 380, 60, 20, 'A-01', { grade: 'Grade 1', subject: 'Activity', lang: 'Sinhala', year: 2025, pop: 4 }],
  // ---- Novels & literature
  ['book', 'Novels & Literature', 'Gamperaliya (ගම්පෙරළිය)', 'Martin Wickramasinghe', 'M.D. Gunasena', 890, 24, 6, 'B-01', { lang: 'Sinhala', year: 2022, edition: '15th', binding: 'Paperback', pop: 3 }],
  ['book', 'Novels & Literature', 'Madol Doova (මඩොල් දූව)', 'Martin Wickramasinghe', 'M.D. Gunasena', 650, 31, 6, 'B-01', { lang: 'Sinhala', year: 2021, binding: 'Paperback', pop: 3 }],
  ['book', 'Novels & Literature', 'Viragaya (විරාගය)', 'Martin Wickramasinghe', 'M.D. Gunasena', 780, 17, 6, 'B-01', { lang: 'Sinhala', year: 2022, binding: 'Paperback', pop: 2 }],
  ['book', 'Novels & Literature', 'Kaliyugaya (කලියුගය)', 'Martin Wickramasinghe', 'M.D. Gunasena', 720, 4, 6, 'B-01', { lang: 'Sinhala', year: 2020, binding: 'Paperback', pop: 2 }],
  ['book', 'Novels & Literature', 'The Alchemist', 'Paulo Coelho', 'Penguin Random House', 2450, 12, 4, 'B-02', { lang: 'English', year: 2023, binding: 'Paperback', pop: 2 }],
  ['book', 'Novels & Literature', 'Harry Potter and the Philosopher’s Stone', 'J.K. Rowling', 'Bloomsbury', 3650, 9, 4, 'B-02', { lang: 'English', year: 2022, binding: 'Paperback', pop: 2 }],
  ['book', 'Novels & Literature', 'To Kill a Mockingbird', 'Harper Lee', 'Penguin Random House', 2850, 7, 3, 'B-02', { lang: 'English', year: 2021, binding: 'Paperback', pop: 1 }],
  ['book', 'Novels & Literature', 'Nineteen Eighty-Four', 'George Orwell', 'Penguin Random House', 2250, 8, 3, 'B-02', { lang: 'English', year: 2021, binding: 'Paperback', pop: 1 }],
  ['book', 'Novels & Literature', 'Atomic Habits', 'James Clear', 'Penguin Random House', 4250, 10, 4, 'B-03', { lang: 'English', year: 2023, binding: 'Paperback', pop: 2 }],
  ['book', 'Novels & Literature', 'Rich Dad Poor Dad', 'Robert T. Kiyosaki', 'Penguin Random House', 3150, 0, 4, 'B-03', { lang: 'English', year: 2022, binding: 'Paperback', pop: 2 }],
  ['book', 'Novels & Literature', 'Wings of Fire', 'A.P.J. Abdul Kalam', 'Penguin Random House', 1950, 13, 4, 'B-03', { lang: 'English', year: 2020, binding: 'Paperback', pop: 1 }],
  // ---- Children's
  ['book', "Children's Books", 'Aesop’s Fables – Illustrated', 'Aesop', 'Vijitha Yapa Publications', 950, 20, 6, 'C-01', { lang: 'English', binding: 'Hardcover', pop: 2 }],
  ['book', "Children's Books", 'Jataka Tales for Children (Sinhala)', 'Various', 'Sarasavi Publishers', 650, 26, 6, 'C-01', { lang: 'Sinhala', binding: 'Paperback', pop: 2 }],
  ['book', "Children's Books", 'Grimm’s Fairy Tales', 'Brothers Grimm', 'Vijitha Yapa Publications', 1250, 9, 4, 'C-01', { lang: 'English', binding: 'Hardcover', pop: 1 }],
  ['book', "Children's Books", 'My First Picture Dictionary', 'Oxford Editors', 'Oxford University Press', 1650, 15, 5, 'C-02', { lang: 'English', binding: 'Hardcover', pop: 2 }],
  ['book', "Children's Books", 'Colouring Book – Animals (A4)', 'Art Kids', 'Vijitha Yapa Publications', 350, 40, 10, 'C-02', { lang: 'English', binding: 'Paperback', pop: 3 }],
  // ---- Religious
  ['book', 'Religious', 'Dhammapada (Sinhala translation)', 'Ven. Narada Thera', 'M.D. Gunasena', 480, 22, 5, 'C-02', { lang: 'Sinhala', binding: 'Paperback', pop: 1 }],
  ['book', 'Religious', 'Bhagavad Gita (English)', 'Swami Prabhupada', 'Penguin Random House', 1250, 8, 3, 'C-02', { lang: 'English', binding: 'Paperback', pop: 1 }],
  ['book', 'Religious', 'Holy Bible – Sinhala (Pocket)', 'Bible Society', 'Bible Society of Sri Lanka', 1850, 6, 3, 'C-02', { lang: 'Sinhala', binding: 'Hardcover', pop: 1 }],
  // ---- Reference
  ['book', 'Reference & Dictionaries', 'English–Sinhala Dictionary', 'Gunasena Editorial', 'M.D. Gunasena', 2650, 12, 4, 'B-03', { lang: 'Bilingual', binding: 'Hardcover', pop: 2 }],
  ['book', 'Reference & Dictionaries', 'Oxford Advanced Learner’s Dictionary', 'Oxford Editors', 'Oxford University Press', 5850, 5, 3, 'B-03', { lang: 'English', binding: 'Paperback', edition: '10th', pop: 1 }],
  ['book', 'Reference & Dictionaries', 'Atlas of Sri Lanka', 'Survey Department', 'Vijitha Yapa Publications', 1850, 9, 3, 'B-03', { lang: 'English', binding: 'Paperback', pop: 1 }],
  // ---- Exercise books
  ['stationery', 'Exercise Books', 'CR Book – 80 Pages (Atlas)', 'Atlas', '', 135, 220, 60, 'S-1', { unit: 'pcs', size: 'A5', pop: 12 }],
  ['stationery', 'Exercise Books', 'CR Book – 120 Pages (Atlas)', 'Atlas', '', 195, 160, 50, 'S-1', { unit: 'pcs', size: 'A5', pop: 9 }],
  ['stationery', 'Exercise Books', 'CR Book – 200 Pages (Atlas)', 'Atlas', '', 310, 90, 30, 'S-1', { unit: 'pcs', size: 'A5', pop: 6 }],
  ['stationery', 'Exercise Books', 'Single Ruled Book – 40 Pages', 'Atlas', '', 65, 300, 80, 'S-1', { unit: 'pcs', size: 'A5', pop: 10 }],
  ['stationery', 'Exercise Books', 'Square Ruled Book – 80 Pages', 'Atlas', '', 150, 75, 30, 'S-1', { unit: 'pcs', size: 'A5', pop: 5 }],
  ['stationery', 'Exercise Books', 'Drawing Book – 40 Pages', 'Atlas', '', 120, 85, 30, 'S-1', { unit: 'pcs', size: 'A4', pop: 5 }],
  ['stationery', 'Exercise Books', 'A4 Note Book – 200 Pages Hardcover', 'Atlas', '', 560, 42, 15, 'S-1', { unit: 'pcs', size: 'A4', pop: 3 }],
  ['stationery', 'Exercise Books', 'Graph Book – 40 Pages', 'Atlas', '', 110, 8, 25, 'S-1', { unit: 'pcs', size: 'A4', pop: 3 }],
  // ---- Pens & pencils
  ['stationery', 'Pens & Pencils', 'Atlas Chooty Pen – Blue', 'Atlas', '', 35, 400, 100, 'S-2', { unit: 'pcs', pop: 14 }],
  ['stationery', 'Pens & Pencils', 'Atlas Chooty Pen – Black', 'Atlas', '', 35, 320, 100, 'S-2', { unit: 'pcs', pop: 10 }],
  ['stationery', 'Pens & Pencils', 'Pilot G-2 Gel Pen 0.7mm – Blue', 'Pilot', '', 280, 55, 20, 'S-2', { unit: 'pcs', mfr: true, pop: 4 }],
  ['stationery', 'Pens & Pencils', 'Pilot V5 Hi-Tecpoint', 'Pilot', '', 260, 38, 15, 'S-2', { unit: 'pcs', mfr: true, pop: 3 }],
  ['stationery', 'Pens & Pencils', 'Pelikan Fountain Pen (School)', 'Pelikan', '', 1450, 14, 5, 'S-2', { unit: 'pcs', mfr: true, pop: 1 }],
  ['stationery', 'Pens & Pencils', 'Pencil 2B (Pack of 12)', 'Atlas', '', 360, 70, 20, 'S-2', { unit: 'pack', pop: 6 }],
  ['stationery', 'Pens & Pencils', 'Staedtler HB Pencils (Box of 12)', 'Staedtler', '', 780, 26, 10, 'S-2', { unit: 'box', mfr: true, pop: 3 }],
  ['stationery', 'Pens & Pencils', 'Eraser – Faber-Castell Dust-Free', 'Faber-Castell', '', 60, 120, 40, 'S-2', { unit: 'pcs', mfr: true, pop: 7 }],
  ['stationery', 'Pens & Pencils', 'Sharpener – Maped Double Hole', 'Maped', '', 85, 90, 30, 'S-2', { unit: 'pcs', mfr: true, pop: 5 }],
  ['stationery', 'Pens & Pencils', 'Stabilo Boss Highlighter (Set of 4)', 'Stabilo', '', 1150, 17, 6, 'S-2', { unit: 'set', mfr: true, pop: 2 }],
  ['stationery', 'Pens & Pencils', 'Whiteboard Marker – Black', 'Camlin', '', 150, 45, 15, 'S-2', { unit: 'pcs', pop: 2 }],
  // ---- School supplies
  ['school', 'School Supplies', 'Geometry Box (Camlin)', 'Camlin', '', 750, 32, 10, 'S-3', { unit: 'set', pop: 4 }],
  ['school', 'School Supplies', 'Scientific Calculator Casio fx-82', 'Casio', '', 5250, 9, 4, 'S-3', { unit: 'pcs', mfr: true, pop: 2 }],
  ['school', 'School Supplies', 'Scientific Calculator Casio fx-991', 'Casio', '', 8950, 5, 3, 'S-3', { unit: 'pcs', mfr: true, pop: 1 }],
  ['school', 'School Supplies', 'School Bag 18" (Navy)', 'Generic', '', 3950, 12, 4, 'S-3', { unit: 'pcs', colour: 'Navy', pop: 1 }],
  ['school', 'School Supplies', 'Water Bottle 750ml', 'Generic', '', 650, 28, 8, 'S-3', { unit: 'pcs', pop: 2 }],
  ['school', 'School Supplies', 'Lunch Box – 2 Compartment', 'Generic', '', 780, 19, 6, 'S-3', { unit: 'pcs', pop: 2 }],
  ['school', 'School Supplies', 'Book Wrapping Plastic Roll (10m)', 'Generic', '', 420, 44, 15, 'S-3', { unit: 'roll', pop: 5 }],
  ['school', 'School Supplies', 'Ruler 30cm – Transparent', 'Maped', '', 90, 110, 30, 'S-2', { unit: 'pcs', pop: 6 }],
  ['school', 'School Supplies', 'Glue Stick 21g', 'UHU', '', 190, 60, 20, 'S-2', { unit: 'pcs', mfr: true, pop: 4 }],
  ['school', 'School Supplies', 'Scissors – Student', 'Kangaro', '', 210, 36, 12, 'S-3', { unit: 'pcs', pop: 3 }],
  // ---- Art
  ['art', 'Art Supplies', 'Colour Pencils 12 – Faber-Castell', 'Faber-Castell', '', 980, 30, 10, 'S-3', { unit: 'set', mfr: true, pop: 4 }],
  ['art', 'Art Supplies', 'Crayons 24 Shades – Camlin', 'Camlin', '', 520, 34, 10, 'S-3', { unit: 'set', pop: 4 }],
  ['art', 'Art Supplies', 'Water Colour Set 12 Tubes', 'Camlin', '', 690, 21, 8, 'S-3', { unit: 'set', pop: 3 }],
  ['art', 'Art Supplies', 'Sketch Pad A4 – 30 Sheets', 'Atlas', '', 450, 25, 8, 'S-3', { unit: 'pcs', size: 'A4', pop: 3 }],
  ['art', 'Art Supplies', 'Paint Brush Set (Pack of 6)', 'Camlin', '', 380, 0, 8, 'S-3', { unit: 'set', pop: 2 }],
  ['art', 'Art Supplies', 'Acrylic Colour Set – 12 Colours', 'Camlin', '', 1850, 10, 4, 'S-3', { unit: 'set', pop: 1 }],
  // ---- Office
  ['office', 'Office Supplies', 'A4 Paper 80gsm – 500 Sheets', 'Double A', '', 1950, 40, 12, 'O-1', { unit: 'ream', mfr: true, pop: 4 }],
  ['office', 'Office Supplies', 'Box File – A4 (Black)', 'Generic', '', 520, 24, 8, 'O-1', { unit: 'pcs', pop: 2 }],
  ['office', 'Office Supplies', 'Stapler No.10 – Kangaro', 'Kangaro', '', 480, 20, 6, 'O-1', { unit: 'pcs', mfr: true, pop: 2 }],
  ['office', 'Office Supplies', 'Staples Pins No.10 (Box)', 'Kangaro', '', 90, 80, 20, 'O-1', { unit: 'box', mfr: true, pop: 3 }],
  ['office', 'Office Supplies', 'Sticky Notes 3×3 (Pack of 5)', '3M', '', 690, 18, 6, 'O-2', { unit: 'pack', mfr: true, pop: 2 }],
  ['office', 'Office Supplies', 'Correction Tape', 'Pilot', '', 240, 34, 10, 'O-2', { unit: 'pcs', mfr: true, pop: 3 }],
  ['office', 'Office Supplies', 'Clear File A4 (Pack of 10)', 'Generic', '', 380, 32, 10, 'O-2', { unit: 'pack', pop: 3 }],
  ['office', 'Office Supplies', 'Masking Tape 1"', 'Generic', '', 160, 48, 12, 'O-2', { unit: 'roll', pop: 2 }],
  ['office', 'Office Supplies', 'Paper Clips – Box of 100', 'Generic', '', 75, 66, 20, 'O-2', { unit: 'box', pop: 2 }],
  ['office', 'Office Supplies', 'Display Book 20 Pockets', 'Generic', '', 420, 15, 6, 'O-2', { unit: 'pcs', pop: 2 }],
]

export interface SeedBundle {
  products: Product[]
  users: User[]
  suppliers: Supplier[]
  customers: Customer[]
  sales: Sale[]
  returns: SaleReturn[]
  purchaseOrders: PurchaseOrder[]
  movements: StockMovement[]
  expenses: Expense[]
  shifts: Shift[]
  quotations: Quotation[]
  reservations: Reservation[]
  specialOrders: SpecialOrder[]
  schoolLists: SchoolList[]
  bundles: Bundle[]
  audit: AuditEntry[]
  settings: Settings
}

export function buildSeed(): SeedBundle {
  const rnd = mulberry32(20261120)
  const ri = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
  const now = new Date()
  const today = startOfDay(now)
  const settings = defaultSettings()
  const users = seedUsers()
  const suppliers = seedSuppliers()

  /* ----- products ----- */
  let internalSeq = 1
  const products: Product[] = ROWS.map((r, i) => {
    const [type, category, title, by, publisher, price, qty, minStock, location, ex = {}] = r
    const isBookish = type === 'book' || (type === 'school' && !!ex.grade)
    const isbn = isBookish ? withCheck('978955' + String(100000 + i * 137).slice(0, 6)) : undefined
    const barcode = isbn
      ? isbn
      : ex.mfr
        ? withCheck('890' + String(100000000 + i * 7919).slice(0, 9))
        : internalBarcode(internalSeq++)
    const margin = isBookish ? 0.22 + (rnd() - 0.5) * 0.06 : type === 'office' || type === 'art' ? 0.28 + (rnd() - 0.5) * 0.08 : 0.3 + (rnd() - 0.5) * 0.1
    const cost = Math.round((price * (1 - margin)) / 5) * 5
    const prefix = { book: 'BK', school: 'SC', stationery: 'ST', art: 'AR', office: 'OF' }[type]
    return {
      id: `p${i + 1}`,
      code: `${prefix}-${String(i + 1).padStart(4, '0')}`,
      barcode,
      isbn,
      title,
      author: isBookish ? by : undefined,
      publisher: isBookish ? publisher : undefined,
      edition: ex.edition,
      language: ex.lang,
      year: ex.year,
      type,
      category,
      grade: ex.grade,
      subject: ex.subject,
      brand: !isBookish ? by : undefined,
      binding: ex.binding,
      size: ex.size,
      colour: ex.colour,
      unit: ex.unit ?? 'pcs',
      cost,
      price,
      wholesale: Math.round((price * 0.92) / 5) * 5,
      minPrice: Math.round((cost * 1.05) / 5) * 5,
      supplierId: catSupplier[category],
      supplierCode: `${catSupplier[category].toUpperCase()}-${1000 + i}`,
      location,
      qty,
      reserved: 0,
      minStock,
      status: 'active',
      createdAt: addDays(today, -90).toISOString(),
      hue: (category.length * 47 + i * 29) % 360,
    }
  })
  // a couple of special statuses for demo
  const byTitle = (s: string) => products.find((p) => p.title.startsWith(s))!
  byTitle('Kaliyugaya').status = 'active'
  byTitle('Graph Book').qty = 8

  const popWeight = (p: Product) => ROWS[Number(p.id.slice(1)) - 1][9]?.pop ?? 1
  const weights = products.map((p) => popWeight(p) + 0.2)
  const totalW = weights.reduce((a, b) => a + b, 0)
  const pickProduct = () => {
    let x = rnd() * totalW
    for (let i = 0; i < products.length; i++) {
      x -= weights[i]
      if (x <= 0) return products[i]
    }
    return products[0]
  }

  /* ----- customers ----- */
  const cust = (
    n: number,
    name: string,
    phone: string,
    group: Customer['group'],
    extra: Partial<Customer> = {},
  ): Customer => ({
    id: `c${n}`,
    code: `CUS-${String(n).padStart(4, '0')}`,
    name,
    phone,
    group,
    discountPct: group === 'School' ? 5 : group === 'Wholesale' ? 8 : group === 'Teacher' ? 5 : 0,
    points: 0,
    balance: 0,
    deposit: 0,
    creditLimit: group === 'School' || group === 'Wholesale' ? 50000 : 0,
    contactPref: 'WhatsApp',
    createdAt: addDays(today, -ri(20, 80)).toISOString(),
    ...extra,
  })
  const customers: Customer[] = [
    cust(1, 'Hanwella Central College', '036 222 5001', 'School', { address: 'Hanwella', email: 'office@hanwellacc.example', contactPref: 'Phone', notes: 'Monthly stationery order. Invoice to Principal.' }),
    cust(2, 'St. Mary’s Junior School', '036 222 7788', 'School', { address: 'Avissawella Rd, Hanwella', contactPref: 'Phone' }),
    cust(3, 'Mrs. Kumari Rathnayake', '077 345 6677', 'Teacher', { notes: 'Primary teacher – buys activity books in bulk.' }),
    cust(4, 'Mr. Saman Kumara', '071 889 1122', 'Regular'),
    cust(5, 'Dilshan Madushanka', '076 556 3344', 'Student', { contactPref: 'SMS' }),
    cust(6, 'Ishara Weerasinghe', '070 998 1212', 'Student'),
    cust(7, 'Lanka Traders (Pvt) Ltd', '011 234 5566', 'Wholesale', { address: 'Kaduwela', email: 'accounts@lankatraders.example', contactPref: 'Email' }),
    cust(8, 'Mr. Nuwan Bandara', '075 665 4433', 'Regular'),
    cust(9, 'Mrs. Chathurika Silva', '072 311 2299', 'Teacher'),
    cust(10, 'Dr. Prasanna Jayawardena', '077 778 9900', 'Regular', { notes: 'Collects medical/science reference titles.' }),
    cust(11, 'Thilini Hettiarachchi', '078 222 4545', 'Student'),
    cust(12, 'Pre-School Rainbow Kids', '036 223 4141', 'School', { contactPref: 'Phone' }),
  ]
  const custById = Object.fromEntries(customers.map((c) => [c.id, c]))

  /* ----- purchase orders ----- */
  const movements: StockMovement[] = []
  let movSeq = 1
  const mov = (m: Omit<StockMovement, 'id'>) => movements.push({ id: `m${movSeq++}`, ...m })

  const purchaseOrders: PurchaseOrder[] = []
  let poSeq = 1
  suppliers.forEach((s) => {
    const sp = products.filter((p) => p.supplierId === s.id)
    if (!sp.length) return
    const plan: { off: number; status: PurchaseOrder['status']; payRatio: number }[] = [
      { off: 60, status: 'received', payRatio: 1 },
      { off: 28, status: 'received', payRatio: rnd() > 0.4 ? 0.5 : 0 },
      { off: ri(2, 7), status: pick(['ordered', 'partial', 'ordered'] as const), payRatio: 0 },
    ]
    plan.forEach((pl, k) => {
      const lines = [...sp]
        .sort(() => rnd() - 0.5)
        .slice(0, Math.min(sp.length, ri(4, 8)))
        .map((p) => {
          const qty = p.price < 200 ? ri(60, 200) : p.price < 1000 ? ri(15, 60) : ri(5, 25)
          return {
            productId: p.id,
            qty,
            received: pl.status === 'received' ? qty : pl.status === 'partial' ? Math.floor(qty / 2) : 0,
            unitCost: p.cost,
            discount: 0,
          }
        })
      const date = addDays(today, -pl.off)
      const sub = lines.reduce((a, l) => a + l.qty * l.unitCost, 0)
      const charges = k === 0 ? 0 : ri(0, 2) * 500
      const total = sub + charges
      const po: PurchaseOrder = {
        id: `po${poSeq}`,
        no: `PO-${String(1000 + poSeq).slice(0)}`,
        supplierId: s.id,
        date: date.toISOString(),
        invoiceNo: pl.status === 'ordered' ? undefined : `INV-${s.id.toUpperCase()}-${ri(1000, 9999)}`,
        dueDate: addDays(date, 30).toISOString(),
        lines,
        charges,
        discount: 0,
        status: pl.status,
        payments: [],
        returns: [],
        createdBy: 'u6',
      }
      if (pl.payRatio > 0) {
        po.payments.push({ id: `sp${poSeq}`, date: addDays(date, 3).toISOString(), amount: Math.round((total * pl.payRatio) / 10) * 10, method: pick(['bank', 'cash'] as const), ref: pl.payRatio === 1 ? 'Cheque 004512' : undefined })
      }
      purchaseOrders.push(po)
      lines.forEach((l) => {
        if (l.received > 0) mov({ date: addDays(date, 2).toISOString(), productId: l.productId, type: 'purchase', qty: l.received, ref: po.no, userId: 'u6' })
      })
      poSeq++
    })
  })
  // an old, unpaid PO that is overdue (for payables demo)
  const overdue = purchaseOrders.find((p) => p.supplierId === 's4' && p.status === 'received')!
  overdue.payments = []
  overdue.dueDate = addDays(today, -6).toISOString()
  // supplier return example
  const retPo = purchaseOrders.find((p) => p.supplierId === 's2' && p.status === 'received')!
  retPo.returns.push({ id: 'sr1', date: addDays(today, -20).toISOString(), productId: retPo.lines[0].productId, qty: 2, amount: retPo.lines[0].unitCost * 2, reason: 'Damaged covers on delivery' })
  mov({ date: addDays(today, -20).toISOString(), productId: retPo.lines[0].productId, type: 'supplier_return', qty: -2, ref: retPo.no, userId: 'u6', reason: 'Damaged covers on delivery' })

  /* ----- shifts / sales history ----- */
  const sales: Sale[] = []
  const shifts: Shift[] = []
  let saleNo = 1
  const DAYS = 45
  const methodsPick = (): PayMethod => {
    const x = rnd()
    return x < 0.7 ? 'cash' : x < 0.84 ? 'card' : x < 0.94 ? 'qr' : 'bank'
  }
  for (let d = DAYS; d >= 0; d--) {
    const day = addDays(today, -d)
    const dow = day.getDay()
    const isToday = d === 0
    const cashier = isToday ? 'u3' : d % 2 === 0 ? 'u3' : 'u4'
    const base = dow === 0 ? ri(9, 14) : dow === 6 ? ri(26, 36) : ri(17, 26)
    const monthBoost = day.getDate() <= 5 ? 1.25 : 1
    let n = Math.round(base * monthBoost)
    const endHour = isToday ? Math.max(9, now.getHours()) : 19
    if (isToday) n = Math.max(4, Math.round((n * (endHour - 8)) / 11))
    const shiftId = `sh${DAYS - d + 1}`
    const openedAt = new Date(day)
    openedAt.setHours(8, 30, 0, 0)
    const shift: Shift = { id: shiftId, cashierId: cashier, openedAt: openedAt.toISOString(), openingCash: 5000 }
    let cashIn = 0

    const times = Array.from({ length: n }, () => {
      const h = ri(9, Math.max(9, endHour - (isToday ? 1 : 0)))
      const t = new Date(day)
      t.setHours(h, ri(0, 59), ri(0, 59), 0)
      return t
    }).sort((a, b) => a.getTime() - b.getTime())

    times.forEach((t) => {
      if (isToday && t > now) return
      const nLines = rnd() < 0.22 ? 1 : rnd() < 0.5 ? 2 : rnd() < 0.78 ? 3 : ri(4, 7)
      const lines: SaleLine[] = []
      const used = new Set<string>()
      for (let k = 0; k < nLines; k++) {
        const p = pickProduct()
        if (used.has(p.id)) continue
        used.add(p.id)
        const qty = p.price < 200 ? ri(1, 8) : p.price < 800 ? ri(1, 4) : rnd() < 0.2 ? 2 : 1
        lines.push({ productId: p.id, title: p.title, code: p.code, barcode: p.barcode, qty, price: p.price, cost: p.cost, discount: 0 })
      }
      const subtotal = lines.reduce((a, l) => a + l.qty * l.price, 0)
      const cid = rnd() < 0.28 ? pick(customers).id : undefined
      const cu = cid ? custById[cid] : undefined
      let discount = 0
      if (cu && cu.discountPct) discount = round2((subtotal * cu.discountPct) / 100)
      else if (rnd() < 0.07) discount = Math.round(subtotal * 0.05)
      const total = round2(subtotal - discount)
      let payments: { method: PayMethod; amount: number; ref?: string }[] = []
      let change = 0
      const roll = rnd()
      if (cu && cu.creditLimit && rnd() < 0.3 && total > 2000) {
        const part = Math.round((total * 0.4) / 10) * 10
        payments = [{ method: 'cash', amount: part }]
        cu.balance += total - part
      } else if (roll < 0.12 && total > 1500) {
        const cashPart = Math.round(total / 2 / 10) * 10
        payments = [
          { method: 'cash', amount: cashPart },
          { method: 'card', amount: round2(total - cashPart), ref: `****${ri(1000, 9999)}` },
        ]
      } else {
        const m = methodsPick()
        payments = [{ method: m, amount: total, ref: m === 'cash' ? undefined : m === 'card' ? `****${ri(1000, 9999)}` : `REF${ri(100000, 999999)}` }]
        if (m === 'cash') change = Math.ceil(total / 100) * 100 - total > 0 && rnd() < 0.6 ? Math.ceil(total / 100) * 100 - total : 0
      }
      const paid = round2(payments.reduce((a, p) => a + p.amount, 0))
      cashIn += payments.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0)
      const sale: Sale = {
        id: `sale${saleNo}`,
        no: `${settings.receipt.prefix}${String(saleNo).padStart(6, '0')}`,
        date: t.toISOString(),
        cashierId: cashier,
        customerId: cid,
        customerName: cu?.name,
        lines,
        subtotal,
        discount,
        tax: 0,
        total,
        payments,
        paid,
        change,
        balance: round2(total - paid),
        status: 'completed',
        shiftId,
        approvedBy: discount > 0 && !cu?.discountPct ? 'u2' : undefined,
      }
      sales.push(sale)
      lines.forEach((l) => mov({ date: t.toISOString(), productId: l.productId, type: 'sale', qty: -l.qty, ref: sale.no, userId: cashier }))
      if (cu) cu.points += Math.floor(total / settings.pos.pointsPerLkr)
      saleNo++
    })

    if (!isToday) {
      const closed = new Date(day)
      closed.setHours(19, 40, 0, 0)
      const dayExpenses = 0
      shift.closedAt = closed.toISOString()
      shift.expectedCash = shift.openingCash + cashIn - dayExpenses
      const diff = rnd() < 0.7 ? 0 : pick([-50, -20, 20, 100, -100, 10])
      shift.countedCash = shift.expectedCash + diff
      shift.difference = diff
    }
    shifts.push(shift)
  }
  settings.receipt.nextNo = saleNo

  // a voided sale
  const voided = sales[sales.length - 12]
  voided.status = 'voided'
  voided.voidReason = 'Customer changed mind – wrong items scanned'
  voided.voidedBy = 'u2'
  voided.lines.forEach((l) => mov({ date: voided.date, productId: l.productId, type: 'void', qty: l.qty, ref: voided.no, userId: 'u2', reason: 'Void' }))

  /* ----- returns ----- */
  const returns: SaleReturn[] = []
  ;[sales.length - 40, sales.length - 25, sales.length - 8].forEach((idx, k) => {
    const s = sales[idx]
    if (!s || s.status !== 'completed') return
    const line = s.lines[0]
    const damaged = k === 1
    const amount = round2(line.price * 1 - (s.discount * (line.price / s.subtotal)))
    line.returnedQty = 1
    s.status = s.lines.length === 1 && line.qty === 1 ? 'refunded' : 'partial_return'
    const date = new Date(new Date(s.date).getTime() + 3600_000 * 26)
    returns.push({
      id: `ret${k + 1}`,
      no: `RET-${String(k + 1).padStart(5, '0')}`,
      saleId: s.id,
      saleNo: s.no,
      date: date.toISOString(),
      lines: [{ productId: line.productId, title: line.title, qty: 1, amount, condition: damaged ? 'Damaged' : 'Good', restock: !damaged }],
      amount,
      type: 'refund',
      method: 'cash',
      reason: damaged ? 'Pages torn – manufacturing defect' : 'Wrong edition purchased',
      staffId: 'u3',
      approvedBy: 'u2',
    })
    if (!damaged) mov({ date: date.toISOString(), productId: line.productId, type: 'return', qty: 1, ref: `RET-${String(k + 1).padStart(5, '0')}`, userId: 'u3', reason: 'Wrong edition purchased' })
    else mov({ date: date.toISOString(), productId: line.productId, type: 'damage', qty: 0, ref: `RET-${String(k + 1).padStart(5, '0')}`, userId: 'u3', reason: 'Returned damaged – not restocked' })
  })
  // a few manual adjustments
  const p1 = products[3]
  mov({ date: addDays(today, -9).toISOString(), productId: p1.id, type: 'damage', qty: -2, userId: 'u5', reason: 'Water damage on bottom shelf', ref: 'ADJ-0001' })
  const p2 = products[44]
  mov({ date: addDays(today, -4).toISOString(), productId: p2.id, type: 'adjustment', qty: 3, userId: 'u5', reason: 'Stock-take correction', ref: 'ADJ-0002' })

  /* ----- stock opening so that current qty = target ----- */
  const sumMov: Record<string, number> = {}
  movements.forEach((m) => (sumMov[m.productId] = (sumMov[m.productId] ?? 0) + m.qty))
  products.forEach((p) => {
    const opening = Math.max(0, p.qty - (sumMov[p.id] ?? 0))
    p.qty = opening + (sumMov[p.id] ?? 0)
    movements.push({ id: `m${movSeq++}`, date: addDays(today, -90).toISOString(), productId: p.id, type: 'opening', qty: opening, userId: 'u5', reason: 'Opening stock', ref: 'OPEN' })
  })
  movements.sort((a, b) => a.date.localeCompare(b.date))

  /* ----- today's open shift: expected cash is computed live ----- */

  /* ----- expenses ----- */
  const expenses: Expense[] = []
  let exSeq = 1
  const ex = (date: Date, category: string, amount: number, method: PayMethod, note?: string, recurring: Expense['recurring'] = null) =>
    expenses.push({ id: `ex${exSeq++}`, date: date.toISOString(), category, amount, method, note, recurring, userId: pick(['u1', 'u2']) })
  for (let m = 1; m >= 0; m--) {
    const ref = new Date(today.getFullYear(), today.getMonth() - m, 1)
    const at = (day: number) => new Date(ref.getFullYear(), ref.getMonth(), day, 10)
    const addIf = (day: number, ...args: [string, number, PayMethod, string?, Expense['recurring']?]) => {
      const dt = at(day)
      if (dt <= now) ex(dt, ...args)
    }
    addIf(1, 'Rent', 85000, 'bank', 'Shop rent', 'monthly')
    addIf(5, 'Electricity', ri(11000, 14500), 'bank', 'CEB bill')
    addIf(6, 'Water', ri(2000, 2900), 'cash', 'NWSDB bill')
    addIf(7, 'Internet & Telephone', 4900, 'bank', 'Fibre + shop phone', 'monthly')
    addIf(28, 'Salaries & Wages', 45000, 'bank', 'Cashier – Kasun', 'monthly')
    addIf(28, 'Salaries & Wages', 45000, 'bank', 'Cashier – Sanduni', 'monthly')
    addIf(28, 'Salaries & Wages', 55000, 'bank', 'Stock clerk – Ruwan', 'monthly')
  }
  for (let d = 40; d >= 0; d -= ri(2, 4)) {
    const dt = addDays(today, -d)
    dt.setHours(11, ri(0, 59))
    if (dt > now) continue
    const cat = pick(['Transport & Delivery', 'Packaging', 'Cleaning', 'Maintenance', 'Other'])
    ex(dt, cat, cat === 'Packaging' ? ri(800, 2200) : ri(300, 1800), 'cash', cat === 'Transport & Delivery' ? 'Three-wheeler for supplier pickup' : cat === 'Cleaning' ? 'Cleaning supplies' : undefined)
  }
  expenses.sort((a, b) => a.date.localeCompare(b.date))

  /* ----- quotations / reservations / special orders ----- */
  const prodId = (title: string) => products.find((p) => p.title.startsWith(title))!.id
  const quotations: Quotation[] = [
    {
      id: 'q1',
      no: 'QT-0001',
      customerId: 'c1',
      customerName: 'Hanwella Central College',
      phone: '036 222 5001',
      date: addDays(today, -3).toISOString(),
      validUntil: addDays(today, 11).toISOString(),
      lines: [
        { productId: prodId('CR Book – 80'), qty: 400, price: 125 },
        { productId: prodId('Single Ruled'), qty: 300, price: 60 },
        { productId: prodId('A4 Paper'), qty: 20, price: 1890 },
      ],
      discount: 2500,
      status: 'sent',
      note: 'Term 2 stationery for school office & classes.',
    },
    {
      id: 'q2',
      no: 'QT-0002',
      customerName: 'Mrs. Kumari Rathnayake',
      phone: '077 345 6677',
      date: addDays(today, -1).toISOString(),
      validUntil: addDays(today, 6).toISOString(),
      lines: [
        { productId: prodId('Grade 1 Activity'), qty: 30, price: 380 },
        { productId: prodId('Colour Pencils'), qty: 30, price: 980 },
      ],
      discount: 0,
      status: 'draft',
    },
    {
      id: 'q3',
      no: 'QT-0003',
      customerName: 'Lanka Traders (Pvt) Ltd',
      date: addDays(today, -20).toISOString(),
      validUntil: addDays(today, -6).toISOString(),
      lines: [{ productId: prodId('A4 Paper'), qty: 50, price: 1850 }],
      discount: 0,
      status: 'expired',
    },
  ]
  const reservations: Reservation[] = [
    {
      id: 'r1',
      no: 'RS-0001',
      customerName: 'Mr. Saman Kumara',
      phone: '071 889 1122',
      customerId: 'c4',
      date: addDays(today, -2).toISOString(),
      until: addDays(today, 3).toISOString(),
      lines: [{ productId: prodId('Atomic Habits'), qty: 1, price: 4250 }],
      advance: 1000,
      status: 'active',
    },
    {
      id: 'r2',
      no: 'RS-0002',
      customerName: 'Thilini Hettiarachchi',
      customerId: 'c11',
      phone: '078 222 4545',
      date: addDays(today, -6).toISOString(),
      until: addDays(today, -1).toISOString(),
      lines: [{ productId: prodId('Scientific Calculator Casio fx-82'), qty: 1, price: 5250 }],
      advance: 500,
      status: 'active',
      note: 'Overdue – call customer',
    },
    {
      id: 'r3',
      no: 'RS-0003',
      customerName: 'Mrs. Chathurika Silva',
      customerId: 'c9',
      phone: '072 311 2299',
      date: today.toISOString(),
      until: addDays(today, 5).toISOString(),
      lines: [
        { productId: prodId('Grade 5 Scholarship'), qty: 5, price: 890 },
        { productId: prodId('Geometry Box'), qty: 2, price: 750 },
      ],
      advance: 2000,
      status: 'active',
    },
  ]
  reservations.forEach((r) => r.lines.forEach((l) => (products.find((p) => p.id === l.productId)!.reserved += l.qty)))
  const specialOrders: SpecialOrder[] = [
    { id: 'so1', no: 'SO-0001', customerName: 'Dr. Prasanna Jayawardena', phone: '077 778 9900', title: 'Gray’s Anatomy for Students', author: 'Drake, Vogl, Mitchell', isbn: '9780323393041', qty: 1, advance: 5000, expectedDate: addDays(today, 9).toISOString(), status: 'supplier_ordered', supplierId: 's6', date: addDays(today, -4).toISOString() },
    { id: 'so2', no: 'SO-0002', customerName: 'Ishara Weerasinghe', phone: '070 998 1212', title: 'A/L Chemistry Part I (2025 edition)', qty: 2, advance: 0, status: 'requested', supplierId: 's2', date: addDays(today, -1).toISOString(), expectedDate: addDays(today, 7).toISOString() },
    { id: 'so3', no: 'SO-0003', customerName: 'Mr. Nuwan Bandara', phone: '075 665 4433', title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', qty: 1, advance: 1500, status: 'received', supplierId: 's6', date: addDays(today, -12).toISOString(), expectedDate: addDays(today, -2).toISOString() },
    { id: 'so4', no: 'SO-0004', customerName: 'Pre-School Rainbow Kids', phone: '036 223 4141', title: 'Phonics Reader Set (Level 1–3)', qty: 12, advance: 4000, status: 'customer_notified', supplierId: 's6', date: addDays(today, -15).toISOString(), expectedDate: addDays(today, -4).toISOString() },
  ]

  /* ----- school lists & bundles ----- */
  const schoolLists: SchoolList[] = [
    {
      id: 'sl1',
      name: 'Grade 1 – Starter List',
      school: 'Hanwella Central College',
      grade: 'Grade 1',
      lines: [
        { productId: prodId('Grade 1 Activity'), qty: 1 },
        { productId: prodId('Single Ruled'), qty: 6 },
        { productId: prodId('Drawing Book'), qty: 2 },
        { productId: prodId('Pencil 2B'), qty: 1 },
        { productId: prodId('Eraser'), qty: 2 },
        { productId: prodId('Colour Pencils'), qty: 1 },
        { productId: prodId('Book Wrapping'), qty: 1 },
      ],
    },
    {
      id: 'sl2',
      name: 'Grade 6 – Term List',
      school: 'St. Mary’s Junior School',
      grade: 'Grade 6',
      lines: [
        { productId: prodId('CR Book – 120'), qty: 5 },
        { productId: prodId('CR Book – 80'), qty: 5 },
        { productId: prodId('Geometry Box'), qty: 1 },
        { productId: prodId('Atlas Chooty Pen – Blue'), qty: 4 },
        { productId: prodId('Ruler'), qty: 1 },
        { productId: prodId('Glue Stick'), qty: 1 },
      ],
    },
    {
      id: 'sl3',
      name: 'Grade 10 – O/L Preparation',
      school: 'Hanwella Central College',
      grade: 'Grade 10',
      lines: [
        { productId: prodId('Mathematics Grade 10'), qty: 1 },
        { productId: prodId('O/L Past Papers – Mathematics'), qty: 1 },
        { productId: prodId('CR Book – 200'), qty: 4 },
        { productId: prodId('Scientific Calculator Casio fx-82'), qty: 1 },
        { productId: prodId('Graph Book'), qty: 2 },
      ],
    },
  ]
  const bundles: Bundle[] = [
    { id: 'b1', name: 'Back-to-School Starter Pack', price: 1450, lines: [{ productId: prodId('CR Book – 80'), qty: 4 }, { productId: prodId('Atlas Chooty Pen – Blue'), qty: 3 }, { productId: prodId('Pencil 2B'), qty: 1 }, { productId: prodId('Eraser'), qty: 1 }, { productId: prodId('Ruler'), qty: 1 }] },
    { id: 'b2', name: 'Art Class Pack', price: 2250, lines: [{ productId: prodId('Colour Pencils'), qty: 1 }, { productId: prodId('Crayons'), qty: 1 }, { productId: prodId('Sketch Pad'), qty: 1 }, { productId: prodId('Paint Brush'), qty: 1 }] },
    { id: 'b3', name: 'O/L Exam Kit', price: 2250, lines: [{ productId: prodId('Geometry Box'), qty: 1 }, { productId: prodId('Pilot G-2'), qty: 2 }, { productId: prodId('Staedtler HB'), qty: 1 }, { productId: prodId('Eraser'), qty: 2 }, { productId: prodId('Graph Book'), qty: 1 }] },
  ]

  /* ----- audit ----- */
  const audit: AuditEntry[] = []
  const au = (days: number, userId: string, action: string, detail: string, sensitive = false) => {
    const t = addDays(today, -days)
    t.setHours(ri(9, 18), ri(0, 59))
    audit.push({ id: `au${audit.length + 1}`, date: t.toISOString(), userId, action, detail, sensitive })
  }
  au(30, 'u1', 'Settings updated', 'Receipt footer wording changed', true)
  au(26, 'u1', 'User created', 'Created staff account “sanduni” (Cashier)', true)
  au(21, 'u2', 'Price changed', 'Gamperaliya price Rs. 850.00 → Rs. 890.00', true)
  au(15, 'u5', 'Stock adjusted', 'Stock-take correction on Pilot G-2 (+3)', true)
  au(9, 'u5', 'Stock adjusted', 'Marked 2 units as damaged – Science Grade 9 Revision Guide', true)
  au(8, 'u2', 'Discount approved', 'Approved 5% discount for bill above cashier limit', true)
  au(5, 'u6', 'Purchase received', 'Goods received against a supplier purchase order')
  au(2, 'u2', 'Sale voided', `Voided ${voided.no} – wrong items scanned`, true)
  au(1, 'u1', 'Permission changed', 'Granted “View cost prices” to Accountant', true)
  audit.sort((a, b) => b.date.localeCompare(a.date))

  return {
    products,
    users,
    suppliers,
    customers,
    sales,
    returns,
    purchaseOrders,
    movements,
    expenses,
    shifts,
    quotations,
    reservations,
    specialOrders,
    schoolLists,
    bundles,
    audit,
    settings,
  }
}
