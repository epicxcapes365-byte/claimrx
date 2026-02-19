const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : 'https://claimrx-production.up.railway.app/api'

const getToken = () => localStorage.getItem('token')

const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers["Authorization"] = "Bearer " + token
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
  login: async (email: string, password: string) => {
    const res = await fetch(API_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    return res.json()
  },
  register: async (email: string, password: string, name: string) => {
    const res = await fetch(API_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    })
    return res.json()
  },
  getMe: async () => {
    const res = await authFetch(API_URL + '/auth/me')
    return res.json()
  },
  getClaims: async () => {
    const res = await authFetch(API_URL + '/claims')
    return res.json()
  },
  createClaim: async (data: { patient: string; amount: number; payer: string; denialReason: string; deniedDate: string; deadline: string; patientEmail?: string; patientPhone?: string; serviceDate?: string; serviceCode?: string; diagnosisCode?: string }) => {
    const res = await authFetch(API_URL + '/claims', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    return res.json()
  },
  updateClaim: async (id: string, data: any) => {
    const res = await authFetch(API_URL + '/claims/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
    return res.json()
  },
  getAppeals: async () => {
    const res = await authFetch(API_URL + '/appeals')
    return res.json()
  },
  createAppeal: async (data: any) => {
    const res = await authFetch(API_URL + '/appeals', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    return res.json()
  },
  generateAppeal: async (claim: any) => {
    const res = await authFetch(API_URL + '/appeals/generate', {
      method: 'POST',
      body: JSON.stringify({ claim })
    })
    return res.json()
  },
  getPayers: async () => {
    const res = await authFetch(API_URL + '/payers')
    return res.json()
  },
  getStats: async () => {
    const res = await authFetch(API_URL + '/stats')
    return res.json()
  }
}
