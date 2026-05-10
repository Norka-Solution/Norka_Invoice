import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientsApi, companiesApi } from '../api/client'
import type { Client, Company, PaginatedResponse } from '../types'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'

const EMPTY = (): Partial<Client> => ({
  name_en: '', name_ar: '', contact_person: '', email: '', phone: '',
  address_en: '', trn: '', company: '',
})

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

export default function Clients() {
  const qc = useQueryClient()
  const [editing, setEditing]       = useState<Partial<Client> | null>(null)
  const [isNew, setIsNew]           = useState(false)
  const [search, setSearch]         = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)

  const { data: compData } = useQuery<{ results: Company[] }>({
    queryKey: ['companies'],
    queryFn:  () => companiesApi.list().then(r => r.data),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<Client>>({
    queryKey: ['clients'],
    queryFn:  () => clientsApi.list().then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (c: Partial<Client>) => c.id ? clientsApi.update(c.id, c) : clientsApi.create(c),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client saved')
      setEditing(null); setIsNew(false)
    },
    onError: () => toast.error('Error saving client'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client deleted')
      setDeleteTarget(null)
    },
    onError: () => { toast.error('Cannot delete — client has invoices'); setDeleteTarget(null) },
  })

  const companies  = compData?.results ?? []
  const allClients = data?.results ?? []
  const clients    = search
    ? allClients.filter(c =>
        [c.name_en, c.name_ar, c.email, c.contact_person]
          .some(f => f?.toLowerCase().includes(search.toLowerCase()))
      )
    : allClients

  function openNew() {
    setEditing({ ...EMPTY(), company: companies[0]?.id ?? '' })
    setIsNew(true)
  }

  return (
    <div className="space-y-5">

      {deleteTarget && (
        <Modal
          title="Delete Client"
          message={`Delete "${deleteTarget.name_en}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => delMut.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-sub">{allClients.length} total</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ New Client</button>
      </div>

      {/* Form */}
      {editing && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-[#1A1714] mb-4">
            {isNew ? 'New Client' : 'Edit Client'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Company *</label>
              <select className="select" value={editing.company}
                onChange={e => setEditing(p => ({ ...p!, company: e.target.value }))}>
                <option value="">Select company…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Name (EN) *</label>
              <input className="input" value={editing.name_en} placeholder="Client name"
                onChange={e => setEditing(p => ({ ...p!, name_en: e.target.value }))} />
            </div>
            <div>
              <label className="label">Name (AR)</label>
              <input className="input" value={editing.name_ar} dir="rtl" placeholder="اسم العميل"
                onChange={e => setEditing(p => ({ ...p!, name_ar: e.target.value }))} />
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input className="input" value={editing.contact_person}
                onChange={e => setEditing(p => ({ ...p!, contact_person: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={editing.email}
                onChange={e => setEditing(p => ({ ...p!, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={editing.phone} placeholder="+971…"
                onChange={e => setEditing(p => ({ ...p!, phone: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <input className="input" value={editing.address_en}
                onChange={e => setEditing(p => ({ ...p!, address_en: e.target.value }))} />
            </div>
            <div>
              <label className="label">TRN</label>
              <input className="input font-mono" value={editing.trn} placeholder="Tax Reg. No."
                onChange={e => setEditing(p => ({ ...p!, trn: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => saveMut.mutate(editing!)}
              disabled={saveMut.isPending || !editing.name_en || !editing.company}
              className="btn-primary btn-sm"
            >
              {saveMut.isPending ? 'Saving…' : 'Save Client'}
            </button>
            <button onClick={() => { setEditing(null); setIsNew(false) }} className="btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card p-3">
        <input
          className="input"
          placeholder="Search by name, email, or contact…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center p-16"><div className="spinner" /></div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <p className="text-sm text-[#A39890] mb-1">
              {search ? 'No clients match your search' : 'No clients yet'}
            </p>
            {!search && (
              <button onClick={openNew} className="btn-primary btn-sm mt-4">Add First Client</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[600px]">
              <thead><tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>TRN</th>
                <th className="text-right">Actions</th>
              </tr></thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#F3F0EB] flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[#6B6259]">{initials(c.name_en)}</span>
                        </div>
                        <div>
                          <div className="font-medium text-[#1A1714] text-sm">{c.name_en}</div>
                          {c.name_ar && (
                            <div className="text-xs text-[#A39890]" dir="rtl">{c.name_ar}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-[#6B6259] text-sm">{c.contact_person || <span className="text-[#CEC8BE]">—</span>}</td>
                    <td>
                      {c.email
                        ? <a href={`mailto:${c.email}`} className="text-sm text-[#3A5F8B] hover:underline">{c.email}</a>
                        : <span className="text-[#CEC8BE]">—</span>
                      }
                    </td>
                    <td className="text-[#6B6259] text-sm">{c.phone || <span className="text-[#CEC8BE]">—</span>}</td>
                    <td className="font-mono text-xs text-[#A39890]">{c.trn || <span className="text-[#CEC8BE]">—</span>}</td>
                    <td>
                      <div className="flex items-center justify-end gap-3 text-xs">
                        <button
                          onClick={() => { setEditing({ ...c }); setIsNew(false) }}
                          className="text-[#6B6259] hover:text-[#1A1714] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="text-[#8B3A3A] hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
