<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import CSVUpload from '../common/CSVUpload.vue'
import type { ParsedStop } from '../common/CSVUpload.vue'
import { useAuthStore } from '../../stores/auth'
import apiClient from '../../services/api'

const authStore = useAuthStore()

interface Stop extends ParsedStop {
  status: 'Pending' | 'Completed'
}

// Emits left for backwards compatibility if needed, but we route directly
const emit = defineEmits(['logout'])

// Active tab view: 'fleet' (original overview) or 'planner' (route planning board)
const currentTab = ref<'fleet' | 'planner'>('fleet')

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
  route: string
  status: string
  phone: string
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
    }
  } catch (err) {
    console.warn('Failed to load dashboard metrics from API:', err)
  }
}

const loadAndSeedDrivers = async () => {
  try {
    const response = await apiClient.get('/drivers')
    if (response.data && response.data.status === 'success') {
      const apiDrivers = response.data.data || []
      mapApiDrivers(apiDrivers)
    }
  } catch (err) {
    console.warn('API call failed to load drivers:', err)
  }
}

const mapApiDrivers = (apiDrivers: any[]) => {
  const routes = ['DEL-NCR-01', 'MUM-WST-04', 'BLR-OUT-02', 'HYD-MTR-09', 'DEL-SOUTH-02', 'BLR-EC-05']
  activeDrivers.value = apiDrivers.map((apiDriver, index) => {
    const fullName = `${apiDriver.firstName} ${apiDriver.lastName}`
    return {
      id: apiDriver.employeeId || `DRV-${apiDriver.driverId}`,
      name: fullName,
      route: routes[index % routes.length],
      status: apiDriver.active ? 'Active' : 'Inactive',
      phone: apiDriver.phoneNumber ? `+91 ${apiDriver.phoneNumber}` : '+91 99999 99999',
      stopsList: []
    }
  })
}

onMounted(() => {
  loadAndSeedDrivers()
  loadDashboardMetrics()
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
    d.stopsList.some(s => s.status === 'Pending') && d.status !== 'Completed'
  ).length
})

