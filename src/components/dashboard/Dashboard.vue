<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import CSVUpload from '../common/CSVUpload.vue'
import type { ParsedStop } from '../common/CSVUpload.vue'
import apiClient from '../../services/api'
import DashboardLayout from '../common/DashboardLayout.vue'
import { useWebsocket } from '../../composables/useWebsocket'

const router = useRouter()

const navigateToRoute = (routeId?: string) => {
  if (routeId) {
    router.push(`/routes/${routeId}`)
  }
}

interface Stop {
  id: string // maps to orderId
  address: string // maps to deliveryAddress
  customerName: string
  customerPhone?: string
  packageCount: number
  priority: 'High' | 'Medium' | 'Low'
  latitude: number
  longitude: number
  geocoding: boolean
  status: 'PENDING' | 'ROUTED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED'
  failedReasonNotes?: string | null
  rescheduledDate?: string | null
}

// Emits left for backwards compatibility if needed, but we route directly
const emit = defineEmits(['logout'])

// Active tab view: 'fleet' (original overview), 'planner' (route planning board), 'routes' (routes list), or 'exceptions' (exceptions console)
const currentTab = ref<'fleet' | 'planner' | 'routes' | 'exceptions'>('fleet')

// Drag & Drop State tracking
const draggedStopId = ref('')
const draggedFromLane = ref('')
const activeDragOverLane = ref('')

// Publishing State
const isPublishing = ref(false)
const showPublishSuccess = ref(false)

// Unassigned Stops Queue
const pendingStops = ref<Stop[]>([])

interface Driver {
  id: string
  name: string
  status: string
  phone: string
  routeCode?: string
  routeId?: string
  routeStatus?: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  stopsList: Stop[]
}

// Active Reactive Driver State loaded dynamically
const activeDrivers = ref<Driver[]>([])

interface DashboardData {
  totalUsers: number
  totalDrivers: number
  activeDrivers: number
  totalRoutes: number
  routesByStatus: {
    DRAFT: number
    PUBLISHED: number
    ACTIVE: number
    COMPLETED: number
    CANCELLED: number
  }
  ordersByStatus: {
    PENDING: number
    ROUTED: number
    OUT_FOR_DELIVERY: number
    DELIVERED: number
    FAILED: number
  }
  deliveredToday: number
  pendingPods: number
}

const dashboardMetrics = ref<DashboardData | null>(null)

const loadDashboardMetrics = async () => {
  try {
    const response = await apiClient.get('/dashboard/summary')
    if (response.data && response.data.status === 'success') {
      dashboardMetrics.value = response.data.data
      return // Exit on success
    }
  } catch (err) {
    console.warn('Failed to load dashboard metrics from API, falling back to static metrics:', err)
  }
  
  // Fallback to zeros if API fails (Commented out per request)
  /*
  dashboardMetrics.value = {
    totalUsers: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    totalRoutes: 0,
    routesByStatus: {
      DRAFT: 0,
      PUBLISHED: 0,
      ACTIVE: 0,
      COMPLETED: 0,
      CANCELLED: 0
    },
    ordersByStatus: {
      PENDING: 0,
      ROUTED: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      FAILED: 0
    },
    deliveredToday: 0,
    pendingPods: 0
  }
  */
}

const mapApiStop = (apiStop: any): Stop => {
  return {
    id: apiStop.orderId,
    address: apiStop.deliveryAddress || apiStop.address || 'Unknown Address',
    customerName: apiStop.customerName || 'Unknown Customer',
    customerPhone: apiStop.customerPhone || '',
    packageCount: apiStop.packageCount || (apiStop.packageWeightKg ? Math.ceil(apiStop.packageWeightKg / 1.5) : 1),
    priority: apiStop.requiredPodType === 'PHOTO_REQUIRED' ? 'High' : 'Medium',
    latitude: apiStop.latitude || 12.9715987,
    longitude: apiStop.longitude || 77.594566,
    geocoding: false,
    status: apiStop.status || 'PENDING',
    failedReasonNotes: apiStop.failedReasonNotes || null,
    rescheduledDate: apiStop.rescheduledDate || null
  }
}

const loadAndSeedDrivers = async () => {
  try {
    // 1. Load drivers
    const response = await apiClient.get('/drivers')
    if (!response.data || response.data.status !== 'success') {
      console.warn('Failed to load drivers from API')
      return
    }
    const apiDrivers = response.data.data?.content || response.data.data || []

    // 2. Load all routes
    let apiRoutes: any[] = []
    try {
      const routesRes = await apiClient.get('/routes?size=100')
      if (routesRes.data && routesRes.data.status === 'success') {
        apiRoutes = routesRes.data.data?.content || routesRes.data.data || []
      }
    } catch (err) {
      console.warn('API call failed to load routes:', err)
    }

    // 3. For each route, load stops
    const routesWithStops = await Promise.all(
      apiRoutes.map(async (route: any) => {
        let stops: any[] = []
        try {
          const stopsRes = await apiClient.get(`/routes/${route.routeId}/stops?size=100`)
          if (stopsRes.data && stopsRes.data.status === 'success') {
            stops = stopsRes.data.data?.content || stopsRes.data.data || []
          }
        } catch (err) {
          console.warn(`Failed to load stops for route ${route.routeId}:`, err)
        }
        return {
          ...route,
          stops: stops.map(mapApiStop)
        }
      })
    )

    // 4. Map and pair drivers with backend routes
    activeDrivers.value = apiDrivers.map((apiDriver: any) => {
      const assignedRoute = routesWithStops.find(
        (r: any) => r.driverId === apiDriver.driverId || r.driverId === apiDriver.employeeId
      )
      const fullName = `${apiDriver.firstName} ${apiDriver.lastName}`
      return {
        id: apiDriver.employeeId || `DRV-${apiDriver.driverId}`,
        name: fullName,
        status: apiDriver.active ? 'Active' : 'Inactive',
        phone: apiDriver.phoneNumber ? `+91 ${apiDriver.phoneNumber}` : '+91 99999 99999',
        routeId: assignedRoute?.routeId,
        routeCode: assignedRoute?.routeCode,
        routeStatus: assignedRoute?.status,
        stopsList: assignedRoute?.stops || []
      }
    })

    // 5. Populate masterRoutes for the Routes list tab without making duplicate requests
    masterRoutes.value = routesWithStops.map((route: any) => {
      const matchedDriver = apiDrivers.find(
        (d: any) => d.driverId === route.driverId || d.employeeId === route.driverId
      )
      const driverName = matchedDriver ? `${matchedDriver.firstName} ${matchedDriver.lastName}` : null
      return {
        routeId: route.routeId,
        routeCode: route.routeCode,
        routeDate: route.routeDate,
        driverName,
        stopsCount: route.stops?.length || 0,
        status: route.status
      }
    })
  } catch (err) {
    console.error('Error synchronizing drivers, routes, and stops:', err)
  }
}

const failedStops = ref<Stop[]>([])
const loadingExceptions = ref(false)

interface ExceptionAlert {
  id: string
  orderId: string
  customerName: string
  address: string
  failedReasonNotes: string
  timestamp: string
}
const activeAlerts = ref<ExceptionAlert[]>([])

const loadStopsAndExceptions = async () => {
  loadingExceptions.value = true
  try {
    const response = await apiClient.get('/stops', {
      params: { size: 1000, sort: 'updatedAt,desc' }
    })
    if (response.data && response.data.status === 'success') {
      const allStops = response.data.data?.content || response.data.data || []
      const mapped = allStops.map(mapApiStop)
      pendingStops.value = mapped.filter((s: Stop) => s.status === 'PENDING')
      failedStops.value = mapped.filter((s: Stop) => s.status === 'FAILED')
    }
  } catch (err) {
    console.error('Failed to load stops and exceptions:', err)
  } finally {
    loadingExceptions.value = false
  }
}

const rescheduleStop = async (stop: Stop) => {
  try {
    const res = await apiClient.patch(`/stops/${stop.id}/status`, {
      status: 'PENDING',
      failedReasonNotes: null
    })
    if (res.data && res.data.status === 'success') {
      await loadAndSeedDrivers()
      await loadStopsAndExceptions()
    }
  } catch (err) {
    console.error(`Failed to reschedule stop ${stop.id}:`, err)
  }
}

const reassignStop = async (stopId: string, routeId: string) => {
  try {
    const assignRes = await apiClient.post(`/routes/${routeId}/assign-orders`, {
      orderIds: [stopId]
    })
    if (assignRes.data && assignRes.data.status === 'success') {
      await apiClient.patch(`/stops/${stopId}/status`, {
        status: 'ROUTED',
        failedReasonNotes: null
      })
      await loadAndSeedDrivers()
      await loadStopsAndExceptions()
    }
  } catch (err) {
    console.error(`Failed to reassign stop ${stopId} to route ${routeId}:`, err)
  }
}

