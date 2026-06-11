import { createRouter, createWebHistory } from 'vue-router'
import Login from '../components/auth/Login.vue'
import SignUp from '../components/auth/SignUp.vue'
import Dashboard from '../components/dashboard/Dashboard.vue'
import ManagerDashboard from '../components/dashboard/ManagerDashboard.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    redirect: () => {
      const authStore = useAuthStore()
      if (authStore.isAuthenticated) {
        return (authStore.role === 'FLEET_MANAGER' || authStore.role === 'ADMIN') ? '/manager/dashboard' : '/dashboard'
      }
      return '/login'
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresGuest: true }
  },
  {
    path: '/signup',
    name: 'SignUp',
    component: SignUp,
    meta: { requiresGuest: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true, requiredRole: 'DISPATCHER' }
  },
  {
    path: '/manager/dashboard',
    name: 'ManagerDashboard',
    component: ManagerDashboard,
    meta: { requiresAuth: true, requiredRole: ['FLEET_MANAGER', 'ADMIN'] }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // Redirect to the unified login screen
      next('/login')
    } else {
      // User is authenticated, check role requirements
      const requiredRole = to.meta.requiredRole
      const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
      if (requiredRole && !requiredRoles.includes(authStore.role)) {
        // Terminals are siloed, route user to their correct dashboard
        if (authStore.role === 'FLEET_MANAGER' || authStore.role === 'ADMIN') {
          next('/manager/dashboard')
        } else {
          next('/dashboard')
        }
      } else {
        next()
      }
    }
  } else if (to.meta.requiresGuest) {
    if (authStore.isAuthenticated) {
      // Authenticated users cannot go to guest pages (login/register)
      if (authStore.role === 'FLEET_MANAGER' || authStore.role === 'ADMIN') {
        next('/manager/dashboard')
      } else {
        next('/dashboard')
      }
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router
