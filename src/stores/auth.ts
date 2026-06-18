import { defineStore } from 'pinia'
import router from '../router'
import apiClient from '../services/api'

// Define interfaces for state
export interface AuthState {
  token: string | null
  tokenType: string
  expiresInMs: number
  employeeId: string
  name: string
  role: string
  loginTime: number | null
  hub: string
  loading: boolean
  error: string | null
  isMocked: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => {
    // Hydrate all properties from a single serialized session object
    let session: any = {}
    try {
      const sessionStr = localStorage.getItem('auth_session')
      if (sessionStr) {
        session = JSON.parse(sessionStr)
      }
    } catch (e) {
      console.error('Failed to parse auth session from localStorage:', e)
    }

    return {
      token: session.token || null,
      tokenType: session.tokenType || 'Bearer',
      expiresInMs: Number(session.expiresInMs) || 0,
      employeeId: session.employeeId || '',
      name: session.name || '',
      role: session.role || '',
      loginTime: session.loginTime ? Number(session.loginTime) : null,
      hub: session.hub || 'Metro Logistics Hub',
      loading: false,
      error: null,
      isMocked: !!session.isMocked
    }
  },

  getters: {
    isAuthenticated(): boolean {
      if (!this.token) return false
      // If we have a loginTime and expiresInMs, check if expired
      if (this.loginTime && this.expiresInMs) {
        const elapsed = Date.now() - this.loginTime
        return elapsed < this.expiresInMs
      }
      return true
    },
    
    tokenTimeRemaining(): number {
      if (!this.token || !this.loginTime || !this.expiresInMs) return 0
      const elapsed = Date.now() - this.loginTime
      const remaining = this.expiresInMs - elapsed
      return remaining > 0 ? Math.floor(remaining / 1000) : 0
    }
  },