const handleReassignDropdown = async (event: Event, stopId: string) => {
  const selectEl = event.target as HTMLSelectElement
  const routeId = selectEl.value
  if (!routeId) return
  await reassignStop(stopId, routeId)
  selectEl.value = ""
}

const {
  connect: connectWs,
  disconnect: disconnectWs,
  subscribeToHighPriorityAlerts
} = useWebsocket()

const handleHighPriorityAlert = (payload: any) => {
  console.log('High-priority fail alert received via WebSocket:', payload)
  const newAlert: ExceptionAlert = {
    id: Date.now().toString() + Math.random().toString().slice(2, 6),
    orderId: payload.orderId || payload.id || 'Unknown Order',
    customerName: payload.customerName || 'Unknown Customer',
    address: payload.deliveryAddress || payload.address || 'Unknown Address',
    failedReasonNotes: payload.failedReasonNotes || payload.reason || 'No details provided',
    timestamp: new Date().toLocaleTimeString()
  }
  activeAlerts.value.push(newAlert)
  setTimeout(() => {
    dismissAlert(newAlert.id)
  }, 10000)
  
  loadStopsAndExceptions()
  loadAndSeedDrivers()
}

const dismissAlert = (id: string) => {
  activeAlerts.value = activeAlerts.value.filter(a => a.id !== id)
}

const viewExceptionConsole = () => {
  currentTab.value = 'exceptions'
  activeAlerts.value = []
}

onMounted(() => {
  loadAndSeedDrivers()
  loadDashboardMetrics()
  loadStopsAndExceptions()
  
  connectWs()
  subscribeToHighPriorityAlerts(handleHighPriorityAlert)
})

onUnmounted(() => {
  disconnectWs()
})

// DYNAMIC STATS COMPUTATIONS
const activeDriversCount = computed(() => {
  if (dashboardMetrics.value) {
    return dashboardMetrics.value.totalDrivers
  }
  return activeDrivers.value.length
})

const activeFleetsCount = computed(() => {
  if (dashboardMetrics.value) {
    return dashboardMetrics.value.activeDrivers
  }
  // Counts drivers that have active (pending) stops assigned and are not marked complete
  return activeDrivers.value.filter(d => 
    d.stopsList.some(s => s.status === 'PENDING') && d.status !== 'Completed'
  ).length
})

const totalCompletedStops = computed(() => {
  if (dashboardMetrics.value) {
    return dashboardMetrics.value.deliveredToday
  }
  return activeDrivers.value.reduce((acc, d) => 
    acc + d.stopsList.filter(s => s.status === 'DELIVERED').length, 0
  )
})

const totalStopsCount = computed(() => {
  if (dashboardMetrics.value) {
    const obs = dashboardMetrics.value.ordersByStatus
    return obs.PENDING + obs.ROUTED + obs.OUT_FOR_DELIVERY + obs.DELIVERED + obs.FAILED
  }
  const driverStops = activeDrivers.value.reduce((acc, d) => acc + d.stopsList.length, 0)
  return driverStops + pendingStops.value.length
})

const pendingExceptionsCount = computed(() => {
  if (dashboardMetrics.value) {
    return dashboardMetrics.value.pendingPods
  }
  // Count High priority stops that are unassigned (pending) or assigned but not completed
  const pendingHigh = pendingStops.value.filter(s => s.priority === 'High').length
  const driverHigh = activeDrivers.value.reduce((acc, d) => 
    acc + d.stopsList.filter(s => s.priority === 'High' && s.status === 'PENDING').length, 0
  )
  return pendingHigh + driverHigh
})

const routeStatusMap = computed(() => {
  if (dashboardMetrics.value) {
    return dashboardMetrics.value.routesByStatus
  }
  return {
    DRAFT: 0,
    PUBLISHED: 0,
    ACTIVE: 0,
    COMPLETED: 0,
    CANCELLED: 0
  }
})

const orderStatusMap = computed(() => {
  if (dashboardMetrics.value) {
    return dashboardMetrics.value.ordersByStatus
  }
  return {
    PENDING: 0,
    ROUTED: 0,
    OUT_FOR_DELIVERY: 0,
    DELIVERED: 0,
    FAILED: 0
  }
})

const totalOrders = computed(() => {
  if (dashboardMetrics.value) {
    const obs = dashboardMetrics.value.ordersByStatus
    return obs.PENDING + obs.ROUTED + obs.OUT_FOR_DELIVERY + obs.DELIVERED + obs.FAILED
  }
  return 0
})

const getPercentage = (count: number, total: number) => {
  if (total === 0) return 0
  return Math.round((count / total) * 100)
}

// Dynamic Stops Done Fraction for the Overview Table
const getStopRatio = (driver: typeof activeDrivers.value[0]) => {
  const total = driver.stopsList.length
  if (total === 0) return '0/0'
  const completed = driver.stopsList.filter(s => s.status === 'DELIVERED').length
  return `${completed}/${total}`
}

// CSV IMPORT & SIMULATED GEOCODING
const handleStopsLoaded = async (loadedStops: ParsedStop[]) => {
  dashboardMetrics.value = null // Switch to dynamic client-side calculations

  for (const s of loadedStops) {
    const latOffset = (Math.random() - 0.5) * 0.08
    const lngOffset = (Math.random() - 0.5) * 0.08
    const latitude = parseFloat((28.6139 + latOffset).toFixed(5))
    const longitude = parseFloat((77.2090 + lngOffset).toFixed(5))
    const orderId = s.id.startsWith('STP-') ? s.id.replace('STP-', 'ORD-') : s.id

    try {
      // POST to stops API
      await apiClient.post('/stops', {
        orderId,
        routeCode: null,
        customerName: s.customerName,
        customerPhone: '+91 99999 99999',
        deliveryAddress: s.address,
        latitude,
        longitude,
        timeWindowStart: new Date().toISOString().slice(0, 10) + 'T09:00:00',
        timeWindowEnd: new Date().toISOString().slice(0, 10) + 'T18:00:00',
        packageWeightKg: s.packageCount * 1.5,
        packageVolumeCbms: s.packageCount * 0.01,
        serviceTimeMins: 5,
        requiredPodType: s.priority === 'High' ? 'PHOTO_REQUIRED' : 'SIGNATURE_REQUIRED'
      })

      const stopObj: Stop = {
        id: orderId,
        address: s.address,
        customerName: s.customerName,
        customerPhone: '+91 99999 99999',
        packageCount: s.packageCount,
        priority: s.priority,
        latitude,
        longitude,
        geocoding: false,
        status: 'PENDING',
        failedReasonNotes: null
      }
      pendingStops.value.push(stopObj)
    } catch (err) {
      console.error(`Failed to register stop ${orderId} on backend:`, err)
    }
  }
}

// DRAG AND DROP HANDLERS (NATIVE HTML5)
const handleDragStart = (e: DragEvent, stopId: string, fromLane: string) => {
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ stopId, fromLane }))
    e.dataTransfer.effectAllowed = 'move'
  }
  draggedStopId.value = stopId
  draggedFromLane.value = fromLane
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault() // Required to allow drop
}

const handleDrop = (e: DragEvent, toLane: string, targetStopId?: string) => {
  e.preventDefault()
  activeDragOverLane.value = ''
  
  if (!e.dataTransfer) return
  const dataStr = e.dataTransfer.getData('text/plain')
  if (!dataStr) return

  try {
    const { stopId, fromLane } = JSON.parse(dataStr)
    moveStop(stopId, fromLane, toLane, targetStopId)
  } catch (err) {
    console.error('Failed to parse drag drop payload:', err)
  }

  // Clear tracking refs
  draggedStopId.value = ''
  draggedFromLane.value = ''
}