const totalCompletedStops = computed(() => {
  if (dashboardMetrics.value) {
    return dashboardMetrics.value.deliveredToday
  }
  return activeDrivers.value.reduce((acc, d) => 
    acc + d.stopsList.filter(s => s.status === 'Completed').length, 0
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
    acc + d.stopsList.filter(s => s.priority === 'High' && s.status === 'Pending').length, 0
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
  const completed = driver.stopsList.filter(s => s.status === 'Completed').length
  return `${completed}/${total}`
}

// LOGOUT TRIGGER
const handleLogout = () => {
  authStore.logout()
}

// CSV IMPORT & SIMULATED GEOCODING
const handleStopsLoaded = (loadedStops: ParsedStop[]) => {
  dashboardMetrics.value = null // Switch to dynamic client-side calculations
  const stopsWithStatus = loadedStops.map(s => ({
    ...s,
    status: 'Pending' as const
  }))

  pendingStops.value.push(...stopsWithStatus)

  // Trigger individual geocoding simulation with offsets around central Indian coordinates (Delhi/NCR)
  stopsWithStatus.forEach(stop => {
    setTimeout(() => {
      const latOffset = (Math.random() - 0.5) * 0.08
      const lngOffset = (Math.random() - 0.5) * 0.08
      
      // Look up target stop reference in either queue to update lat/long
      const targetStop = pendingStops.value.find(s => s.id === stop.id) || 
                         activeDrivers.value.flatMap(d => d.stopsList).find(s => s.id === stop.id)
      
      if (targetStop) {
        targetStop.latitude = parseFloat((28.6139 + latOffset).toFixed(5))
        targetStop.longitude = parseFloat((77.2090 + lngOffset).toFixed(5))
        targetStop.geocoding = false
      }
    }, 1200 + Math.random() * 1500)
  })
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
const moveStop = (stopId: string, fromLane: string, toLane: string, targetStopId?: string) => {
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

  // Ensure stop status is reset if moved back to pending, or set to pending in driver lane
  if (toLane === 'pending') {
    stopObj.status = 'Pending'
  }

  // 2. Insert into target lane at specific location or at end
  if (toLane === 'pending') {
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
}

// Unassign / remove stop action trigger button
const unassignStop = (stopId: string, driverId: string) => {
  dashboardMetrics.value = null // Switch to dynamic client-side calculations
  const driver = activeDrivers.value.find(d => d.id === driverId)
  if (!driver) return
  
  const idx = driver.stopsList.findIndex(s => s.id === stopId)
  if (idx !== -1) {
    const stop = driver.stopsList.splice(idx, 1)[0]
    stop.status = 'Pending'
    pendingStops.value.push(stop)
  }
}

// Pushes current layout configuration to simulated API
const publishRoutes = () => {
  isPublishing.value = true
  setTimeout(() => {
    isPublishing.value = false
    showPublishSuccess.value = true
    loadDashboardMetrics() // Refresh metrics from API
    // Dismiss toast after delay
    setTimeout(() => {
      showPublishSuccess.value = false
    }, 4500)
  }, 2200)
}
</script>

<template>
  <div class="dashboard-container">
    <!-- Dispatcher Sidebar -->
    <aside class="dashboard-sidebar">
      <div class="sidebar-brand">
        <div class="logo-box">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="brand-svg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125a1.125 1.125 0 0 0 1.125-1.125V9.75M3.75 12h12.75M3 14.25h13.5m0 0V9.75M16.5 9.75V5.25A2.25 2.25 0 0 0 14.25 3H6.125A2.25 2.25 0 0 0 3.875 5.25V14.25m12.625-4.5h2.375A2.25 2.25 0 0 1 21 12v3.75m-2.25-5.25v2.25m-15-2.25h12" />
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-title">LAST-MILE</span>
          <span class="brand-subtitle">DISPATCH CONSOLE</span>
        </div>
      </div>

      <!-- Dispatcher Identity Card -->
      <div class="dispatcher-identity">
        <div class="identity-avatar">
          <span>{{ authStore.name ? authStore.name.slice(0, 2).toUpperCase() : 'DS' }}</span>
        </div>
        <div class="identity-details">
          <h4 class="dsp-name">{{ authStore.name || 'Dispatcher' }}</h4>
          <span class="dsp-badge">ID: {{ authStore.employeeId || 'EMP-1002' }}</span>
          <span class="dsp-role">{{ authStore.role || 'DISPATCHER' }}</span>
        </div>
      </div>

      <!-- Sidebar Navigation Menu -->
      <nav class="sidebar-nav">
        <button 
          class="nav-btn" 
          :class="{ active: currentTab === 'fleet' }" 
          @click="currentTab = 'fleet'"
        >
          <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
          </svg>
          Overview
        </button>
        <button 
          class="nav-btn" 
          :class="{ active: currentTab === 'planner' }" 
          @click="currentTab = 'planner'"
        >
          <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25zM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25z" />
          </svg>
          Route & Load Planner
        </button>
      </nav>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <div class="hub-info">
          <span class="hub-label">ACTIVE NODE HUB</span>
          <span class="hub-value">{{ authStore.hub || 'MLC-9 (MAIN)' }}</span>
        </div>
        
        <button @click="handleLogout" class="btn-logout" aria-label="Sign Out">
          <span>Sign Out Session</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="logout-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    </aside>

    <!-- Main Content Grid -->
    <main class="dashboard-body">
      <!-- Page title section -->
      <div class="page-title-section">
        <h1>Logistics Terminal</h1>
        <p class="subtitle">Real-time dispatch system monitoring for {{ dashboardMetrics?.totalUsers || 2 }} terminal users, geocoding and corridor routing sequences</p>
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
              <h3>Operational Summary</h3>
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
              <h3>Active Driver Terminals</h3>
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
                    <td class="driver-route">{{ driver.route }}</td>
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
                <h3>Driver Load Sequences</h3>
                <p>Drag stops up and down to resequence. Drag stops between lanes to reassign drivers.</p>
              </div>
              <div class="board-actions">
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
                  <div class="lane-stats">
                    <span class="route-badge">{{ driver.route }}</span>
                    <span class="stops-count">{{ driver.stopsList.length }} stops</span>
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
                    :class="[stop.priority.toLowerCase(), { 'completed': stop.status === 'Completed' }]"
                    :draggable="stop.status !== 'Completed'"
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
                            v-if="stop.status !== 'Completed'"
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
                          <span v-if="stop.status === 'Completed'" class="badge-done">Done</span>
                        </div>
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
            </div>
          </div>

        </div>
      </div>
    </main>

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
  </div>
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

/* Dashboard Body Layout */
.dashboard-body {
  padding: 40px;
  margin-left: 260px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  flex-grow: 1;
  box-sizing: border-box;
  width: calc(100% - 260px);
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
</style>
