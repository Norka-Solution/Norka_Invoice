import { api } from './client'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiAction {
  type: 'invoice_created' | 'client_created' | 'payment_recorded'
  invoice_id?: string
  invoice_number?: string
  client_id?: string
  name?: string
  amount?: string
}

export interface AiResponse {
  reply: string
  actions: AiAction[]
  error?: string
}

export const aiApi = {
  chat: (messages: ChatMessage[]) =>
    api.post<AiResponse>('/ai/chat/', { messages }),
}