// Shift stops logic supporting inter-lane move and intra-lane sequence reordering
const moveStop = async (stopId: string, fromLane: string, toLane: string, targetStopId?: string) => {
  dashboardMetrics.value = null // Switch to dynamic client-side calculations
  let stopObj: Stop | undefined

  // 1. Extract from origin lane
  if (fromLane === 'pending') {
    const idx = pendingStops.value.findIndex(s => s.id === stopId)
    if (idx !== -1) {
      stopObj = pendingStops.value.splice(idx, 1)[0]
    }
  } else {
    const driver = activeDrivers.value.find(d => d.id === fromLane)
    if (driver) {
      const idx = driver.stopsList.findIndex(s => s.id === stopId)
      if (idx !== -1) {
        stopObj = driver.stopsList.splice(idx, 1)[0]
      }
    }
  }

  if (!stopObj) return

  // 2. Insert into target lane at specific location or at end in UI
  if (toLane === 'pending') {
    stopObj.status = 'PENDING'
    if (targetStopId) {
      const targetIdx = pendingStops.value.findIndex(s => s.id === targetStopId)
      if (targetIdx !== -1) {
        pendingStops.value.splice(targetIdx, 0, stopObj)
      } else {
        pendingStops.value.push(stopObj)
      }
    } else {
      pendingStops.value.push(stopObj)
    }
  } else {
    const driver = activeDrivers.value.find(d => d.id === toLane)
    if (driver) {
      stopObj.status = 'ROUTED'
      if (targetStopId) {
        const targetIdx = driver.stopsList.findIndex(s => s.id === targetStopId)
        if (targetIdx !== -1) {
          driver.stopsList.splice(targetIdx, 0, stopObj)
        } else {
          driver.stopsList.push(stopObj)
        }
      } else {
        driver.stopsList.push(stopObj)
      }
    }
  }

  // 3. Sync with backend database
  try {
    if (toLane === 'pending') {
      await apiClient.patch(`/stops/${stopId}/status`, {
        status: 'PENDING',
        failedReasonNotes: null
      })
    } else {
      const driver = activeDrivers.value.find(d => d.id === toLane)
      if (driver) {
        let routeId = driver.routeId
        let routeCode = driver.routeCode

        // If driver doesn't have a route, create a new DRAFT route
        if (!routeId) {
          routeCode = 'RT-' + driver.id + '-' + Date.now().toString().slice(-6)
          const routeRes = await apiClient.post('/routes', {
            routeCode,
            routeDate: new Date().toISOString().slice(0, 10),
            totalDistanceKm: 32.5,
            estimatedDurationMins: 110,
            routePolyline: 'encoded-polyline-placeholder'
          })

          if (routeRes.data && routeRes.data.status === 'success') {
            routeId = routeRes.data.data.routeId
            // Assign driver to route
            await apiClient.post(`/routes/${routeId}/assign-driver`, {
              driverId: driver.id
            })

            driver.routeId = routeId
            driver.routeCode = routeCode
            driver.routeStatus = 'DRAFT'
          }
        }

        if (routeId) {
          // Assign stop to route
          await apiClient.post(`/routes/${routeId}/assign-orders`, {
            orderIds: [stopId]
          })

          // Update stop status to ROUTED
          await apiClient.patch(`/stops/${stopId}/status`, {
            status: 'ROUTED',
            failedReasonNotes: null
          })
        }
      }
    }
  } catch (err) {
    console.error('Failed to sync stop assignment with backend API:', err)
  }
}

const unassignStop = async (stopId: string, driverId: string) => {
  dashboardMetrics.value = null // Switch to dynamic client-side calculations
  const driver = activeDrivers.value.find(d => d.id === driverId)
  if (!driver) return
  
  const idx = driver.stopsList.findIndex(s => s.id === stopId)
  if (idx !== -1) {
    const stop = driver.stopsList.splice(idx, 1)[0]
    stop.status = 'PENDING'
    pendingStops.value.push(stop)

    try {
      await apiClient.patch(`/stops/${stopId}/status`, {
        status: 'PENDING',
        failedReasonNotes: null
      })
    } catch (err) {
      console.error(`Failed to unassign stop ${stopId} on backend:`, err)
    }
  }
}

const publishRoute = async (driver: Driver) => {
  if (!driver.routeId) return
  try {
    const res = await apiClient.post(`/routes/${driver.routeId}/publish`)
    if (res.data && res.data.status === 'success') {
      driver.routeStatus = 'PUBLISHED'
    }
  } catch (err) {
    console.error(`Failed to publish route ${driver.routeId}:`, err)
  }
}

const activateRoute = async (driver: Driver) => {
  if (!driver.routeId) return
  try {
    const res = await apiClient.post(`/routes/${driver.routeId}/activate`)
    if (res.data && res.data.status === 'success') {
      driver.routeStatus = 'ACTIVE'
    }
  } catch (err) {
    console.error(`Failed to activate route ${driver.routeId}:`, err)
  }
}

const cancelRoute = async (driver: Driver) => {
  if (!driver.routeId) return
  try {
    const res = await apiClient.post(`/routes/${driver.routeId}/cancel`)
    if (res.data && res.data.status === 'success') {
      driver.routeStatus = 'CANCELLED'
    }
  } catch (err) {
    console.error(`Failed to cancel route ${driver.routeId}:`, err)
  }
}

const completeRoute = async (driver: Driver) => {
  if (!driver.routeId) return
  try {
    const res = await apiClient.post(`/routes/${driver.routeId}/complete`)
    if (res.data && res.data.status === 'success') {
      driver.routeStatus = 'COMPLETED'
    }
  } catch (err) {
    console.error(`Failed to complete route ${driver.routeId}:`, err)
  }
}

// Pushes current layout configuration to simulated API
const publishRoutes = async () => {
  isPublishing.value = true
  try {
    const draftDrivers = activeDrivers.value.filter(d => d.routeId && d.routeStatus === 'DRAFT')
    await Promise.all(draftDrivers.map(publishRoute))
    showPublishSuccess.value = true
    // Dismiss toast after delay
    setTimeout(() => {
      showPublishSuccess.value = false
    }, 4500)
  } catch (err) {
    console.error('Failed to publish draft routes:', err)
  } finally {
    isPublishing.value = false
  }
}

const isAllocating = ref(false)
const autoAllocate = async () => {
  isAllocating.value = true
  try {
    const res = await apiClient.post('/routes/auto-allocate')
    if (res.data && res.data.status === 'success') {
      await loadAndSeedDrivers()
      await loadStopsAndExceptions()
      alert('Routes auto-allocated successfully based on performance!')
    } else {
      throw new Error(res.data.message || 'Auto-allocation failed')
    }
  } catch (err: any) {
    alert(err.response?.data?.message || err.message || 'Failed to auto-allocate routes')
  } finally {
    isAllocating.value = false
  }
}

const startDelivery = async (stop: Stop) => {
  try {
    const res = await apiClient.post(`/stops/${stop.id}/start-delivery`)
    if (res.data && res.data.status === 'success') {
      stop.status = 'OUT_FOR_DELIVERY'
    }
  } catch (err) {
    console.error(`Failed to start delivery for stop ${stop.id}:`, err)
  }
}

const completeDelivery = async (stop: Stop) => {
  try {
    const res = await apiClient.post(`/stops/${stop.id}/complete-delivery`)
    if (res.data && res.data.status === 'success') {
      stop.status = 'DELIVERED'
    }
  } catch (err) {
    console.error(`Failed to complete delivery for stop ${stop.id}:`, err)
  }
}

const failDelivery = (stop: Stop) => {
  failStopItem.value = stop
  failReason.value = 'Customer not available'
  customFailReason.value = ''
  failError.value = null
  showFailModal.value = true
}

const submitFailDelivery = async () => {
  if (!failStopItem.value) return
  
  const finalReason = failReason.value === 'Other' ? customFailReason.value.trim() : failReason.value
  if (!finalReason) {
    failError.value = 'Please enter a valid failure reason'
    return
  }
  
  failSubmitting.value = true
  failError.value = null
  
  try {
    const res = await apiClient.post(`/stops/${failStopItem.value.id}/fail-delivery`, {
      reason: finalReason
    })
    if (res.data && res.data.status === 'success') {
      if (failStopItem.value) {
        failStopItem.value.status = 'FAILED'
        failStopItem.value.failedReasonNotes = finalReason
      }
      showFailModal.value = false
      await loadAndSeedDrivers()
      await loadStopsAndExceptions()
    } else {
      throw new Error(res.data.message || 'Action failed')
    }
  } catch (err: any) {
    console.error('Failed to fail delivery:', err)
    failError.value = err.response?.data?.message || err.message || 'Failed to update stop'
  } finally {
    failSubmitting.value = false
  }
}

interface MasterRoute {
  routeId: string
  routeCode: string
  routeDate: string
  driverName: string | null
  stopsCount: number
  status: string
}
// Custom Fail Reason Modal State for Dashboard
const showFailModal = ref(false)
const failStopItem = ref<Stop | null>(null)
const failReason = ref('Customer not available')
const customFailReason = ref('')
const failSubmitting = ref(false)
const failError = ref<string | null>(null)

const masterRoutes = ref<MasterRoute[]>([])

const syncRoutesList = async () => {
  try {
    const routesRes = await apiClient.get('/routes?size=100')
    if (routesRes.data && routesRes.data.status === 'success') {
      const apiRoutes = routesRes.data.data?.content || routesRes.data.data || []
      
      let apiDrivers: any[] = []
      try {
        const drvRes = await apiClient.get('/drivers')
        if (drvRes.data && drvRes.data.status === 'success') {
          apiDrivers = drvRes.data.data?.content || drvRes.data.data || []
        }
      } catch (e) {
        console.warn('Failed to load drivers for master list:', e)
      }
      
      masterRoutes.value = await Promise.all(apiRoutes.map(async (route: any) => {
        let stopsCount = 0
        try {
          const stopsRes = await apiClient.get(`/routes/${route.routeId}/stops?size=1`)
          if (stopsRes.data && stopsRes.data.status === 'success') {
            stopsCount = stopsRes.data.data?.totalElements || stopsRes.data.data?.length || 0
          }
        } catch (e) {
          console.warn('Failed to get stops count for route:', route.routeId)
        }
        
        const matchedDriver = apiDrivers.find(
          (d: any) => d.driverId === route.driverId || d.employeeId === route.driverId
        )
        const driverName = matchedDriver ? `${matchedDriver.firstName} ${matchedDriver.lastName}` : null
        
        return {
          routeId: route.routeId,
          routeCode: route.routeCode,
          routeDate: route.routeDate,
          driverName,
          stopsCount,
          status: route.status
        }
      }))
    }
  } catch (err) {
    console.error('Failed to sync master routes list:', err)
  }
}
</script>

