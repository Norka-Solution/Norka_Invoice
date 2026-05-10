import { useState, useRef, useEffect } from 'react'
import type { KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { aiApi } from '../api/ai'
import type { ChatMessage, AiAction } from '../api/ai'

interface DisplayMessage {
  role: 'user' | 'assistant'
  content: string
  actions?: AiAction[]
  loading?: boolean
}

const SUGGESTIONS = [
  'اعمل فاتورة لأول عميل بـ 2000 درهم شهرياً',
  'Show me overdue invoices',
  'Add a new client',
  'Dashboard stats',
]

function ActionChip({ action }: { action: AiAction }) {
  const labels: Record<string, string> = {
    invoice_created:  `Invoice ${action.invoice_number} created`,
    client_created:   `Client "${action.name}" added`,
    payment_recorded: `Payment AED ${action.amount} recorded`,
  }
  return (
    <span className="inline-block text-[10px] font-medium bg-[#EBF3EF] text-[#3A6B4F] border border-[#C5DFD0] rounded-full px-2.5 py-1 mt-1">
      {labels[action.type] ?? action.type}
    </span>
  )
}

export default function AiAssistant() {
  const [open, setOpen]         = useState(false)
  const [input, setInput]       = useState('')
  const [messages, setMessages] = useState<DisplayMessage[]>([{
    role: 'assistant',
    content: 'Hi, I\'m NORKA AI.\n\nI can create invoices, add clients, record payments, and show stats.\n\nTry: "Create invoice for [client] — AED 5,000"',
  }])
  const [loading, setLoading]   = useState(false)
  const [showSugg, setShowSugg] = useState(true)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLTextAreaElement>(null)
  const queryClient             = useQueryClient()
  const navigate                = useNavigate()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100) }, [open])

  function getApiMessages(): ChatMessage[] {
    return messages.filter(m => !m.loading && m.content).map(m => ({ role: m.role, content: m.content }))
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    setShowSugg(false)
    setMessages(prev => [
      ...prev,
      { role: 'user', content: text.trim() },
      { role: 'assistant', content: '', loading: true },
    ])
    setInput('')
    setLoading(true)

    try {
      const history = getApiMessages()
      const { data } = await aiApi.chat([...history, { role: 'user', content: text.trim() }])

      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        { role: 'assistant', content: data.reply || 'Done.', actions: data.actions },
      ])

      if (data.actions?.length) {
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
        queryClient.invalidateQueries({ queryKey: ['clients'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      }
    } catch (err: any) {
      const msg = err?.response?.data?.reply || err?.response?.data?.error || 'An error occurred.'
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        { role: 'assistant', content: `${msg}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleActionClick(action: AiAction) {
    if (action.invoice_id) navigate(`/invoices/${action.invoice_id}`)
    else if (action.client_id) navigate('/clients')
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`
          fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg
          flex items-center justify-center text-sm font-bold
          transition-all duration-200
          ${open ? 'bg-[#F3F0EB] text-[#1A1714]' : 'bg-[#1A1714] text-white'}
        `}
        title="NORKA AI"
      >
        {open ? '✕' : 'AI'}
        {!open && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-[#3A6B4F] rounded-full border-2 border-white" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-22 right-6 z-50 w-80 max-h-[540px] flex flex-col rounded-xl shadow-xl bg-white border border-[#E5DFD6] overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 border-b border-[#E5DFD6] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1A1714]">NORKA AI</p>
              <p className="text-[10px] text-[#A39890]">Invoice Assistant</p>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] text-[#A39890]">
              <span className="w-1.5 h-1.5 bg-[#3A6B4F] rounded-full" />
              Online
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" style={{ maxHeight: 380 }}>
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              if (msg.loading) {
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="w-6 h-6 rounded-full bg-[#1A1714] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-[9px] font-bold">AI</span>
                    </div>
                    <div className="bg-[#F3F0EB] rounded-xl px-3 py-2 text-[#6B6259] text-xs">
                      Thinking…
                    </div>
                  </div>
                )
              }
              return (
                <div key={i} className={`flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
                  {!isUser && (
                    <div className="w-6 h-6 rounded-full bg-[#1A1714] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-[9px] font-bold">AI</span>
                    </div>
                  )}
                  <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`
                      px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap break-words
                      ${isUser
                        ? 'bg-[#1A1714] text-white rounded-tr-sm'
                        : 'bg-[#F3F0EB] text-[#1A1714] rounded-tl-sm'
                      }
                    `}>
                      {msg.content}
                    </div>
                    {msg.actions?.map((a, j) => (
                      <button key={j} onClick={() => handleActionClick(a)} className="text-left">
                        <ActionChip action={a} />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}

            {showSugg && messages.length === 1 && (
              <div className="space-y-1.5 pt-1">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-[#E5DFD6]
                               text-[#6B6259] hover:bg-[#F3F0EB] hover:text-[#1A1714] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#E5DFD6]">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Type a command… (Enter to send)"
                rows={1}
                disabled={loading}
                className="flex-1 resize-none rounded-lg border border-[#E5DFD6] px-3 py-2 text-xs
                           focus:outline-none focus:ring-2 focus:ring-[#1A1714]/10 focus:border-[#1A1714]
                           disabled:opacity-50 bg-white text-[#1A1714] placeholder:text-[#A39890]"
                style={{ maxHeight: 80, overflowY: 'auto' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 80) + 'px'
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-lg bg-[#1A1714] text-white flex items-center justify-center
                           hover:bg-[#2D2926] disabled:opacity-30 transition-colors flex-shrink-0 text-sm"
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
