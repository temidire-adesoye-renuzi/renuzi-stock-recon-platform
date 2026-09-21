import axios from 'axios'

export const TOKEN_KEY = 'renuzi_token'
export const USER_KEY = 'renuzi_user'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'

export const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearSession()
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }
    return Promise.reject(error)
  },
)

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function saveSession(token: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