<template>
  <DashboardLayout>
    <!-- Page title and Tab switcher section -->
    <div class="page-title-section" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div>
        <h1>Dispatch Hub</h1>
        <p class="subtitle">Real-time dispatch system monitoring, geocoding and corridor routing sequences</p>
      </div>
      <!-- Tab Toggles -->
      <div class="tabs-navigation-header" style="display: flex; gap: 8px; background-color: var(--color-gray-100); padding: 4px; border-radius: 8px; border: 1.5px solid var(--color-gray-200);">
        <button 
          @click="currentTab = 'fleet'" 
          :class="{ active: currentTab === 'fleet' }" 
          style="padding: 6px 14px; border: none; background: none; font-size: 12.5px; font-weight: 700; border-radius: 6px; cursor: pointer; color: var(--color-gray-500); transition: all 0.2s; font-family: var(--font-sans);"
          class="header-tab-btn"
        >
          Summary Overview
        </button>
        <button 
          @click="currentTab = 'planner'" 
          :class="{ active: currentTab === 'planner' }" 
          style="padding: 6px 14px; border: none; background: none; font-size: 12.5px; font-weight: 700; border-radius: 6px; cursor: pointer; color: var(--color-gray-500); transition: all 0.2s; font-family: var(--font-sans);"
          class="header-tab-btn"
        >
          Route & Load Planner
        </button>
        <button 
          @click="currentTab = 'exceptions'" 
          :class="{ active: currentTab === 'exceptions' }" 
          style="padding: 6px 14px; border: none; background: none; font-size: 12.5px; font-weight: 700; border-radius: 6px; cursor: pointer; color: var(--color-gray-500); transition: all 0.2s; font-family: var(--font-sans); display: flex; align-items: center;"
          class="header-tab-btn"
        >
          Exceptions Console
          <span v-if="failedStops.length > 0" class="badge-count exception-badge">{{ failedStops.length }}</span>
        </button>
      </div>
    </div>

      <!-- Quick Stats / KPI Cards (Dynamically computed from stops) -->
      <section class="stats-panel">
        <div class="stat-card">
          <div class="icon-wrap bg-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A2.25 2.25 0 0 1 12.75 21.5h-1.5a2.25 2.25 0 0 1-2.25-2.263V19.13M8.625 19.5a9.38 9.38 0 0 1-2.625.372 9.337 9.337 0 0 1-4.121-.952 4.125 4.125 0 0 1 7.533-2.493M8.625 19.5v-.003c0-1.113.285-2.16.786-3.07M8.625 19.5V19.13m4.846-8.19A2.225 2.225 0 0 0 13.5 10.5h-3a2.225 2.225 0 0 0-1.229.44M12 13.5v-1.5m0 0a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5z" />
            </svg>
          </div>
          <div class="stat-info">
            <span class="value">{{ activeFleetsCount }} / {{ activeDriversCount }}</span>
            <span class="label">Active Routed Fleets</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="icon-wrap bg-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div class="stat-info">
            <span class="value">{{ totalCompletedStops }} / {{ totalStopsCount }}</span>
            <span class="label">Stops Completed</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="icon-wrap bg-dark">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div class="stat-info text-danger-pulse">
            <span class="value">{{ pendingExceptionsCount }}</span>
            <span class="label">Pending Priority Items</span>
          </div>
        </div>

        <!-- Removed Assigned Node Terminal card -->
      </section>

      <!-- VIEW PANES -->
      
      <!-- Tab 1: Original Fleet Console Overview -->
      <div v-if="currentTab === 'fleet'" class="tab-pane">
        <div class="analytics-grid">
          <!-- Route & Order Analytics Panel -->
          <section class="analytics-panel">
            <div class="card-header">
              <h3>Today's Overview</h3>
              <span class="badge-live">LIVE STATUS</span>
            </div>
            <div class="analytics-content">
              <!-- Route Status Breakdown -->
              <div class="analytics-block">
                <h4>Routes Distribution (Total: {{ dashboardMetrics?.totalRoutes || 0 }})</h4>
                <div class="status-bars">
                  <div v-for="(count, status) in routeStatusMap" :key="status" class="status-bar-row">
                    <span class="status-label">{{ status }}</span>
                    <div class="progress-track">
                      <div class="progress-fill" :class="status.toLowerCase()" :style="{ width: getPercentage(count, dashboardMetrics?.totalRoutes || 0) + '%' }"></div>
                    </div>
                    <span class="status-count">{{ count }}</span>
                  </div>
                </div>
              </div>

              <!-- Order Status Breakdown -->
              <div class="analytics-block">
                <h4>Orders Breakdown (Total: {{ totalOrders }})</h4>
                <div class="status-bars">
                  <div v-for="(count, status) in orderStatusMap" :key="status" class="status-bar-row">
                    <span class="status-label">{{ status.replace(/_/g, ' ') }}</span>
                    <div class="progress-track">
                      <div class="progress-fill" :class="status.toLowerCase()" :style="{ width: getPercentage(count, totalOrders) + '%' }"></div>
                    </div>
                    <span class="status-count">{{ count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Active Driver Terminals Table -->
          <section class="table-section">
            <div class="card-header">
              <h3>Active Drivers</h3>
              <span class="badge-live">LIVE UPDATES ACTIVE</span>
            </div>

            <div class="table-wrapper">
              <table class="fleet-table">
                <thead>
                  <tr>
                    <th>Driver ID</th>
                    <th>Name</th>
                    <th>Assigned Corridor</th>
                    <th>Stops Done</th>
                    <th>Operational Status</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="driver in activeDrivers" :key="driver.id">
                    <td class="driver-id">{{ driver.id }}</td>
                    <td class="driver-name">{{ driver.name }}</td>
                    <td class="driver-route">
                      <span 
                        v-if="driver.routeCode" 
                        class="route-badge-link" 
                        @click="navigateToRoute(driver.routeId)"
                        title="View Route Details"
                      >
                        {{ driver.routeCode }}
                      </span>
                      <span v-else class="not-assigned">Not Assigned</span>
                    </td>
                    <td class="driver-stops">{{ getStopRatio(driver) }}</td>
                    <td>
                      <span class="status-pill" :class="driver.status.toLowerCase().replace(' ', '-')">
                        <span class="dot"></span>
                        {{ driver.status }}
                      </span>
                    </td>
                    <td class="driver-phone">{{ driver.phone }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <!-- Tab 2: Route & Load Planner (Draggable Lanes & CSV Upload) -->
      <div v-else-if="currentTab === 'planner'" class="tab-pane">
        <div class="planner-layout">
          
          <!-- Sidebar: CSV Upload & Pending Stops Queue -->
          <div class="planner-sidebar">
            <CSVUpload @stops-loaded="handleStopsLoaded" />
            
            <div 
              class="pending-stops-container"
              :class="{ 'drag-over': activeDragOverLane === 'pending' }"
              @dragover="handleDragOver"
              @dragenter="activeDragOverLane = 'pending'"
              @dragleave="activeDragOverLane = ''"
              @drop="handleDrop($event, 'pending')"
            >
              <div class="sidebar-header">
                <h4>Pending Dispatch Queue</h4>
                <span class="stops-count">{{ pendingStops.length }} stops</span>
              </div>
              
              <div v-if="pendingStops.length === 0" class="empty-lane-placeholder">
                <p>Queue is empty.</p>
                <p class="sub">Import a CSV file or drag stops here to unassign them.</p>
              </div>
              
              <div class="stops-scrollable">
                <div 
                  v-for="stop in pendingStops" 
                  :key="stop.id"
                  class="stop-card"
                  :class="[stop.priority.toLowerCase()]"
                  draggable="true"
                  @dragstart="handleDragStart($event, stop.id, 'pending')"
                  @dragover.prevent
                  @drop="handleDrop($event, 'pending', stop.id)"
                >
                  <div class="stop-card-header">
                    <span class="stop-id">{{ stop.id }}</span>
                    <span class="priority-pill" :class="stop.priority.toLowerCase()">
                      {{ stop.priority }}
                    </span>
                  </div>
                  
                  <div class="stop-details">
                    <div class="cust-name">{{ stop.customerName }}</div>
                    <div class="stop-address">{{ stop.address }}</div>
                  </div>
                  
                  <div class="stop-card-footer">
                    <span class="package-count">📦 {{ stop.packageCount }} pkg</span>
                    <div class="geocode-box">
                      <span v-if="stop.geocoding" class="geocoding-spinner">
                        <span class="spinner-dot"></span> Geocoding...
                      </span>
                      <span v-else class="coords">
                        📍 {{ stop.latitude }}, {{ stop.longitude }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Route Board: Draggable Driver Columns -->
          <div class="planner-board">
            <div class="board-header">
              <div class="board-info">
                <h3>Assigned Routes</h3>
                <p>Drag stops up and down to resequence. Drag stops between lanes to reassign drivers.</p>
              </div>
              <div class="board-actions" style="display: flex; gap: 8px;">
                <button 
                  @click="autoAllocate" 
                  class="btn-auto-allocate" 
                  :disabled="isAllocating"
                  style="background-color: var(--color-primary-dark); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; transition: all 0.2s;"
                >
                  <span v-if="isAllocating">Allocating...</span>
                  <span v-else>Auto-Allocate Routes</span>
                </button>
                <button 
                  @click="publishRoutes" 
                  class="btn-publish" 
                  :disabled="isPublishing"
                >
                  <span v-if="isPublishing" class="loading-state">
                    <svg class="spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="spinner-track"></circle>
                      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" class="spinner-head"></path>
                    </svg>
                    Staging dispatch...
                  </span>
                  <span v-else>Publish Dispatch Schedules</span>
                </button>
              </div>
            </div>
            
            <div class="driver-lanes-wrapper">
              <div 
                v-for="driver in activeDrivers" 
                :key="driver.id"
                class="driver-lane"
                :class="{ 'drag-over': activeDragOverLane === driver.id }"
                @dragover="handleDragOver"
                @dragenter="activeDragOverLane = driver.id"
                @dragleave="activeDragOverLane = ''"
                @drop="handleDrop($event, driver.id)"
              >
                <div class="lane-header">
                  <div class="driver-info">
                    <span class="driver-lane-name">{{ driver.name }}</span>
                    <span class="driver-lane-id">{{ driver.id }}</span>
                  </div>
                  <div class="lane-stats" style="flex-wrap: wrap; gap: 4px;">
                    <span 
                      class="route-badge clickable" 
                      v-if="driver.routeCode" 
                      @click="navigateToRoute(driver.routeId)"
                      title="View Route Details"
                    >
                      {{ driver.routeCode }}
                    </span>
                    <span class="route-status-pill" :class="driver.routeStatus?.toLowerCase()" v-if="driver.routeStatus">
                      {{ driver.routeStatus }}
                    </span>
                    <span class="stops-count">{{ driver.stopsList.length }} stops</span>
                  </div>
                  <div class="route-actions" v-if="driver.routeId">
                    <button v-if="driver.routeStatus === 'DRAFT'" class="btn-route-action publish" @click.stop="publishRoute(driver)">
                      Publish
                    </button>
                    <button v-if="driver.routeStatus === 'PUBLISHED'" class="btn-route-action activate" @click.stop="activateRoute(driver)">
                      Activate
                    </button>
                    <button v-if="driver.routeStatus === 'PUBLISHED'" class="btn-route-action cancel" @click.stop="cancelRoute(driver)">
                      Cancel
                    </button>
                    <button v-if="driver.routeStatus === 'ACTIVE'" class="btn-route-action complete" @click.stop="completeRoute(driver)">
                      Complete
                    </button>
                    <button v-if="driver.routeStatus === 'ACTIVE'" class="btn-route-action cancel" @click.stop="cancelRoute(driver)">
                      Cancel
                    </button>
                  </div>
                </div>
                
                <div class="lane-stops-list">
                  <div v-if="driver.stopsList.length === 0" class="empty-lane-placeholder">
                    <p>No stops assigned.</p>
                    <p class="sub">Drag stops here to dispatch.</p>
                  </div>
                  
                  <div 
                    v-for="(stop, index) in driver.stopsList" 
                    :key="stop.id"
                    class="stop-card"
                    :class="[stop.priority.toLowerCase(), { 'completed': stop.status === 'DELIVERED' || stop.status === 'FAILED' }]"
                    :draggable="stop.status === 'PENDING' || stop.status === 'ROUTED'"
                    @dragstart="handleDragStart($event, stop.id, driver.id)"
                    @dragover.prevent
                    @drop="handleDrop($event, driver.id, stop.id)"
                  >
                    <!-- Delivery Sequence Number -->
                    <div class="stop-index">{{ index + 1 }}</div>
                    
                    <div class="stop-card-body">
                      <div class="stop-card-header">
                        <span class="stop-id">{{ stop.id }}</span>
                        <div class="header-right">
                          <span class="priority-pill" :class="stop.priority.toLowerCase()">
                            {{ stop.priority }}
                          </span>
                          <!-- Unassign Button -->
                          <button 
                            v-if="stop.status === 'ROUTED' || stop.status === 'PENDING'"
                            class="btn-unassign" 
                            @click.stop="unassignStop(stop.id, driver.id)"
                            title="Unassign Stop"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      <div class="stop-details">
                        <div class="cust-name">
                          {{ stop.customerName }}
                          <span class="stop-status-badge" :class="stop.status.toLowerCase()">
                            {{ stop.status.replace(/_/g, ' ') }}
                          </span>
                        </div>
                        <div class="stop-address">{{ stop.address }}</div>
                        <div v-if="stop.failedReasonNotes" class="fail-reason">
                          Reason: {{ stop.failedReasonNotes }}
                        </div>
                      </div>
                      
                      <!-- Stop Actions inside Card -->
                      <div class="stop-actions" v-if="driver.routeStatus === 'ACTIVE'">
                        <button v-if="stop.status === 'ROUTED'" class="btn-stop-action start" @click.stop="startDelivery(stop)">
                          Start Delivery
                        </button>
                        <div v-else-if="stop.status === 'OUT_FOR_DELIVERY'" class="stop-action-group">
                          <button class="btn-stop-action complete" @click.stop="completeDelivery(stop)">
                            Complete
                          </button>
                          <button class="btn-stop-action fail" @click.stop="failDelivery(stop)">
                            Fail
                          </button>
                        </div>
                      </div>
                      
                      <div class="stop-card-footer">
                        <span class="package-count">📦 {{ stop.packageCount }} pkg</span>
                        <div class="geocode-box">
                          <span v-if="stop.geocoding" class="geocoding-spinner">
                            <span class="spinner-dot"></span> Geocoding...
                          </span>
                          <span v-else class="coords">
                            📍 {{ stop.latitude }}, {{ stop.longitude }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 3: Routes Master List -->
      <div v-else-if="currentTab === 'routes'" class="tab-pane">
        <section class="table-section">
          <div class="card-header">
            <h3>Route List</h3>
            <button @click="syncRoutesList" class="btn-publish" style="padding: 6px 12px; font-size: 12px;">
              Refresh Routes List
            </button>
          </div>

          <div class="table-wrapper">
            <table class="fleet-table">
              <thead>
                <tr>
                  <th>Route ID</th>
                  <th>Route Code</th>
                  <th>Route Date</th>
                  <th>Assigned Driver</th>
                  <th>Stops Assigned</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="route in masterRoutes" :key="route.routeId">
                  <td class="driver-id">{{ route.routeId }}</td>
                  <td class="driver-route">
                    <span class="route-badge-link" @click="navigateToRoute(route.routeId)">
                      {{ route.routeCode }}
                    </span>
                  </td>
                  <td>{{ route.routeDate }}</td>
                  <td class="driver-name">{{ route.driverName || 'Unassigned' }}</td>
                  <td class="driver-stops">{{ route.stopsCount }} stops</td>
                  <td>
                    <span class="route-status-pill" :class="route.status.toLowerCase()">
                      {{ route.status }}
                    </span>
                  </td>
                  <td>
                    <button @click="navigateToRoute(route.routeId)" class="btn-stop-action start" style="padding: 4px 10px;">
                      View Details
                    </button>
                  </td>
                </tr>
                <tr v-if="masterRoutes.length === 0">
                  <td colspan="7" class="empty-profile" style="text-align: center; padding: 30px;">
                    No routes currently registered on the server.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Tab 4: Exceptions Console -->
      <div v-else-if="currentTab === 'exceptions'" class="tab-pane">
        <section class="table-section">
          <div class="card-header border-none" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div class="header-left">
              <h3>Delivery Issues</h3>
              <span class="badge-count exception-count-badge">{{ failedStops.length }} failed</span>
            </div>
            <button @click="loadStopsAndExceptions" class="btn-publish" style="padding: 6px 12px; font-size: 12px;">
              Refresh Exception Queue
            </button>
          </div>

          <div v-if="loadingExceptions" class="loading-state-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; color: var(--color-gray-500);">
            <div class="spinner" style="width: 32px; height: 32px; border-width: 3px; margin-bottom: 12px; border: 4px solid var(--color-accent-sage); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s infinite linear;"></div>
            <p>Syncing exception queue...</p>
          </div>

          <div v-else class="table-wrapper">
            <table class="fleet-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Failed Reason / Notes</th>
                  <th>Reschedule Preference</th>
                  <th>Action Needed</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="stop in failedStops" :key="stop.id">
                  <td class="driver-id">{{ stop.id }}</td>
                  <td class="driver-name">
                    {{ stop.customerName }}<br>
                    <small style="color: var(--color-gray-500); font-weight: 500;">{{ stop.customerPhone || '-' }}</small>
                  </td>
                  <td class="address-cell" :title="stop.address">{{ stop.address }}</td>
                  <td style="min-width: 240px;">
                    <div class="fail-reason-box" style="background-color: #fee2e2; color: #b91c1c; padding: 6px 10px; border-radius: 6px; font-size: 12.5px; font-weight: 600; border-left: 3.5px solid #dc2626;">
                      ⚠️ {{ stop.failedReasonNotes || 'No notes provided by driver.' }}
                    </div>
                  </td>
                  <td style="min-width: 180px;">
                    <div v-if="stop.rescheduledDate" style="background-color: #dcfce7; color: #15803d; border-left: 3.5px solid #16a34a; padding: 6px 10px; border-radius: 6px; font-size: 12.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                      📅 {{ stop.rescheduledDate }}
                    </div>
                    <span v-else style="color: var(--color-gray-500); font-style: italic; font-size: 12.5px;">
                      No request yet
                    </span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <!-- Reschedule (Reset to pending) -->
                      <button @click="rescheduleStop(stop)" class="btn-stop-action start" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px;">
                        Reschedule Stop
                      </button>
                      
                      <!-- Reassign directly to a driver's route -->
                      <div class="reassign-dropdown-wrapper">
                        <select 
                          @change="handleReassignDropdown($event, stop.id)"
                          style="padding: 6px 10px; border: 1.5px solid var(--color-gray-200); border-radius: 6px; font-size: 11.5px; font-weight: 600; outline: none; background-color: var(--color-white); cursor: pointer;"
                        >
                          <option value="" disabled selected>Reassign operator...</option>
                          <option v-for="driver in activeDrivers.filter(d => d.routeId)" :key="driver.id" :value="driver.routeId">
                            {{ driver.name }} ({{ driver.routeCode }})
                          </option>
                        </select>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-if="failedStops.length === 0">
                  <td colspan="5" style="text-align: center; padding: 40px; color: var(--color-gray-500); font-weight: 600;">
                    🎉 No delivery exceptions found. All systems operational!
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

    <!-- Success Staging Toast Notification -->
    <transition name="toast">
      <div v-if="showPublishSuccess" class="publish-success-toast">
        <div class="toast-content">
          <div class="toast-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div class="toast-text">
            <h5>Dispatch Staging Success</h5>
            <p>Delivery sequences staged 12 hours in advance. Driver terminals synchronized successfully.</p>
          </div>
        </div>
      </div>
    </transition>

    <!-- High-Priority Failure WebSocket Toast Notification Banner -->
    <div class="high-priority-toast-container">
      <transition-group name="toast-fade">
        <div 
          v-for="alert in activeAlerts" 
          :key="alert.id" 
          class="high-priority-alert-toast"
        >
          <div class="toast-content-wrapper">
            <div class="toast-warning-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div class="toast-text-details">
              <div class="toast-alert-title">🚨 HIGH-PRIORITY DELIVERY FAILED</div>
              <div class="toast-order-info">
                <strong>Order:</strong> {{ alert.orderId }} | <strong>Cust:</strong> {{ alert.customerName }}
              </div>
              <div class="toast-reason-text">
                <strong>Notes:</strong> {{ alert.failedReasonNotes }}
              </div>
              <div class="toast-timestamp-text">{{ alert.timestamp }}</div>
            </div>
          </div>
          <div class="toast-actions-row">
            <button @click="viewExceptionConsole" class="toast-btn-action view">
              Reschedule / Reassign
            </button>
            <button @click="dismissAlert(alert.id)" class="toast-btn-action dismiss">
              Acknowledge
            </button>
          </div>
        </div>
      </transition-group>
    </div>

    <!-- Custom Fail Reason Modal -->
    <div class="details-drawer-overlay" v-if="showFailModal" @click="showFailModal = false" style="justify-content: center; align-items: center;">
      <div class="custom-modal" @click.stop>
        <div class="modal-header">
          <h2>Mark Stop as Failed</h2>
          <button @click="showFailModal = false" class="btn-close-drawer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="close-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-instruction">Please specify the reason for the delivery failure. This reason will be logged and sent to the dispatcher team.</p>
          <div class="form-group">
            <label>Failure Reason</label>
            <select v-model="failReason" class="input-form" style="background-color: var(--color-white); margin-bottom: 12px;">
              <option value="Customer not available">Customer not available</option>
              <option value="Incorrect address">Incorrect address</option>
              <option value="Customer refused package">Customer refused package</option>
              <option value="Package damaged">Package damaged</option>
              <option value="Other">Other (Type custom reason below)</option>
            </select>
            <input 
              v-if="failReason === 'Other' || !['Customer not available', 'Incorrect address', 'Customer refused package', 'Package damaged', 'Other'].includes(failReason)" 
              type="text" 
              v-model="customFailReason" 
              class="input-form" 
              placeholder="Enter custom reason here..."
              required
            />
          </div>
          <div v-if="failError" class="form-error-banner" style="margin-top: 12px;">
            {{ failError }}
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showFailModal = false" class="btn-cancel">Cancel</button>
          <button @click="submitFailDelivery" :disabled="failSubmitting" class="btn-submit-fail">
            <span v-if="failSubmitting">Submitting...</span>
            <span v-else>Confirm Failure</span>
          </button>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.dashboard-container {
  width: 100%;
  min-height: 100vh;
  background-color: var(--color-bg-base);
  display: flex;
  flex-direction: row;
}

/* Sidebar Styling */
.dashboard-sidebar {
  width: 260px;
  background-color: var(--color-primary-dark);
  border-right: 1px solid var(--color-accent-sage);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  padding: 24px 16px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
}

.logo-box {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background-color: var(--color-accent-sage);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary-dark);
}

.brand-svg {
  width: 20px;
  height: 20px;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-weight: 800;
  font-size: 16px;
  letter-spacing: 1.5px;
  color: var(--color-white);
}

.brand-subtitle {
  font-size: 9px;
  letter-spacing: 0.5px;
  color: var(--color-accent-sage);
  font-weight: 700;
}

/* Dispatcher Identity Profile card */
.dispatcher-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: rgba(48, 109, 41, 0.3);
  border: 1px solid rgba(231, 225, 177, 0.2);
  border-radius: 12px;
  margin-bottom: 28px;
}

.identity-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--color-accent-sage);
  color: var(--color-primary-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
}

.identity-details {
  display: flex;
  flex-direction: column;
}

.dsp-name {
  margin: 0;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--color-white);
}

.dsp-badge {
  font-size: 10.5px;
  color: var(--color-accent-sage);
  font-family: monospace;
}

.dsp-role {
  font-size: 10px;
  color: var(--color-accent-sage);
  font-weight: 600;
  text-transform: uppercase;
}

/* Sidebar Nav Navigation */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.nav-btn {
  width: 100%;
  padding: 12px 14px;
  border-radius: 8px;
  border: none;
  background: none;
  color: var(--color-accent-sage);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.nav-btn:hover {
  background-color: rgba(231, 225, 177, 0.1);
  color: var(--color-white);
}

.nav-btn.active {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--color-white);
  border-left: 3px solid var(--color-accent-sage);
  padding-left: 11px;
}

.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Sidebar Footer */
.sidebar-footer {
  padding-top: 16px;
  border-top: 1px solid rgba(231, 225, 177, 0.2);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hub-info {
  display: flex;
  flex-direction: column;
}

.hub-label {
  font-size: 9px;
  color: var(--color-accent-sage);
  font-weight: 700;
  letter-spacing: 0.5px;
  opacity: 0.8;
}

.hub-value {
  font-size: 11.5px;
  color: var(--color-white);
  font-weight: 600;
}

.btn-logout {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.2);
  background-color: rgba(239, 68, 68, 0.05);
  color: #fca5a5;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.btn-logout:hover {
  background-color: #b91c1c;
  color: #ffffff;
  border-color: #b91c1c;
}

.logout-icon {
  width: 16px;
  height: 16px;
}

/* Header tab toggle styles */
.header-tab-btn {
  border: none;
  background: none;
  font-size: 12.5px;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-gray-500);
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.header-tab-btn:hover {
  color: var(--color-primary-dark);
}

.header-tab-btn.active {
  background-color: var(--color-white) !important;
  color: var(--color-primary-dark) !important;
  box-shadow: var(--shadow-sm);
}

.page-title-section h1 {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-primary-dark);
  margin-bottom: 4px;
}

