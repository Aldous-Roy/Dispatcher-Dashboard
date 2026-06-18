import { createRouter, createWebHistory } from 'vue-router'
import Login from '../components/auth/Login.vue'
import SignUp from '../components/auth/SignUp.vue'
import Dashboard from '../components/dashboard/Dashboard.vue'
import ManagerDashboard from '../components/dashboard/ManagerDashboard.vue'
import RouteDetails from '../components/dashboard/RouteDetails.vue'
import Users from '../components/dashboard/Users.vue'
import Drivers from '../components/dashboard/Drivers.vue'
import RoutesList from '../components/dashboard/Routes.vue'
import VisualRoutes from '../components/dashboard/VisualRoutes.vue'
import Stops from '../components/dashboard/Stops.vue'
import Tracking from '../components/dashboard/Tracking.vue'
import CustomerReschedule from '../components/dashboard/CustomerReschedule.vue'
import { useAuthStore } from '../stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresGuest?: boolean
    requiredRole?: string | string[]
  }
}

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
    meta: { requiresAuth: true, requiredRole: ['DISPATCHER', 'SUPER_ADMIN'] }
  },
  {
    path: '/manager/dashboard',
    name: 'ManagerDashboard',
    component: ManagerDashboard,
    meta: { requiresAuth: true, requiredRole: ['FLEET_MANAGER', 'ADMIN'] }
  },
  {
    path: '/users',
    name: 'Users',
    component: Users,
    meta: { requiresAuth: true, requiredRole: ['DISPATCHER', 'SUPER_ADMIN'] }
  },
  {
    path: '/drivers',
    name: 'Drivers',
    component: Drivers,
    meta: { requiresAuth: true, requiredRole: ['DISPATCHER', 'SUPER_ADMIN'] }
  },
  {
    path: '/drivers/:driverId',
    name: 'DriverDetails',
    component: Drivers,
    meta: { requiresAuth: true, requiredRole: ['DISPATCHER', 'SUPER_ADMIN'] }
  },
  {
    path: '/routes',
    name: 'Routes',
    component: RoutesList,
    meta: { requiresAuth: true, requiredRole: ['DISPATCHER', 'SUPER_ADMIN'] }
  },
  {
    path: '/visual-routes',
    name: 'VisualRoutes',
    component: VisualRoutes,
    meta: { requiresAuth: true, requiredRole: ['DISPATCHER', 'SUPER_ADMIN'] }
  },
  {
    path: '/routes/:id',
    name: 'RouteDetails',
    component: RouteDetails,
    meta: { requiresAuth: true, requiredRole: ['DISPATCHER', 'SUPER_ADMIN'] }
  },
  {
    path: '/stops',
    name: 'Stops',
    component: Stops,
    meta: { requiresAuth: true, requiredRole: ['DISPATCHER', 'SUPER_ADMIN'] }
  },
  {
    path: '/tracking',
    name: 'Tracking',
    component: Tracking,
    meta: { requiresAuth: true, requiredRole: ['DISPATCHER', 'SUPER_ADMIN'] }
  },
  {
    path: '/reschedule/:orderId',
    name: 'CustomerReschedule',
    component: CustomerReschedule
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

router.beforeEach((to) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // Redirect to the unified login screen
      return '/login'
    } else {
      // User is authenticated, check role requirements
      const requiredRole = to.meta.requiredRole
      const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
      if (requiredRole && !requiredRoles.includes(authStore.role)) {
        // Terminals are siloed, route user to their correct dashboard
        if (authStore.role === 'FLEET_MANAGER' || authStore.role === 'ADMIN') {
          return '/manager/dashboard'
        } else {
          return '/dashboard'
        }
      }
    }
  } else if (to.meta.requiresGuest) {
    if (authStore.isAuthenticated) {
      // Authenticated users cannot go to guest pages (login/register)
      if (authStore.role === 'FLEET_MANAGER' || authStore.role === 'ADMIN') {
        return '/manager/dashboard'
      } else {
        return '/dashboard'
      }
    }
  }
})

export default router
