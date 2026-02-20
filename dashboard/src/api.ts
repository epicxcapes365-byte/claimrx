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
  generateAppeal: async (claim: any, senderProfile?: any, onChunk?: (text: string) => void) => {
    const res = await authFetch(API_URL + '/appeals/generate', {
      method: 'POST',
      body: JSON.stringify({ claim, senderProfile })
    })
    if (onChunk && res.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) { fullText += data.text; onChunk(fullText) }
            } catch (e) {}
          }
        }
      }
      return { letter: fullText }
    }
    return res.json()
  },
  getProviders: async () => {
    const res = await authFetch(API_URL + '/providers')
    return res.json()
  },
  createProvider: async (provider: any) => {
    const res = await authFetch(API_URL + '/providers', {
      method: 'POST',
      body: JSON.stringify(provider)
    })
    return res.json()
  },
  updateProvider: async (id: number, provider: any) => {
    const res = await authFetch(API_URL + '/providers/' + id, {
      method: 'PATCH',
      body: JSON.stringify(provider)
    })
    return res.json()
  },
  deleteProvider: async (id: number) => {
    const res = await authFetch(API_URL + '/providers/' + id, {
      method: 'DELETE'
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