.page-title-section .subtitle {
  color: var(--color-gray-500);
  font-size: 15px;
}

/* Analytics Layout */
.analytics-grid {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 24px;
  align-items: flex-start;
}

@media (max-width: 1024px) {
  .analytics-grid {
    grid-template-columns: 1fr;
  }
}

.analytics-panel {
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.analytics-content {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.analytics-block h4 {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary-dark);
  margin-bottom: 12px;
  letter-spacing: 0.25px;
  text-transform: uppercase;
}

.status-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--color-gray-500);
  width: 110px;
  flex-shrink: 0;
  text-transform: uppercase;
}

.progress-track {
  flex-grow: 1;
  height: 8px;
  background-color: var(--color-gray-100);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Route colors */
.progress-fill.draft { background-color: var(--color-gray-400); }
.progress-fill.published { background-color: var(--color-primary); }
.progress-fill.active { background-color: #3b82f6; }
.progress-fill.completed { background-color: var(--color-success); }
.progress-fill.cancelled { background-color: var(--color-danger); }

/* Order colors */
.progress-fill.pending { background-color: #d97706; }
.progress-fill.routed { background-color: #3b82f6; }
.progress-fill.out_for_delivery { background-color: #8b5cf6; }
.progress-fill.delivered { background-color: var(--color-success); }
.progress-fill.failed { background-color: var(--color-danger); }

.status-count {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--color-gray-800);
  min-width: 20px;
  text-align: right;
}

/* Stats panel */
.stats-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
}

.stat-card {
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-wrap svg {
  width: 24px;
  height: 24px;
}

.bg-primary {
  background-color: rgba(48, 109, 41, 0.1);
  color: var(--color-primary);
}

.bg-dark {
  background-color: rgba(13, 83, 14, 0.1);
  color: var(--color-primary-dark);
}

.bg-sage {
  background-color: rgba(231, 225, 177, 0.35);
  color: var(--color-primary-dark);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-info .value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-gray-800);
}

.stat-info .label {
  font-size: 12.5px;
  color: var(--color-gray-500);
}

.text-danger-pulse .value {
  color: var(--color-danger);
  animation: alarmPulse 2s infinite ease-in-out;
}

@keyframes alarmPulse {
  0%, 100% { opacity: 0.95; }
  50% { opacity: 1; text-shadow: 0 0 4px rgba(185, 28, 28, 0.15); }
}

/* Live updates table styling */
.table-section {
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1.5px solid var(--color-gray-100);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.badge-live {
  font-size: 10px;
  font-weight: bold;
  color: var(--color-primary);
  background-color: rgba(48, 109, 41, 0.08);
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.table-wrapper {
  overflow-x: auto;
}

.fleet-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.fleet-table th,
.fleet-table td {
  padding: 16px 24px;
  font-size: 14.5px;
}

.fleet-table th {
  background-color: var(--color-gray-50);
  color: var(--color-gray-800);
  font-weight: 600;
  border-bottom: 1.5px solid var(--color-gray-100);
}

.fleet-table td {
  border-bottom: 1px solid var(--color-gray-100);
  color: var(--color-gray-800);
}

.fleet-table tr:last-child td {
  border-bottom: none;
}

.driver-id {
  font-family: var(--font-mono, monospace);
  font-weight: 700;
  color: var(--color-primary);
}

.driver-name {
  font-weight: 600;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.status-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pill.active {
  background-color: #d1fae5;
  color: #065f46;
}

.status-pill.active .dot {
  background-color: #10b981;
}

.status-pill.completed {
  background-color: #dbeafe;
  color: #1e40af;
}

.status-pill.completed .dot {
  background-color: #3b82f6;
}

.status-pill.on-break {
  background-color: #fef3c7;
  color: #92400e;
}

.status-pill.on-break .dot {
  background-color: #f59e0b;
}


/* ROUTE & LOAD PLANNER LAYOUT */
.planner-layout {
  display: flex;
  gap: 28px;
  align-items: flex-start;
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.planner-sidebar {
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex-shrink: 0;
}

.pending-stops-container {
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
  min-height: 480px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: all 0.25s ease;
}

.pending-stops-container.drag-over {
  border-color: var(--color-primary);
  background-color: rgba(48, 109, 41, 0.03);
  box-shadow: var(--shadow-md);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1.5px solid var(--color-gray-100);
  padding-bottom: 12px;
}

.sidebar-header h4 {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.sidebar-header .stops-count {
  font-size: 11px;
  font-weight: bold;
  color: var(--color-primary);
  background-color: rgba(48, 109, 41, 0.08);
  padding: 2px 8px;
  border-radius: 4px;
}

.stops-scrollable {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;
}

.planner-board {
  flex-grow: 1;
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow: hidden;
}

.board-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1.5px solid var(--color-gray-100);
  padding-bottom: 16px;
  gap: 16px;
}

.board-info h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary-dark);
  margin-bottom: 4px;
}

.board-info p {
  font-size: 13px;
  color: var(--color-gray-500);
}

.btn-publish {
  background-color: var(--color-primary);
  color: var(--color-bg-base);
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.25s ease;
  white-space: nowrap;
}

.btn-publish:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-publish:active:not(:disabled) {
  transform: translateY(0);
}

.btn-publish:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.driver-lanes-wrapper {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  align-items: flex-start;
}

.driver-lane {
  background-color: var(--color-gray-50);
  border: 1.5px solid var(--color-gray-200);
  border-radius: 10px;
  padding: 14px;
  min-height: 480px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: all 0.25s ease;
}

.driver-lane.drag-over {
  border-color: var(--color-primary);
  background-color: rgba(48, 109, 41, 0.05);
  box-shadow: var(--shadow-md);
}

.lane-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-bottom: 1px solid var(--color-gray-200);
  padding-bottom: 10px;
}

.driver-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.driver-lane-name {
  font-weight: 700;
  font-size: 14.5px;
  color: var(--color-gray-800);
}

.driver-lane-id {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: var(--color-gray-500);
  font-weight: 600;
}

.lane-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.route-badge {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--color-primary-dark);
  background-color: var(--color-accent-sage);
  padding: 2px 6px;
  border-radius: 4px;
}

.lane-stats .stops-count {
  font-size: 11px;
  color: var(--color-gray-500);
  font-weight: 500;
}

.lane-stops-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-grow: 1;
  min-height: 380px;
}

.empty-lane-placeholder {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1.5px dashed var(--color-gray-200);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  color: var(--color-gray-500);
  min-height: 120px;
  user-select: none;
}

.empty-lane-placeholder p {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gray-800);
}

.empty-lane-placeholder .sub {
  font-size: 10.5px;
  margin-top: 4px;
  opacity: 0.8;
}

/* Stop Card Styling */
.stop-card {
  background-color: var(--color-white);
  border: 1.5px solid var(--color-gray-200);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: grab;
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.stop-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
  border-color: var(--color-primary);
}

.stop-card:active {
  cursor: grabbing;
}

.stop-card.completed {
  cursor: not-allowed;
  opacity: 0.75;
  background-color: var(--color-gray-100);
  border-style: dashed;
}

.stop-index {
  position: absolute;
  left: -8px;
  top: -8px;
  width: 20px;
  height: 20px;
  background-color: var(--color-primary-dark);
  color: var(--color-bg-base);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  box-shadow: var(--shadow-sm);
  z-index: 5;
}

.stop-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.stop-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.stop-id {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-gray-500);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.priority-pill {
  font-size: 9.5px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.priority-pill.high {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 0.5px solid var(--color-danger-border);
}

.priority-pill.medium {
  background-color: #fffbeb;
  color: #b45309;
  border: 0.5px solid #fcd34d;
}

.priority-pill.low {
  background-color: #f0fdf4;
  color: #15803d;
  border: 0.5px solid #bbf7d0;
}

.btn-unassign {
  background: none;
  border: none;
  color: var(--color-gray-500);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.2s, background-color 0.2s;
}

.btn-unassign:hover {
  color: var(--color-danger);
  background-color: var(--color-danger-bg);
}

.btn-unassign svg {
  width: 13px;
  height: 13px;
}

.stop-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cust-name {
  font-weight: 700;
  font-size: 13.5px;
  color: var(--color-gray-800);
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge-done {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-white);
  background-color: var(--color-success);
  padding: 1px 4px;
  border-radius: 3px;
  text-transform: uppercase;
}

.stop-address {
  font-size: 11.5px;
  color: var(--color-gray-500);
  line-height: 1.35;
  word-break: break-word;
}

.stop-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--color-gray-150);
  padding-top: 6px;
  margin-top: 2px;
}