  actions: {
    setSession(data: {
      token: string
      tokenType: string
      expiresInMs: number
      employeeId: string
      name: string
      role: string
      hub?: string
      isMocked?: boolean
    }) {
      this.token = data.token
      this.tokenType = data.tokenType
      this.expiresInMs = data.expiresInMs
      this.employeeId = data.employeeId
      this.name = data.name
      
      // Map backend role names to frontend role names
      let mappedRole = data.role
      if (data.role === 'SUPER_ADMIN') {
        mappedRole = 'ADMIN'
      } else if (data.role === 'FLEET_MANGER') {
        mappedRole = 'FLEET_MANAGER'
      }
      this.role = mappedRole

      this.loginTime = Date.now()
      this.hub = data.hub || 'Metro Logistics Hub'
      this.isMocked = !!data.isMocked
      this.error = null

      // Persist everything into a single localStorage key
      localStorage.setItem('auth_session', JSON.stringify({
        token: this.token,
        tokenType: this.tokenType,
        expiresInMs: this.expiresInMs,
        employeeId: this.employeeId,
        name: this.name,
        role: this.role,
        loginTime: this.loginTime,
        hub: this.hub,
        isMocked: this.isMocked
      }))
    },

    async signup(name: string, password: string, role: string = 'DISPATCHER') {
      this.loading = true
      this.error = null

      // Map frontend role to backend enum values
      let backendRole = role
      if (role === 'ADMIN') {
        backendRole = 'SUPER_ADMIN'
      } else if (role === 'FLEET_MANAGER') {
        backendRole = 'FLEET_MANGER'
      }
      
      try {
        // Postman API format signature
        const response = await apiClient.post('/auth/signup', {
          name,
          password,
          role: backendRole
        })

        const resData = response.data
        if (resData.status === 'success' && resData.data) {
          const authData = resData.data
          this.setSession({
            token: authData.token,
            tokenType: authData.tokenType,
            expiresInMs: authData.expiresInMs,
            employeeId: authData.employeeId,
            name: authData.name,
            role: authData.role,
            isMocked: false
          })
          
          if (this.role === 'FLEET_MANAGER' || this.role === 'ADMIN') {
            router.push('/manager/dashboard')
          } else {
            router.push('/dashboard')
          }
        } else {
          throw new Error(resData.message || 'Signup failed')
        }
      } catch (err: any) {
        console.warn('Signup server request failed, attempting mock fallback...', err)
        
        // Check if it is a network error (server not running)
        const isNetworkError = !err.response
        if (isNetworkError) {
          // Fallback to simulated signup so user can review full functionality
          const simulatedToken = 'mock-jwt-' + Math.random().toString(36).substr(2, 9)
          const simulatedEmployeeId = (role === 'ADMIN' ? 'ADM-' : role === 'FLEET_MANAGER' ? 'MGR-' : 'EMP-') + 
            new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substr(2, 6).toUpperCase()
          
          this.setSession({
            token: simulatedToken,
            tokenType: 'Bearer',
            expiresInMs: 3600000,
            employeeId: simulatedEmployeeId,
            name,
            role,
            isMocked: true
          })
          
          if (this.role === 'FLEET_MANAGER' || this.role === 'ADMIN') {
            router.push('/manager/dashboard')
          } else {
            router.push('/dashboard')
          }
        } else {
          this.error = err.response?.data?.message || err.message || 'Signup failed'
          throw err
        }
      } finally {
        this.loading = false
      }
    },

    async login(name: string, password: string, role: string = 'DISPATCHER') {
      this.loading = true
      this.error = null
      
      try {
        // Let's call the API POST /api/auth/login
        const response = await apiClient.post('/auth/login', {
          employeeId: name, // Map the username/employeeId input to the API's employeeId
          password
        })

        const resData = response.data
        if (resData.status === 'success' && resData.data) {
          const authData = resData.data
          this.setSession({
            token: authData.token,
            tokenType: authData.tokenType,
            expiresInMs: authData.expiresInMs,
            employeeId: authData.employeeId,
            name: authData.name,
            role: authData.role,
            isMocked: false
          })
          
          if (this.role === 'FLEET_MANAGER' || this.role === 'ADMIN') {
            router.push('/manager/dashboard')
          } else {
            router.push('/dashboard')
          }
        } else {
          throw new Error(resData.message || 'Login failed')
        }
      } catch (err: any) {
        console.warn('Login server request failed, attempting mock fallback...', err)
        
        const isNetworkError = !err.response
        if (isNetworkError) {
          // Fallback to simulated login
          const simulatedToken = 'mock-jwt-' + Math.random().toString(36).substr(2, 9)
          const simulatedEmployeeId = role === 'ADMIN' ? 'ADM-20260611-ADM01' : role === 'FLEET_MANAGER' ? 'MGR-20260611-MGR99' : 'EMP-20260610-AB12CD'
          
          this.setSession({
            token: simulatedToken,
            tokenType: 'Bearer',
            expiresInMs: 86400000, // 24 hours
            employeeId: simulatedEmployeeId,
            name,
            role,
            isMocked: true
          })
          
          if (this.role === 'FLEET_MANAGER' || this.role === 'ADMIN') {
            router.push('/manager/dashboard')
          } else {
            router.push('/dashboard')
          }
        } else {
          this.error = err.response?.data?.message || err.message || 'Invalid username or password'
          throw err
        }
      } finally {
        this.loading = false
      }
    },

    async logout() {
      // Call backend logout to set active = false
      if (this.token && !this.isMocked) {
        try {
          await apiClient.post('/auth/logout')
        } catch (e) {
          console.warn('Failed to logout on backend', e)
        }
      }

      // Reset state
      this.token = null
      this.tokenType = 'Bearer'
      this.expiresInMs = 0
      this.employeeId = ''
      this.name = ''
      this.role = ''
      this.loginTime = null
      this.isMocked = false
      this.error = null

      // Clear new single key
      localStorage.removeItem('auth_session')

      // Clear old individual keys (clean up legacy data if any)
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_token_type')
      localStorage.removeItem('auth_expires_in')
      localStorage.removeItem('auth_employee_id')
      localStorage.removeItem('auth_name')
      localStorage.removeItem('auth_role')
      localStorage.removeItem('auth_login_time')
      localStorage.removeItem('auth_hub')
      localStorage.removeItem('auth_is_mocked')

      // Redirect to login view
      router.push('/login')
    }
  }
})
