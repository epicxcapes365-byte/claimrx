const API_URL = import.meta.env.PROD 
  ? 'https://claimrx-production.up.railway.app/api' 
  : 'http://localhost:3001/api'

// Get token from localStorage
const getToken = () => localStorage.getItem('token')

// Helper for authenticated requests
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const res = await fetch(url, { ...options, headers })
  
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/'
  }
  
  return res
}

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    return res.json()
  },

  register: async (email: string, password: string, name: string) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    })
    return res.json()
  },

  getMe: async () => {
    const res = await authFetch(`${API_URL}/auth/me`)
    return res.json()
  },

  // Claims
  getClaims: async () => {
    const res = await authFetch(`${API_URL}/claims`)
    return res.json()
  },

  updateClaim: async (id: string, data: any) => {
    const res = await authFetch(`${API_URL}/claims/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
    return res.json()
  },

  // Appeals
  getAppeals: async () => {
    const res = await authFetch(`${API_URL}/appeals`)
    return res.json()
  },

  createAppeal: async (data: any) => {
    const res = await authFetch(`${API_URL}/appeals`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
    return res.json()
  },

  generateAppeal: async (claim: any) => {
    const res = await authFetch(`${API_URL}/appeals/generate`, {
      method: 'POST',
      body: JSON.stringify({ claim })
    })
    return res.json()
  },

  // Stats
  getStats: async () => {
    const res = await authFetch(`${API_URL}/stats`)
    return res.json()
  }
}