.package-count {
  font-size: 11px;
  color: var(--color-gray-500);
  font-weight: 500;
}

.geocode-box {
  font-size: 10.5px;
}

.geocode-box .coords {
  color: var(--color-primary);
  font-family: var(--font-mono, monospace);
  font-weight: 600;
}

.geocoding-spinner {
  color: #d97706;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.spinner-dot {
  width: 5px;
  height: 5px;
  background-color: #d97706;
  border-radius: 50%;
  display: inline-block;
  animation: blinkDot 1s infinite alternate;
}

@keyframes blinkDot {
  0% { opacity: 0.2; }
  100% { opacity: 1; }
}

/* Spinner for Publish Action */
.loading-state {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  animation: rotateSpinner 1.2s linear infinite;
  width: 16px;
  height: 16px;
}

.spinner-track {
  opacity: 0.2;
}

@keyframes rotateSpinner {
  100% { transform: rotate(360deg); }
}

/* Staging success toast floating alert */
.publish-success-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background-color: var(--color-primary-dark);
  color: var(--color-white);
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: var(--shadow-xl);
  z-index: 1000;
  border: 1.5px solid var(--color-accent-sage);
  max-width: 420px;
}

.toast-content {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.toast-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-sage);
  flex-shrink: 0;
}

.toast-icon-box svg {
  width: 20px;
  height: 20px;
}

