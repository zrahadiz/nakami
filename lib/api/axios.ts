import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      typeof window !== 'undefined'
    ) {
      const next = `${window.location.pathname}${window.location.search}`

      if (
        window.location.pathname !== '/sign-in' &&
        window.location.pathname !== '/register'
      ) {
        window.location.replace(
          `/sign-in?next=${encodeURIComponent(next)}`
        )
      }
    }

    return Promise.reject(error)
  }
)