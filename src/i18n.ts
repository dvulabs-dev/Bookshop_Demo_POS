import { useStore } from './store/useStore'

// English is the source language. Sinhala strings cover navigation, POS and receipts;
// anything not translated falls back to English. (Wording should be reviewed with the shop's staff.)
const si: Record<string, string> = {
  Dashboard: 'උපකරණ පුවරුව',
  'New Sale': 'නව විකුණුම',
  'POS / Sales': 'විකුණුම් (POS)',
  Products: 'නිෂ්පාදන',
  Stock: 'තොග',
  Purchasing: 'මිලදී ගැනීම්',
  Suppliers: 'සැපයුම්කරුවන්',
  Customers: 'ගනුදෙනුකරුවන්',
  'Orders & Quotes': 'ඇණවුම් සහ මිල ගණන්',
  'Sales & Returns': 'විකුණුම් සහ ආපසු',
  'Cash & Expenses': 'මුදල් සහ වියදම්',
  Reports: 'වාර්තා',
  Staff: 'කාර්ය මණ්ඩලය',
  Settings: 'සැකසුම්',
  'School Lists': 'පාසල් ලැයිස්තු',
  'Sign out': 'පිටවීම',
  Search: 'සොයන්න',
  Total: 'මුළු මුදල',
  Subtotal: 'උප එකතුව',
  Discount: 'වට්ටම',
  Cash: 'මුදල්',
  Card: 'කාඩ්පත',
  'Bank Transfer': 'බැංකු මාරු',
  'QR / Digital': 'QR / ඩිජිටල්',
  Change: 'ඉතිරි මුදල',
  Paid: 'ගෙවූ මුදල',
  Balance: 'ශේෂය',
  Customer: 'ගනුදෙනුකරු',
  Cashier: 'අයකැමි',
  Receipt: 'රිසිට්පත',
  Qty: 'ප්‍රමාණය',
  Item: 'භාණ්ඩය',
  Price: 'මිල',
  'Pay now': 'ගෙවන්න',
  'Hold bill': 'බිල රඳවන්න',
  Clear: 'මකන්න',
  'Walk-in Customer': 'සාමාන්‍ය ගනුදෙනුකරු',
  'Today’s sales': 'අද විකුණුම්',
  'Low stock': 'අඩු තොග',
  'Out of stock': 'තොග නැත',
  'In stock': 'තොග ඇත',
  Print: 'මුද්‍රණය',
  Save: 'සුරකින්න',
  Cancel: 'අවලංගු',
  Thank: 'ස්තූතියි! නැවත පැමිණෙන්න.',
  'Thank you! Please visit again.': 'ස්තූතියි! නැවත පැමිණෙන්න.',
  'Scan barcode or search by title, author, ISBN or code…': 'බාර්කෝඩ් ස්කෑන් කරන්න හෝ නම, කතෘ, ISBN වලින් සොයන්න…',
  'Tax invoice': 'බදු ඉන්වොයිසිය',
  Invoice: 'ඉන්වොයිසිය',
  Date: 'දිනය',
  Welcome: 'ආයුබෝවන්',
}

export const translate = (lang: 'en' | 'si', key: string) => (lang === 'si' ? si[key] ?? key : key)

export const useT = () => {
  const lang = useStore((s) => s.settings.appearance.language)
  return (key: string) => translate(lang, key)
}