.toast-text h5 {
  font-size: 14.5px;
  font-weight: 700;
  margin-bottom: 2px;
  color: var(--color-white);
}

.toast-text p {
  font-size: 12px;
  color: var(--color-accent-sage);
  line-height: 1.4;
}

/* Vue Transitions for toast */
.toast-enter-active, .toast-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from {
  transform: translateY(24px) scale(0.95);
  opacity: 0;
}

.toast-leave-to {
  transform: translateY(16px);
  opacity: 0;
}

/* Mobile Responsiveness Updates */
@media (max-width: 1024px) {
  .dashboard-sidebar {
    width: 200px;
    padding: 16px 10px;
  }
  .dashboard-body {
    margin-left: 200px;
    width: calc(100% - 200px);
    padding: 24px;
  }
  .planner-layout {
    flex-direction: column;
    align-items: stretch;
  }
  .planner-sidebar {
    width: 100%;
  }
  .stops-scrollable {
    max-height: 300px;
  }
}

@media (max-width: 768px) {
  .dashboard-container {
    flex-direction: column;
  }
  .dashboard-sidebar {
    position: relative;
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-accent-sage);
    height: auto;
    padding: 16px;
  }
  .dashboard-body {
    margin-left: 0;
    width: 100%;
    padding: 20px;
    gap: 20px;
  }
  .page-title-section h1 {
    font-size: 28px;
  }
  .driver-lanes-wrapper {
    grid-template-columns: 1fr;
  }
}

