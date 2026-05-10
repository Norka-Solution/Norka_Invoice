import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi, clientsApi, companiesApi } from '../api/client'
import type { Client, Company, Invoice, InvoiceItem, ItemCategory, ItemCurrency } from '../types'
import toast from 'react-hot-toast'
import { fmtAmount } from '../lib/utils'

const EMPTY_ITEM = (): InvoiceItem => ({
  description_en: '', description_ar: '',
  quantity: 1, unit_price: 0,
  currency: 'AED', exchange_rate: 1,
  category: 'service', sort_order: 0,
})

const CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: 'subscription', label: 'Subscription' },
  { value: 'service',      label: 'Service' },
  { value: 'product',      label: 'Product' },
  { value: 'development',  label: 'Development' },
  { value: 'maintenance',  label: 'Maintenance' },
  { value: 'other',        label: 'Other' },
]

const CURRENCIES: ItemCurrency[] = ['AED', 'USD', 'EUR']
const RATES: Record<string, number> = { AED: 1, USD: 3.67, EUR: 4.01 }

export default function InvoiceForm() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const isEdit   = !!id

  const { data: companies } = useQuery<{ results: Company[] }>({
    queryKey: ['companies'],
    queryFn:  () => companiesApi.list().then(r => r.data),
  })

  const [companyId, setCompanyId] = useState('')
  const { data: clients } = useQuery<{ results: Client[] }>({
    queryKey: ['clients', companyId],
    queryFn:  () => clientsApi.list(companyId ? { company: companyId } : {}).then(r => r.data),
  })

  const [form, setForm] = useState({
    company: '', client: '', issue_date: '', due_date: '',
    period_start: '', period_end: '',
    vat_enabled: false, vat_rate: '5.00',
    notes_en: '', notes_ar: '', bank_details: '',
  })
  const [items, setItems]           = useState<InvoiceItem[]>([EMPTY_ITEM()])
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  const { data: recentRaw } = useQuery<unknown[]>({
    queryKey: ['recent-items'],
    queryFn:  () => invoicesApi.recentItems().then(r => r.data),
  })

  useEffect(() => {
    if (!showPicker) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  type RecentItem = { description_en: string; description_ar: string; category: string; unit_price: string | number; currency: string; exchange_rate: string | number }
  const recentItems: RecentItem[] = Array.isArray(recentRaw) ? recentRaw as RecentItem[] : []
  const filteredRecent = pickerSearch
    ? recentItems.filter(r => r.description_en.toLowerCase().includes(pickerSearch.toLowerCase()))
    : recentItems

  const companyList = companies?.results ?? []
  const clientList  = clients?.results  ?? []

  useEffect(() => {
    if (!isEdit && companyList.length === 1) {
      const c = companyList[0]
      setForm(f => ({ ...f, company: c.id }))
      setCompanyId(c.id)
      if (c.bank_accounts?.length) setForm(f => ({ ...f, bank_details: c.bank_accounts[0].id }))
    }
  }, [companyList, isEdit])

  useEffect(() => {
    if (!isEdit) return
    invoicesApi.get(id!).then((r: { data: Invoice }) => {
      const inv = r.data
      setForm({
        company:      inv.company,
        client:       inv.client,
        issue_date:   inv.issue_date,
        due_date:     inv.due_date,
        period_start: inv.period_start ?? '',
        period_end:   inv.period_end   ?? '',
        vat_enabled:  inv.vat_enabled,
        vat_rate:     String(inv.vat_rate),
        notes_en:     inv.notes_en ?? '',
        notes_ar:     inv.notes_ar ?? '',
        bank_details: inv.bank_details ?? '',
      })
      setCompanyId(inv.company)
      setItems(inv.items.length ? inv.items : [EMPTY_ITEM()])
    })
  }, [id, isEdit])

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        vat_rate:     parseFloat(form.vat_rate),
        period_start: form.period_start  || null,
        period_end:   form.period_end    || null,
        bank_details: form.bank_details  || null,
        company:      form.company       || null,
        items,
      }
      return isEdit ? invoicesApi.update(id!, payload) : invoicesApi.create(payload)
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(isEdit ? 'Invoice updated' : 'Invoice created')
      navigate(`/invoices/${r.data.id}`)
    },
    onError: (e: any) => {
      toast.error(JSON.stringify(e.response?.data || 'Error').slice(0, 120))
    },
  })

  function setItem(idx: number, key: keyof InvoiceItem, val: string | number) {
    setItems(prev => {
      const next = [...prev]
      const item = { ...next[idx], [key]: val }
      if (key === 'currency') item.exchange_rate = RATES[val as string] ?? 1
      if (key === 'description_en') item.description_ar = val as string
      next[idx] = item
      return next
    })
  }

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price * (it.exchange_rate || 1), 0)
  const vatAmt   = form.vat_enabled ? subtotal * parseFloat(form.vat_rate || '0') / 100 : 0
  const total    = subtotal + vatAmt

  const selectedCompany = companyList.find(c => c.id === form.company)
  const canSave = form.client && form.issue_date && form.due_date

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#6B6259] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-[#1A1714] tracking-tight">
          {isEdit ? 'Edit Invoice' : 'New Invoice'}
        </h1>
      </div>

      {/* Invoice details */}
      <div className="bg-white border border-[#E5DFD6] rounded-2xl p-6 space-y-5">
        <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-widest">Invoice Details</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Client *</label>
            <select className="select" value={form.client}
              onChange={e => setForm(f => ({ ...f, client: e.target.value }))}>
              <option value="">Select client…</option>
              {clientList.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Issue Date *</label>
            <input className="input" type="date" value={form.issue_date}
              onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Due Date *</label>
            <input className="input" type="date" value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
        </div>

        {selectedCompany?.bank_accounts?.length ? (
          <div>
            <label className="label">Bank Account</label>
            <select className="select" value={form.bank_details}
              onChange={e => setForm(f => ({ ...f, bank_details: e.target.value }))}>
              <option value="">No bank details on invoice</option>
              {selectedCompany.bank_accounts.map(b => (
                <option key={b.id} value={b.id}>{b.bank_name} — {b.account_name}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {/* Line items */}
      <div className="bg-white border border-[#E5DFD6] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5DFD6] flex items-center justify-between">
          <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-widest">Line Items</p>
          <div className="flex items-center gap-2">
            {/* Previous items picker */}
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => { setShowPicker(p => !p); setPickerSearch('') }}
                className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#6B6259] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors"
              >
                From Previous
              </button>
              {showPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-white border border-[#E5DFD6] rounded-xl shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-[#F3F0EB]">
                    <input
                      autoFocus
                      className="input text-sm w-full"
                      placeholder="Search previous items…"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredRecent.length === 0 ? (
                      <p className="text-xs text-[#A39890] p-4 text-center">No previous items found</p>
                    ) : filteredRecent.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setItems(p => [...p, {
                            description_en: r.description_en,
                            description_ar: r.description_ar,
                            quantity: 1,
                            unit_price: Number(r.unit_price),
                            currency: r.currency as ItemCurrency,
                            exchange_rate: Number(r.exchange_rate),
                            category: r.category as ItemCategory,
                            sort_order: 0,
                          }])
                          setShowPicker(false)
                          setPickerSearch('')
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#FAFAF8] border-b border-[#F3F0EB] last:border-0 transition-colors"
                      >
                        <div className="text-sm font-medium text-[#1A1714] truncate">{r.description_en}</div>
                        <div className="flex gap-3 mt-0.5 text-xs text-[#A39890]">
                          <span>{CATEGORIES.find(c => c.value === r.category)?.label ?? r.category}</span>
                          <span>AED {fmtAmount(Number(r.unit_price))}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setItems(p => [...p, EMPTY_ITEM()])}
              className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#1A1714] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors"
            >
              + Add Item
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead className="border-b border-[#E5DFD6] bg-[#FAFAF8]">
              <tr>
                {['Description', 'Category', 'Qty', 'Unit Price', 'Currency', 'Total (AED)', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#A39890] uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F0EB]">
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2.5">
                    <input
                      className="input text-sm min-w-[200px]"
                      placeholder="Describe the service or product…"
                      value={item.description_en}
                      onChange={e => setItem(idx, 'description_en', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <select className="select text-sm w-36" value={item.category}
                      onChange={e => setItem(idx, 'category', e.target.value)}>
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <input className="input text-sm w-16 text-center" type="number" min="1"
                      value={item.quantity}
                      onChange={e => setItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input className="input text-sm w-28" type="number" min="0" step="0.01"
                      value={item.unit_price}
                      onChange={e => setItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <select className="select text-sm w-20" value={item.currency}
                      onChange={e => setItem(idx, 'currency', e.target.value)}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-[#1A1714] whitespace-nowrap">
                    {fmtAmount(item.quantity * item.unit_price * (item.exchange_rate || 1))}
                  </td>
                  <td className="px-4 py-2.5">
                    {items.length > 1 && (
                      <button
                        onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                        className="text-xs text-[#A39890] hover:text-[#8B3A3A] transition-colors w-6 h-6 flex items-center justify-center rounded"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes + Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        <div className="bg-white border border-[#E5DFD6] rounded-2xl p-6 space-y-4">
          <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-widest">Notes &amp; VAT</p>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.vat_enabled}
              onChange={e => setForm(f => ({ ...f, vat_enabled: e.target.checked }))}
              className="w-4 h-4 accent-[#1A1714]" />
            <span className="text-sm font-medium text-[#1A1714]">Enable VAT</span>
          </label>
          {form.vat_enabled && (
            <div>
              <label className="label">VAT Rate (%)</label>
              <input className="input w-32" type="number" min="0" max="100" step="0.01"
                value={form.vat_rate}
                onChange={e => setForm(f => ({ ...f, vat_rate: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[80px] resize-none"
              rows={3}
              placeholder="Payment terms, additional info…"
              value={form.notes_en}
              onChange={e => setForm(f => ({ ...f, notes_en: e.target.value }))}
            />
          </div>
        </div>

        <div className="bg-white border border-[#E5DFD6] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-widest mb-4">Summary</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between py-2.5 border-b border-[#F3F0EB]">
                <span className="text-[#6B6259]">Subtotal</span>
                <span className="font-medium text-[#1A1714]">AED {fmtAmount(subtotal)}</span>
              </div>
              {form.vat_enabled && (
                <div className="flex justify-between py-2.5 border-b border-[#F3F0EB]">
                  <span className="text-[#6B6259]">VAT ({form.vat_rate}%)</span>
                  <span className="text-[#6B6259]">AED {fmtAmount(vatAmt)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 px-4 bg-[#1A1714] text-white rounded-xl mt-3">
                <span className="font-semibold text-sm">Total Due</span>
                <span className="font-bold">AED {fmtAmount(total)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !canSave}
            className="w-full py-3 bg-[#1A1714] text-white text-sm font-medium rounded-xl hover:bg-[#2C2825] transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-5"
          >
            {saveMut.isPending ? 'Saving…' : isEdit ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
