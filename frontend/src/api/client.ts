import axios from 'axios'

const BASE = (import.meta.env.VITE_API_URL as string) || '/api'

export const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        const { data } = await axios.post(`${BASE}/auth/token/refresh/`, { refresh })
        localStorage.setItem('access_token', data.access)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/token/', { username, password }),
}

export const companiesApi = {
  list:   ()                       => api.get('/companies/'),
  get:    (id: string)             => api.get(`/companies/${id}/`),
  create: (data: unknown)          => api.post('/companies/', data),
  update: (id: string, d: unknown) => api.put(`/companies/${id}/`, d),
  delete: (id: string)             => api.delete(`/companies/${id}/`),
  uploadLogo: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('logo', file)
    return api.patch(`/companies/${id}/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const clientsApi = {
  list:   (params?: Record<string, string>) => api.get('/clients/', { params }),
  get:    (id: string)             => api.get(`/clients/${id}/`),
  create: (data: unknown)          => api.post('/clients/', data),
  update: (id: string, d: unknown) => api.put(`/clients/${id}/`, d),
  delete: (id: string)             => api.delete(`/clients/${id}/`),
}

export const invoicesApi = {
  list:      (params?: Record<string, string>) => api.get('/invoices/', { params }),
  get:       (id: string)             => api.get(`/invoices/${id}/`),
  create:    (data: unknown)          => api.post('/invoices/', data),
  update:    (id: string, d: unknown) => api.put(`/invoices/${id}/`, d),
  delete:    (id: string)             => api.delete(`/invoices/${id}/`),
  send:      (id: string)             => api.post(`/invoices/${id}/send/`),
  cancel:    (id: string)             => api.post(`/invoices/${id}/cancel/`),
  duplicate: (id: string)             => api.post(`/invoices/${id}/duplicate/`),
  pdf:       (id: string)             => api.get(`/invoices/${id}/pdf/`, { responseType: 'blob' }),
}

export const paymentsApi = {
  list:   (invId: string)                      => api.get(`/invoices/${invId}/payments/`),
  create: (invId: string, data: unknown)       => api.post(`/invoices/${invId}/payments/`, data),
  delete: (invId: string, pid: string)         => api.delete(`/invoices/${invId}/payments/${pid}/`),
}

export const dashboardApi = {
  stats: () => api.get('/dashboard/'),
}

export async function downloadPdf(invoiceId: string, invoiceNumber: string) {
  const response = await invoicesApi.pdf(invoiceId)
  const url  = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href  = url
  link.setAttribute('download', `${invoiceNumber}.pdf`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