.route-status-pill {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}
.route-status-pill.draft { background-color: #e2e8f0; color: #475569; }
.route-status-pill.published { background-color: #dbeafe; color: #1e40af; }
.route-status-pill.active { background-color: #dcfce7; color: #15803d; }
.route-status-pill.completed { background-color: #f1f5f9; color: #64748b; }
.route-status-pill.cancelled { background-color: #fee2e2; color: #991b1b; }

.route-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.btn-route-action {
  font-size: 10px;
  font-weight: 700;
  border: none;
  border-radius: 4px;
  padding: 3px 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}
.btn-route-action.publish { background-color: var(--color-primary); color: white; }
.btn-route-action.activate { background-color: #16a34a; color: white; }
.btn-route-action.cancel { background-color: #dc2626; color: white; }
.btn-route-action.complete { background-color: #2563eb; color: white; }

.btn-route-action:hover {
  opacity: 0.9;
  transform: translateY(-0.5px);
}

.stop-status-badge {
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 6px;
  display: inline-block;
  vertical-align: middle;
}
.stop-status-badge.pending { background-color: #fef3c7; color: #d97706; }
.stop-status-badge.routed { background-color: #dbeafe; color: #1e40af; }
.stop-status-badge.out_for_delivery { background-color: #f3e8ff; color: #7e22ce; }
.stop-status-badge.delivered { background-color: #dcfce7; color: #15803d; }
.stop-status-badge.failed { background-color: #fee2e2; color: #b91c1c; }

.fail-reason {
  font-size: 10px;
  color: var(--color-danger);
  font-weight: 600;
  margin-top: 4px;
  background-color: rgba(239, 68, 68, 0.05);
  padding: 4px 6px;
  border-radius: 4px;
  border-left: 2px solid var(--color-danger);
}

.stop-actions {
  margin-top: 6px;
  border-top: 1px solid var(--color-gray-100);
  padding-top: 6px;
}

.stop-action-group {
  display: flex;
  gap: 4px;
}

.btn-stop-action {
  font-size: 9px;
  font-weight: 700;
  border: none;
  border-radius: 4px;
  padding: 3px 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
  flex-grow: 1;
  text-align: center;
}
.btn-stop-action.start { background-color: #7e22ce; color: white; }
.btn-stop-action.complete { background-color: #16a34a; color: white; }
.btn-stop-action.fail { background-color: #dc2626; color: white; }

.btn-stop-action:hover {
  opacity: 0.9;
  transform: translateY(-0.5px);
}

.route-badge-link {
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
  transition: color 0.2s;
}
.route-badge-link:hover {
  color: var(--color-primary-dark);
}
.route-badge.clickable {
  cursor: pointer;
  transition: all 0.2s;
}
.route-badge.clickable:hover {
  background-color: var(--color-primary-dark);
  color: var(--color-accent-sage);
}

/* Exceptions tab custom styling */
.exception-badge {
  background-color: #dc2626 !important;
  color: white !important;
  margin-left: 6px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
}
.exception-count-badge {
  background-color: #fee2e2;
  color: #dc2626;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
}

/* High Priority WebSocket Toast Notification Styles */
.high-priority-toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 380px;
  max-width: 90vw;
  pointer-events: none;
}

.high-priority-alert-toast {
  background-color: var(--color-white);
  border: 2px solid #ef4444;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(220, 38, 38, 0.3), 0 8px 10px -6px rgba(220, 38, 38, 0.3);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: auto;
  animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideInRight {
  from { transform: translateX(120%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.toast-fade-leave-to {
  transform: translateX(120%);
  opacity: 0;
  transition: all 0.3s ease;
}

.toast-content-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.toast-warning-icon {
  color: #dc2626;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  animation: pulseWarning 1.5s infinite;
}

@keyframes pulseWarning {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.toast-text-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toast-alert-title {
  font-size: 13px;
  font-weight: 800;
  color: #b91c1c;
  letter-spacing: 0.5px;
}

.toast-order-info {
  font-size: 12.5px;
  color: var(--color-gray-800);
}

.toast-reason-text {
  font-size: 11.5px;
  color: var(--color-gray-600);
  background-color: #fee2e2;
  padding: 6px 8px;
  border-radius: 6px;
  border-left: 2.5px solid #dc2626;
  margin-top: 4px;
}

.toast-timestamp-text {
  font-size: 10px;
  color: var(--color-gray-400);
  font-weight: 500;
  margin-top: 2px;
}

.toast-actions-row {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--color-gray-150);
  padding-top: 10px;
  justify-content: flex-end;
}

.toast-btn-action {
  font-size: 11px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.toast-btn-action.view {
  background-color: #dc2626;
  color: white;
}

.toast-btn-action.view:hover {
  background-color: #b91c1c;
}

.toast-btn-action.dismiss {
  background-color: var(--color-gray-100);
  color: var(--color-gray-700);
  border: 1px solid var(--color-gray-200);
}

.toast-btn-action.dismiss:hover {
  background-color: var(--color-200);
}

/* Custom Modal Styles */
.custom-modal {
  width: 440px;
  max-width: 90%;
  background-color: var(--color-white);
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalScaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes modalScaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-gray-100);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-primary-dark);
  margin: 0;
}

.modal-body {
  padding: 20px;
}

.modal-instruction {
  font-size: 13px;
  color: var(--color-gray-500);
  margin-top: 0;
  margin-bottom: 16px;
  line-height: 1.5;
}

.modal-footer {
  padding: 12px 20px;
  background-color: var(--color-gray-50);
  border-top: 1px solid var(--color-gray-100);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-cancel {
  padding: 8px 16px;
  border: 1.5px solid var(--color-gray-200);
  background-color: var(--color-white);
  color: var(--color-gray-700);
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: all 0.2s;
}

.btn-cancel:hover {
  background-color: var(--color-gray-100);
}

.btn-submit-fail {
  padding: 8px 16px;
  border: none;
  background-color: #dc2626;
  color: white;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: all 0.2s;
}

.btn-submit-fail:hover:not(:disabled) {
  background-color: #b91c1c;
}

.btn-submit-fail:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
