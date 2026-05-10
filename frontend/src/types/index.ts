export interface Company {
  id: string
  name_en: string
  name_ar: string
  address_en: string
  address_ar: string
  phone: string
  email: string
  logo: string | null
  trn: string
  website: string
  bank_accounts: BankDetails[]
  created_at: string
}

export interface BankDetails {
  id: string
  company: string
  bank_name: string
  account_name: string
  account_number: string
  iban: string
  swift_code: string
  branch: string
  currency: string
  is_default: boolean
}

export interface Client {
  id: string
  company: string
  name_en: string
  name_ar: string
  contact_person: string
  email: string
  phone: string
  address_en: string
  address_ar: string
  trn: string
  created_at: string
}

export type InvoiceStatus =
  | 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'

export type ItemCategory =
  | 'subscription' | 'service' | 'product' | 'development' | 'maintenance' | 'other'

export type ItemCurrency = 'AED' | 'USD' | 'EUR'

export interface InvoiceItem {
  id?: string
  invoice?: string
  description_en: string
  description_ar: string
  quantity: number
  unit_price: number
  currency: ItemCurrency
  exchange_rate: number
  category: ItemCategory
  sort_order: number
  line_total?: number
  total_aed?: number
}

export interface Payment {
  id: string
  invoice: string
  amount: number
  payment_date: string
  method: 'bank_transfer' | 'cash' | 'cheque' | 'other'
  reference: string
  notes: string
  created_at: string
}

export interface Invoice {
  id: string
  company: string
  invoice_number: string
  client: string
  client_name?: string
  client_data?: Client
  bank_data?: BankDetails
  status: InvoiceStatus
  issue_date: string
  due_date: string
  period_start: string | null
  period_end: string | null
  vat_enabled: boolean
  vat_rate: number
  notes_en: string
  notes_ar: string
  bank_details: string | null
  items: InvoiceItem[]
  payments: Payment[]
  subtotal_aed: number
  vat_amount: number
  total_aed: number
  total_paid: number
  balance_due: number
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface MonthlyRevenue {
  month: string
  amount: number
}

export interface RecentPayment {
  id: string
  invoice_id: string
  invoice_number: string
  client_name: string
  amount: number
  payment_date: string
  method: string
  reference: string
}

export interface PaymentWithInvoice extends RecentPayment {
  notes: string
  created_at: string
}

export interface DashboardStats {
  total_invoices: number
  draft_count: number
  sent_count: number
  paid_count: number
  overdue_count: number
  partially_paid_count: number
  paid_this_month: number
  total_collected: number
  total_outstanding: number
  monthly_revenue: MonthlyRevenue[]
  recent_payments: RecentPayment[]
}

export interface AuthTokens {
  access: string
  refresh: string
}
