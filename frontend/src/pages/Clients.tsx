import { useState, useEffect, useRef } from 'react'
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

function IndeterminateCheckbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate: boolean; onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="w-3.5 h-3.5 accent-[#1A1714] cursor-pointer" />
  )
}

export default function Clients() {
  const qc = useQueryClient()
  const [editing, setEditing]           = useState<Partial<Client> | null>(null)
  const [isNew, setIsNew]               = useState(false)
  const [search, setSearch]             = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selected, setSelected]         = useState<Set<string>>(new Set())

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client saved'); setEditing(null); setIsNew(false) },
    onError: () => toast.error('Error saving client'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client deleted'); setDeleteTarget(null) },
    onError: () => { toast.error('Cannot delete — client has invoices'); setDeleteTarget(null) },
  })

  const bulkDelMut = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => clientsApi.delete(id))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setSelected(new Set())
      setBulkDeleteOpen(false)
      toast.success('Deleted')
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setSelected(new Set())
      setBulkDeleteOpen(false)
      toast.error('Some clients could not be deleted (have invoices)')
    },
  })

  const companies  = compData?.results ?? []
  const allClients = data?.results ?? []
  const clients    = search
    ? allClients.filter(c =>
        [c.name_en, c.email, c.contact_person]
          .some(f => f?.toLowerCase().includes(search.toLowerCase()))
      )
    : allClients

  const allSelected  = clients.length > 0 && clients.every(c => selected.has(c.id))
  const someSelected = clients.some(c => selected.has(c.id)) && !allSelected
  const selCount     = clients.filter(c => selected.has(c.id)).length

  function toggleAll() {
    setSelected(prev => {
      const n = new Set(prev)
      allSelected ? clients.forEach(c => n.delete(c.id)) : clients.forEach(c => n.add(c.id))
      return n
    })
  }

  function toggleOne(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function openNew() {
    setEditing({ ...EMPTY(), company: companies[0]?.id ?? '' })
    setIsNew(true)
    setSelected(new Set())
  }

  function openEdit(c: Client, e: React.MouseEvent) {
    e.stopPropagation()
    setEditing({ ...c })
    setIsNew(false)
  }

  return (
    <div className="space-y-5">

      {deleteTarget && (
        <Modal title="Delete Client"
          message={`Delete "${deleteTarget.name_en}"? This cannot be undone.`}
          confirmLabel="Delete" danger
          onConfirm={() => delMut.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)} />
      )}

      {bulkDeleteOpen && (
        <Modal title="Delete Clients"
          message={`Delete ${selCount} selected client${selCount > 1 ? 's' : ''}? Clients with invoices cannot be deleted.`}
          confirmLabel="Delete" danger
          onConfirm={() => bulkDelMut.mutate(clients.filter(c => selected.has(c.id)).map(c => c.id))}
          onCancel={() => setBulkDeleteOpen(false)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1714] tracking-tight">Clients</h1>
          <p className="text-xs text-[#A39890] mt-0.5">{allClients.length} total</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors">
          + New Client
        </button>
      </div>

      {/* Inline form */}
      {editing && (
        <div className="bg-white border border-[#E5DFD6] rounded-2xl p-6">
          <p className="text-sm font-semibold text-[#1A1714] mb-5">
            {isNew ? 'New Client' : `Edit — ${editing.name_en}`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Client Name *</label>
              <input className="input" value={editing.name_en} placeholder="Full legal name"
                onChange={e => setEditing(p => ({ ...p!, name_en: e.target.value }))} />
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input className="input" value={editing.contact_person} placeholder="Account manager name"
                onChange={e => setEditing(p => ({ ...p!, contact_person: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={editing.email} placeholder="billing@client.com"
                onChange={e => setEditing(p => ({ ...p!, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={editing.phone} placeholder="+971 XX XXX XXXX"
                onChange={e => setEditing(p => ({ ...p!, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">TRN</label>
              <input className="input font-mono" value={editing.trn} placeholder="Tax Registration No."
                onChange={e => setEditing(p => ({ ...p!, trn: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <label className="label">Address</label>
              <input className="input" value={editing.address_en} placeholder="Full address"
                onChange={e => setEditing(p => ({ ...p!, address_en: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-5 pt-5 border-t border-[#E5DFD6]">
            <button
              onClick={() => saveMut.mutate(editing!)}
              disabled={saveMut.isPending || !editing.name_en}
              className="px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors disabled:opacity-40">
              {saveMut.isPending ? 'Saving…' : 'Save Client'}
            </button>
            <button onClick={() => { setEditing(null); setIsNew(false) }}
              className="px-4 py-2 bg-white border border-[#E5DFD6] text-[#6B6259] text-sm font-medium rounded-lg hover:bg-[#F3F0EB] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white border border-[#E5DFD6] rounded-2xl p-3">
        <input className="input border-0 focus:ring-0 bg-transparent"
          placeholder="Search by name, email, or contact…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5DFD6] rounded-2xl overflow-hidden">

        {/* Bulk action bar */}
        {selCount > 0 && (
          <div className="px-4 py-2.5 bg-[#1A1714] flex items-center justify-between">
            <span className="text-sm font-medium text-white">{selCount} selected</span>
            <div className="flex items-center gap-4 text-xs">
              <button onClick={() => setBulkDeleteOpen(true)}
                className="text-[#F5EBEB] hover:text-white font-medium transition-colors">
                Delete selected
              </button>
              <button onClick={() => setSelected(new Set())}
                className="text-[#A39890] hover:text-white transition-colors">
                Deselect all
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center p-16"><div className="spinner" /></div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-[#A39890] mb-1">
              {search ? 'No clients match your search' : 'No clients yet'}
            </p>
            {!search && (
              <button onClick={openNew}
                className="mt-4 px-4 py-2 bg-[#1A1714] text-white text-sm font-medium rounded-lg hover:bg-[#2C2825] transition-colors">
                Add First Client
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[640px]">
              <thead><tr>
                <th className="w-10 px-4">
                  <IndeterminateCheckbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                </th>
                <th>Client</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>TRN</th>
                <th className="text-right">Actions</th>
              </tr></thead>
              <tbody>
                {clients.map(c => {
                  const isSel = selected.has(c.id)
                  return (
                    <tr key={c.id}
                      onClick={e => openEdit(c, e)}
                      className={`cursor-pointer transition-colors ${isSel ? 'bg-[#F8F5F0]' : 'hover:bg-[#FAFAF8]'}`}>
                      <td className="w-10 px-4" onClick={e => toggleOne(c.id, e)}>
                        <input type="checkbox" checked={isSel} onChange={() => {}}
                          className="w-3.5 h-3.5 accent-[#1A1714] cursor-pointer" />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#F3F0EB] flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-[#6B6259]">{initials(c.name_en)}</span>
                          </div>
                          <span className="font-medium text-[#1A1714] text-sm">{c.name_en}</span>
                        </div>
                      </td>
                      <td className="text-[#6B6259] text-sm">{c.contact_person || <span className="text-[#CEC8BE]">—</span>}</td>
                      <td>
                        {c.email
                          ? <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                              className="text-sm text-[#3A5F8B] hover:underline">{c.email}</a>
                          : <span className="text-[#CEC8BE]">—</span>}
                      </td>
                      <td className="text-[#6B6259] text-sm">{c.phone || <span className="text-[#CEC8BE]">—</span>}</td>
                      <td className="font-mono text-xs text-[#A39890]">{c.trn || <span className="text-[#CEC8BE]">—</span>}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-3 text-xs">
                          <button onClick={e => openEdit(c, e)}
                            className="text-[#6B6259] hover:text-[#1A1714] font-medium transition-colors">
                            Edit
                          </button>
                          <button onClick={e => { e.stopPropagation(); setDeleteTarget(c) }}
                            className="text-[#8B3A3A] font-medium hover:underline">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
