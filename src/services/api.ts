import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request Interceptor: Inject JWT token if it exists in local storage
apiClient.interceptors.request.use(
  (config) => {
    const sessionStr = localStorage.getItem('auth_session')
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr)
        if (session && session.token && config.headers) {
          const tokenType = session.tokenType || 'Bearer'
          config.headers.Authorization = `${tokenType} ${session.token}`
        }
      } catch (e) {
        console.error('Failed to parse auth session in interceptor:', e)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response Interceptor: Capture 401 Unauthorized errors and force logout
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('API returned 401 Unauthorized. Directing to logout...')
      
      // Dynamic import to prevent circular dependency at initial load
      const { useAuthStore } = await import('../stores/auth')
      const authStore = useAuthStore()
      authStore.logout()
    }
    return Promise.reject(error)
  }
)

export default apiClient
