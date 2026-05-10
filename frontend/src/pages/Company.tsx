import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api/client'
import type { Company, BankDetails } from '../types'
import toast from 'react-hot-toast'

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace('/api', '') || ''

export default function CompanyPage() {
  const qc      = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery<{ results: Company[] }>({
    queryKey: ['companies'],
    queryFn:  () => companiesApi.list().then(r => r.data),
  })

  const company = data?.results?.[0]

  const [form, setForm] = useState({
    name_en: '', name_ar: '', address_en: '', address_ar: '',
    phone: '', email: '', trn: '', website: '',
  })
  const [banks, setBanks] = useState<Partial<BankDetails>[]>([])

  useEffect(() => {
    if (!company) return
    setForm({
      name_en:    company.name_en    || '',
      name_ar:    company.name_ar    || '',
      address_en: company.address_en || '',
      address_ar: company.address_ar || '',
      phone:      company.phone      || '',
      email:      company.email      || '',
      trn:        company.trn        || '',
      website:    company.website    || '',
    })
    setBanks(company.bank_accounts || [])
  }, [company])

  const saveMut = useMutation({
    mutationFn: () =>
      company
        ? companiesApi.update(company.id, { ...form, bank_accounts: banks })
        : companiesApi.create({ ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Company saved')
    },
    onError: () => toast.error('Error saving'),
  })

  const logoMut = useMutation({
    mutationFn: (file: File) => companiesApi.uploadLogo(company!.id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Logo uploaded')
    },
    onError: () => toast.error('Upload failed'),
  })

  function addBank() {
    setBanks(b => [...b, {
      bank_name: '', account_name: '', account_number: '',
      iban: '', swift_code: '', branch: '', currency: 'AED',
      is_default: b.length === 0,
    }])
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><div className="spinner" /></div>
  }

  const logoUrl = company?.logo
    ? (company.logo.startsWith('http') ? company.logo : `${BASE_URL}${company.logo}`)
    : null

  return (
    <div className="max-w-3xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1714] tracking-tight">Company</h1>
          <p className="text-xs text-[#A39890] mt-0.5">Profile &amp; bank accounts</p>
        </div>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !form.name_en}
          className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saveMut.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Logo */}
      {company && (
        <div className="bg-white border border-[#E5DFD6] rounded-2xl p-6">
          <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-widest mb-4">Company Logo</p>
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl border border-[#E5DFD6] bg-[#F8F5F0] flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoUrl
                ? <img src={logoUrl} alt="logo" className="w-full h-full object-contain" />
                : <span className="text-xl font-bold text-[#CEC8BE]">{form.name_en?.[0] ?? 'N'}</span>
              }
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) logoMut.mutate(f) }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={logoMut.isPending}
                className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#1A1714] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors disabled:opacity-40"
              >
                {logoMut.isPending ? 'Uploading…' : 'Upload Logo'}
              </button>
              <p className="text-xs text-[#A39890] mt-1.5">PNG or JPG, max 2MB. Shown on invoices.</p>
            </div>
          </div>
        </div>
      )}

      {/* Company info */}
      <div className="bg-white border border-[#E5DFD6] rounded-2xl p-6 space-y-5">
        <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-widest">Company Information</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Company Name *</label>
            <input className="input" value={form.name_en} placeholder="e.g. NORKA Solution LLC"
              onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Address</label>
            <input className="input" value={form.address_en} placeholder="Full address"
              onChange={e => setForm(f => ({ ...f, address_en: e.target.value }))} />
          </div>
        </div>

        <div className="border-t border-[#E5DFD6]" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} placeholder="+971 2 XXX XXXX"
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} placeholder="info@company.com"
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">TRN (Tax Registration No.)</label>
            <input className="input font-mono" value={form.trn} placeholder="100XXXXXXXXX00003"
              onChange={e => setForm(f => ({ ...f, trn: e.target.value }))} />
          </div>
          <div>
            <label className="label">Website</label>
            <input className="input" value={form.website} placeholder="https://company.com"
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Bank accounts */}
      <div className="bg-white border border-[#E5DFD6] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-[#A39890] uppercase tracking-widest">Bank Accounts</p>
          <button
            onClick={addBank}
            className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#1A1714] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors"
          >
            + Add Bank
          </button>
        </div>

        {banks.length === 0 ? (
          <div className="border-2 border-dashed border-[#E5DFD6] rounded-xl p-8 text-center">
            <p className="text-sm text-[#A39890] mb-3">No bank accounts added yet</p>
            <button
              onClick={addBank}
              className="px-3 py-1.5 bg-white border border-[#E5DFD6] text-[#1A1714] text-xs font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors"
            >
              Add Bank Account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {banks.map((b, idx) => (
              <div
                key={idx}
                className={`border rounded-xl p-5 space-y-4 ${b.is_default ? 'border-[#1A1714]/15 bg-[#FAFAF8]' : 'border-[#E5DFD6]'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#A39890] uppercase tracking-widest">
                      Bank {idx + 1}
                    </span>
                    {b.is_default && (
                      <span className="text-[10px] font-semibold text-[#1A1714] bg-[#1A1714]/8 px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setBanks(p => p.filter((_, i) => i !== idx))}
                    className="text-xs text-[#A39890] hover:text-[#8B3A3A] transition-colors"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['bank_name',      'Bank Name'],
                    ['account_name',   'Account Name'],
                    ['account_number', 'Account Number'],
                    ['iban',           'IBAN'],
                    ['swift_code',     'SWIFT / BIC'],
                    ['branch',         'Branch'],
                  ] as [string, string][]).map(([key, label]) => (
                    <div key={key}>
                      <label className="label">{label}</label>
                      <input
                        className={`input text-sm ${['iban', 'swift_code', 'account_number'].includes(key) ? 'font-mono' : ''}`}
                        value={(b as Record<string, string>)[key] || ''}
                        placeholder={key === 'iban' ? 'AE...' : key === 'swift_code' ? 'XXXXXXXX' : ''}
                        onChange={e => setBanks(p => p.map((x, i) =>
                          i === idx ? { ...x, [key]: e.target.value } : x
                        ))}
                      />
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-2.5 text-xs text-[#6B6259] cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-[#1A1714]"
                    checked={b.is_default || false}
                    onChange={e => setBanks(p =>
                      p.map((x, i) => ({ ...x, is_default: i === idx ? e.target.checked : false }))
                    )}
                  />
                  Set as default for new invoices
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save bottom */}
      <button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending || !form.name_en}
        className="w-full py-3 bg-[#1A1714] text-white text-sm font-medium rounded-xl hover:bg-[#2C2825] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saveMut.isPending ? 'Saving…' : 'Save All Changes'}
      </button>

    </div>
  )
}
