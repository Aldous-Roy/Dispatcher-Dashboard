<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import apiClient from '../../services/api'

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
}

interface Driver {
  id: string
  name: string
  status: string
  phone: string
}

interface RouteData {
  routeId: string
  routeCode: string
  routeDate: string
  status: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  driverId: string | null
  totalDistanceKm: number
  estimatedDurationMins: number
  routePolyline?: string
}

const route = useRoute()
const router = useRouter()

const routeId = route.params.id as string
const routeData = ref<RouteData | null>(null)
const stops = ref<Stop[]>([])
const driver = ref<Driver | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const availableDrivers = ref<Driver[]>([])
const unassignedStops = ref<any[]>([])
const dragStopId = ref<string | null>(null)

const loadAvailableDrivers = async () => {
  try {
    const res = await apiClient.get('/drivers')
    if (res.data && res.data.status === 'success') {
      const allDrivers = res.data.data?.content || res.data.data || []
      availableDrivers.value = allDrivers.map((d: any) => ({
        id: d.driverId || d.employeeId,
        name: `${d.firstName} ${d.lastName}`,
        status: d.active ? 'Active' : 'Inactive',
        phone: d.phoneNumber ? `+91 ${d.phoneNumber}` : '+91 99999 99999'
      }))
    }
  } catch (e) {
    console.warn('Failed to load available drivers:', e)
  }
}

const loadUnassignedStops = async () => {
  try {
    const res = await apiClient.get('/stops?page=0&size=100&sort=createdAt,desc')
    if (res.data && res.data.status === 'success') {
      const allStops = res.data.data?.content || res.data.data || []
      unassignedStops.value = allStops.filter((s: any) => s.status === 'PENDING')
    }
  } catch (e) {
    console.warn('Failed to load unassigned stops:', e)
  }
}

const assignDriver = async (driverId: string) => {
  try {
    const res = await apiClient.post(`/routes/${routeId}/assign-driver`, {
      driverId
    })
    if (res.data && res.data.status === 'success') {
      fetchRouteDetails()
    }
  } catch (err) {
    console.error('Failed to assign driver:', err)
  }
}

const assignOrders = async (orderId: string) => {
  try {
    const res = await apiClient.post(`/routes/${routeId}/assign-orders`, {
      orderIds: [orderId]
    })
    if (res.data && res.data.status === 'success') {
      unassignedStops.value = unassignedStops.value.filter(s => s.orderId !== orderId)
      fetchRouteDetails()
    }
  } catch (err) {
    console.error('Failed to assign order:', err)
  }
}

const handleDragStart = (event: DragEvent, stopId: string) => {
  if (routeData.value?.status !== 'DRAFT') return
  dragStopId.value = stopId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', stopId)
  }
}

const handleDrop = async (_event: DragEvent, targetStopId: string) => {
  if (routeData.value?.status !== 'DRAFT' || !dragStopId.value) return
  const stopId = dragStopId.value
  dragStopId.value = null

  if (stopId === targetStopId) return

  const sourceIndex = stops.value.findIndex(s => s.id === stopId)
  const targetIndex = stops.value.findIndex(s => s.id === targetStopId)
  if (sourceIndex !== -1 && targetIndex !== -1) {
    const [movedStop] = stops.value.splice(sourceIndex, 1)
    stops.value.splice(targetIndex, 0, movedStop)

    try {
      const orderIds = stops.value.map(s => s.id)
      await apiClient.post(`/routes/${routeId}/resequence`, {
        orderIds
      })
    } catch (e) {
      console.error('Failed to save stop sequence:', e)
    }
  }
}

const goBack = () => {
  router.push('/dashboard')
}

// Fetch all info
const fetchRouteDetails = async () => {
  loading.value = true
  error.value = null
  try {
    // 1. Fetch route details
    const routeRes = await apiClient.get(`/routes/${routeId}`)
    if (routeRes.data && routeRes.data.status === 'success') {
      routeData.value = routeRes.data.data
    } else {
      throw new Error('Failed to load route details')
    }

    // 2. Fetch stops for this route
    const stopsRes = await apiClient.get(`/routes/${routeId}/stops?size=100`)
    if (stopsRes.data && stopsRes.data.status === 'success') {
      const stopList = stopsRes.data.data?.content || stopsRes.data.data || []
      stops.value = stopList.map((apiStop: any) => ({
        id: apiStop.orderId,
        address: apiStop.deliveryAddress || apiStop.address || 'Unknown Address',
        customerName: apiStop.customerName || 'Unknown Customer',
        customerPhone: apiStop.customerPhone || '+91 99999 99999',
        packageCount: apiStop.packageCount || (apiStop.packageWeightKg ? Math.ceil(apiStop.packageWeightKg / 1.5) : 1),
        priority: apiStop.requiredPodType === 'PHOTO_REQUIRED' ? 'High' : 'Medium',
        latitude: apiStop.latitude || 12.9715987,
        longitude: apiStop.longitude || 77.594566,
        geocoding: false,
        status: apiStop.status || 'ROUTED',
        failedReasonNotes: apiStop.failedReasonNotes || null
      }))
    }

    // 3. Fetch driver details if driverId is set
    if (routeData.value?.driverId) {
      try {
        const driversRes = await apiClient.get('/drivers')
        if (driversRes.data && driversRes.data.status === 'success') {
          const allDrivers = driversRes.data.data?.content || driversRes.data.data || []
          const matchedDriver = allDrivers.find(
            (d: any) => d.driverId === routeData.value?.driverId || d.employeeId === routeData.value?.driverId
          )
          if (matchedDriver) {
            driver.value = {
              id: matchedDriver.employeeId || matchedDriver.driverId,
              name: `${matchedDriver.firstName} ${matchedDriver.lastName}`,
              status: matchedDriver.active ? 'Active' : 'Inactive',
              phone: matchedDriver.phoneNumber ? `+91 ${matchedDriver.phoneNumber}` : '+91 99999 99999'
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load driver details:', err)
      }
    }
  } catch (err: any) {
    error.value = err.message || 'Error loading route details'
  } finally {
    loading.value = false
    if (routeData.value?.status === 'DRAFT') {
      loadAvailableDrivers()
      loadUnassignedStops()
    }
  }
}

// Route Lifecycle Operations
const publishRoute = async () => {
  if (!routeData.value) return
  try {
    const res = await apiClient.post(`/routes/${routeId}/publish`)
    if (res.data && res.data.status === 'success') {
      routeData.value.status = 'PUBLISHED'
    }
  } catch (err) {
    console.error('Failed to publish route:', err)
  }
}

const activateRoute = async () => {
  if (!routeData.value) return
  try {
    const res = await apiClient.post(`/routes/${routeId}/activate`)
    if (res.data && res.data.status === 'success') {
      routeData.value.status = 'ACTIVE'
    }
  } catch (err) {
    console.error('Failed to activate route:', err)
  }
}

const cancelRoute = async () => {
  if (!routeData.value) return
  try {
    const res = await apiClient.post(`/routes/${routeId}/cancel`)
    if (res.data && res.data.status === 'success') {
      routeData.value.status = 'CANCELLED'
    }
  } catch (err) {
    console.error('Failed to cancel route:', err)
  }
}

const completeRoute = async () => {
  if (!routeData.value) return
  try {
    const res = await apiClient.post(`/routes/${routeId}/complete`)
    if (res.data && res.data.status === 'success') {
      routeData.value.status = 'COMPLETED'
    }
  } catch (err) {
    console.error('Failed to complete route:', err)
  }
}

// Stop Lifecycle Operations
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

const failDelivery = async (stop: Stop) => {
  const reason = prompt('Please enter the failure reason:', 'Customer not available')
  if (reason === null) return
  
  try {
    const res = await apiClient.post(`/stops/${stop.id}/fail-delivery`, {
      reason
    })
    if (res.data && res.data.status === 'success') {
      stop.status = 'FAILED'
      stop.failedReasonNotes = reason
    }
  } catch (err) {
    console.error(`Failed to fail delivery for stop ${stop.id}:`, err)
  }
}

// Map Calculations
const mapBounds = computed(() => {
  if (stops.value.length === 0) return { minLat: 12, maxLat: 13, minLng: 77, maxLng: 78 }
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  stops.value.forEach(s => {
    if (s.latitude < minLat) minLat = s.latitude
    if (s.latitude > maxLat) maxLat = s.latitude
    if (s.longitude < minLng) minLng = s.longitude
    if (s.longitude > maxLng) maxLng = s.longitude
  })
  // Pad bounds slightly to avoid placing dots on the absolute edge
  const latPadding = (maxLat - minLat || 0.01) * 0.15
  const lngPadding = (maxLng - minLng || 0.01) * 0.15
  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding
  }
})

const stopPoints = computed(() => {
  const { minLat, maxLat, minLng, maxLng } = mapBounds.value
  const latDiff = maxLat - minLat || 1
  const lngDiff = maxLng - minLng || 1
  
  return stops.value.map((s, index) => {
    // Map latitude/longitude coordinates to a 400x200 SVG canvas grid
    const x = 40 + ((s.longitude - minLng) / lngDiff) * 320
    const y = 170 - ((s.latitude - minLat) / latDiff) * 120
    return {
      ...s,
      index: index + 1,
      x,
      y
    }
  })
})

const svgPath = computed(() => {
  if (stopPoints.value.length === 0) return ''
  return 'M ' + stopPoints.value.map(p => `${p.x} ${p.y}`).join(' L ')
})

onMounted(() => {
  fetchRouteDetails()
})
</script>

<template>
  <div class="route-details-container">
    <!-- Header bar -->
    <header class="details-header">
      <button @click="goBack" class="btn-back">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="arrow-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Dashboard
      </button>

      <div class="header-title" v-if="routeData">
        <h2>Route Details: <span class="highlight">{{ routeData.routeCode }}</span></h2>
        <span class="route-status-pill" :class="routeData.status.toLowerCase()">
          {{ routeData.status }}
        </span>
      </div>
    </header>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Retrieving Route & Stop parameters...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <h3>Error Loading Details</h3>
      <p>{{ error }}</p>
      <button @click="fetchRouteDetails" class="btn-retry">Retry Load</button>
    </div>

    <div v-else class="details-grid">
      <!-- Left side: info card & status controls -->
      <div class="left-pane">
        <!-- Route Specs -->
        <section class="info-card" v-if="routeData">
          <div class="card-header">
            <h3>Operational Parameters</h3>
          </div>
          <div class="specs-grid">
            <div class="spec-item">
              <span class="label">Date</span>
              <span class="value">{{ routeData.routeDate }}</span>
            </div>
            <div class="spec-item">
              <span class="label">Distance</span>
              <span class="value">{{ routeData.totalDistanceKm }} km</span>
            </div>
            <div class="spec-item">
              <span class="label">Est. Duration</span>
              <span class="value">{{ routeData.estimatedDurationMins }} mins</span>
            </div>
            <div class="spec-item">
              <span class="label">Stops Count</span>
              <span class="value">{{ stops.length }} items</span>
            </div>
          </div>
        </section>

        <!-- Driver Profile -->
        <section class="info-card">
          <div class="card-header">
            <h3>Assigned Operator</h3>
          </div>
          <div v-if="driver" class="driver-profile">
            <div class="avatar">
              <span>{{ driver.name.slice(0, 2).toUpperCase() }}</span>
            </div>
            <div class="profile-details">
              <h4>{{ driver.name }}</h4>
              <span class="id-badge">ID: {{ driver.id }}</span>
              <span class="status-pill" :class="driver.status.toLowerCase()">
                <span class="dot"></span>
                {{ driver.status }}
              </span>
              <span class="contact-num">📞 {{ driver.phone }}</span>
            </div>
          </div>
          <div v-if="routeData?.status === 'DRAFT'" class="driver-assign-box" style="padding: 16px; border-top: 1px solid var(--color-gray-100);">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-500); display: block; margin-bottom: 6px; text-transform: uppercase;">
              Change/Assign Operator
            </label>
            <select 
              @change="assignDriver(($event.target as HTMLSelectElement).value)" 
              class="select-driver"
              style="width: 100%; padding: 8px 10px; border: 1.5px solid var(--color-gray-200); border-radius: 6px; font-size: 12.5px; font-weight: 600; font-family: var(--font-sans); outline: none; background-color: var(--color-white);"
            >
              <option value="" disabled selected>Select available driver...</option>
              <option v-for="d in availableDrivers" :key="d.id" :value="d.id">
                {{ d.name }} ({{ d.status }})
              </option>
            </select>
          </div>
          <div v-if="!driver && routeData?.status !== 'DRAFT'" class="empty-profile">
            <p>No driver assigned to this route.</p>
          </div>
        </section>

        <!-- Route Status Controls -->
        <section class="info-card" v-if="routeData">
          <div class="card-header">
            <h3>Route Status Lifecycle</h3>
          </div>
          <div class="lifecycle-controls">
            <div v-if="routeData.status === 'DRAFT'" class="btn-group-column">
              <p class="help-text">Route is currently in draft. Publish it to synchronize with driver terminals.</p>
              <button @click="publishRoute" class="btn-lifecycle publish">
                Publish Dispatch Schedule
              </button>
            </div>
            <div v-else-if="routeData.status === 'PUBLISHED'" class="btn-group-row">
              <button @click="activateRoute" class="btn-lifecycle activate">
                Activate Route
              </button>
              <button @click="cancelRoute" class="btn-lifecycle cancel">
                Cancel Route
              </button>
            </div>
            <div v-else-if="routeData.status === 'ACTIVE'" class="btn-group-row">
              <button @click="completeRoute" class="btn-lifecycle complete">
                Mark Route Complete
              </button>
              <button @click="cancelRoute" class="btn-lifecycle cancel">
                Cancel Route
              </button>
            </div>
            <div v-else class="locked-state">
              <p>This route is locked. Current status: <strong>{{ routeData.status }}</strong></p>
            </div>
          </div>
        </section>
      </div>

      <!-- Right side: Stops timeline list -->
      <div class="right-pane">
        <!-- Assign Stops Form Card -->
        <section class="timeline-card" v-if="routeData?.status === 'DRAFT' && unassignedStops.length > 0" style="margin-bottom: 24px;">
          <div class="card-header">
            <h3>Assign Stops / Orders</h3>
          </div>
          <div style="padding: 16px;">
            <p class="help-text" style="font-size: 12px; color: var(--color-gray-500); margin-bottom: 8px;">Select a pending order to dispatch on this route:</p>
            <select 
              @change="assignOrders(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''" 
              class="select-driver"
              style="width: 100%; padding: 8px 10px; border: 1.5px solid var(--color-gray-200); border-radius: 6px; font-size: 12.5px; font-weight: 600; font-family: var(--font-sans); outline: none; background-color: var(--color-white);"
            >
              <option value="" disabled selected>Select pending order...</option>
              <option v-for="s in unassignedStops" :key="s.orderId" :value="s.orderId">
                {{ s.orderId }} - {{ s.customerName }} ({{ s.deliveryAddress }})
              </option>
            </select>
          </div>
        </section>

        <section class="timeline-card">
          <div class="card-header">
            <h3>Sequence Timeline</h3>
            <span class="badge-count">{{ stops.length }} Stops</span>
          </div>

          <div v-if="stops.length === 0" class="empty-timeline">
            <p>No stops assigned to this route.</p>
          </div>

          <div v-else class="timeline-list">
            <div 
              v-for="stop in stopPoints" 
              :key="stop.id" 
              class="timeline-item"
              :class="[stop.priority.toLowerCase(), stop.status.toLowerCase(), { 'draggable-item': routeData?.status === 'DRAFT' }]"
              :draggable="routeData?.status === 'DRAFT'"
              @dragstart="handleDragStart($event, stop.id)"
              @dragover.prevent
              @drop="handleDrop($event, stop.id)"
            >
              <div class="timeline-badge">{{ stop.index }}</div>
              
              <div class="stop-content">
                <div class="stop-header">
                  <span class="stop-id">{{ stop.id }}</span>
                  <div class="badge-group">
                    <span class="priority-pill" :class="stop.priority.toLowerCase()">
                      {{ stop.priority }}
                    </span>
                    <span class="stop-status-badge" :class="stop.status.toLowerCase()">
                      {{ stop.status.replace(/_/g, ' ') }}
                    </span>
                  </div>
                </div>

                <div class="stop-details-body">
                  <h4 class="customer">{{ stop.customerName }}</h4>
                  <p class="address">📍 {{ stop.address }}</p>
                  <p class="package">📦 {{ stop.packageCount }} packages | Phone: {{ stop.customerPhone }}</p>
                  <div v-if="stop.failedReasonNotes" class="fail-reason">
                    Reason: {{ stop.failedReasonNotes }}
                  </div>
                </div>

                <!-- Stop action controls inside details page -->
                <div class="stop-actions" v-if="routeData?.status === 'ACTIVE'">
                  <button v-if="stop.status === 'ROUTED'" @click="startDelivery(stop)" class="btn-stop-action start">
                    Start Delivery
                  </button>
                  <div v-else-if="stop.status === 'OUT_FOR_DELIVERY'" class="stop-btn-row">
                    <button @click="completeDelivery(stop)" class="btn-stop-action complete">
                      Complete
                    </button>
                    <button @click="failDelivery(stop)" class="btn-stop-action fail">
                      Fail
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Bottom Pane: Interactive SVG map path visualization -->
    <footer class="map-visualization" v-if="!loading && !error && stops.length > 0">
      <div class="card-header">
        <h3>Simulated Logistics Routing Map</h3>
      </div>
      <div class="map-wrapper">
        <svg class="map-svg" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Dot Grid Background -->
          <defs>
            <pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="rgba(48, 109, 41, 0.15)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />

          <!-- Route Path line connecting stops -->
          <path :d="svgPath" stroke="var(--color-primary)" stroke-width="2.5" stroke-dasharray="6,4" />

          <!-- Stops coordinate nodes -->
          <g v-for="point in stopPoints" :key="point.id" class="stop-node">
            <!-- Ripple Pulse for Active stop -->
            <circle 
              v-if="point.status === 'OUT_FOR_DELIVERY'" 
              :cx="point.x" 
              :cy="point.y" 
              r="14" 
              fill="none" 
              stroke="#8b5cf6" 
              stroke-width="1.5" 
              class="pulse-ring" 
            />
            
            <!-- Stop point dot -->
            <circle 
              :cx="point.x" 
              :cy="point.y" 
              r="6.5" 
              :fill="point.status === 'DELIVERED' ? 'var(--color-success)' : (point.status === 'FAILED' ? 'var(--color-danger)' : (point.status === 'OUT_FOR_DELIVERY' ? '#8b5cf6' : 'var(--color-accent-sage)'))" 
              stroke="var(--color-primary)" 
              stroke-width="1.5" 
            />

            <!-- Stop sequence index label -->
            <text :x="point.x" :y="point.y - 12" text-anchor="middle" class="map-label">
              #{{ point.index }} ({{ point.id }})
            </text>
          </g>
        </svg>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.route-details-container {
  width: 100%;
  min-height: 100vh;
  background-color: var(--color-bg-base);
  padding: 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* Header styling */
.details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid var(--color-accent-sage);
  padding-bottom: 20px;
}

.btn-back {
  background-color: var(--color-white);
  color: var(--color-primary-dark);
  border: 1.5px solid var(--color-gray-200);
  border-radius: 8px;
  padding: 10px 18px;
  font-weight: 700;
  font-size: 13.5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
  font-family: var(--font-sans);
}

.btn-back:hover {
  background-color: var(--color-accent-sage);
  transform: translateX(-2px);
}

.arrow-icon {
  width: 16px;
  height: 16px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-title h2 {
  font-size: 22px;
  font-weight: 800;
  color: var(--color-primary-dark);
}

.header-title .highlight {
  color: var(--color-primary);
}

/* Loading & error states */
.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  flex-grow: 1;
}

.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid var(--color-accent-sage);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-bottom: 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p {
  font-size: 15px;
  color: var(--color-gray-500);
  font-weight: 600;
}

.error-state h3 {
  color: var(--color-danger);
  margin-bottom: 8px;
}

.btn-retry {
  margin-top: 16px;
  background-color: var(--color-primary);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font-sans);
}

/* Main content layout */
.details-grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 28px;
  align-items: start;
}

.left-pane {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.right-pane {
  display: flex;
  flex-direction: column;
}

/* Card structures */
.info-card, .timeline-card, .map-visualization {
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.card-header {
  border-bottom: 1.5px solid var(--color-gray-100);
  padding: 16px 20px;
  background-color: var(--color-gray-50);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary-dark);
}

/* Operational specs info */
.specs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 20px;
  gap: 16px;
}

.spec-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.spec-item .label {
  font-size: 11px;
  color: var(--color-gray-500);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.spec-item .value {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-gray-800);
}

/* Driver Profile Info */
.driver-profile {
  display: flex;
  gap: 16px;
  padding: 20px;
  align-items: center;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-accent-sage);
  color: var(--color-primary-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 18px;
  box-shadow: var(--shadow-sm);
}

.profile-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-details h4 {
  font-size: 15px;
  color: var(--color-gray-800);
}

.id-badge {
  font-family: monospace;
  font-size: 11px;
  color: var(--color-gray-500);
}

.profile-details .status-pill {
  width: fit-content;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
}

.profile-details .status-pill.active {
  background-color: rgba(21, 128, 61, 0.1);
  color: var(--color-success);
}

.profile-details .status-pill.active .dot {
  width: 6px;
  height: 6px;
  background-color: var(--color-success);
  border-radius: 50%;
}

.contact-num {
  font-size: 12px;
  color: var(--color-gray-800);
  font-weight: 600;
}

.empty-profile, .empty-timeline {
  padding: 30px;
  text-align: center;
  color: var(--color-gray-500);
  font-size: 13px;
}

/* Route Status pill shapes */
.route-status-pill {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.route-status-pill.draft { background-color: #e2e8f0; color: #475569; }
.route-status-pill.published { background-color: #dbeafe; color: #1e40af; }
.route-status-pill.active { background-color: #dcfce7; color: #15803d; }
.route-status-pill.completed { background-color: #f1f5f9; color: #64748b; }
.route-status-pill.cancelled { background-color: #fee2e2; color: #991b1b; }

/* Lifecycle Controls */
.lifecycle-controls {
  padding: 20px;
}

.help-text {
  font-size: 12px;
  color: var(--color-gray-500);
  margin-bottom: 12px;
  line-height: 1.4;
}

.btn-group-column {
  display: flex;
  flex-direction: column;
}

.btn-group-row {
  display: flex;
  gap: 10px;
}

.btn-lifecycle {
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
  text-align: center;
}

.btn-lifecycle.publish { background-color: var(--color-primary); color: white; }
.btn-lifecycle.publish:hover { background-color: var(--color-primary-dark); }

.btn-lifecycle.activate { background-color: #16a34a; color: white; flex-grow: 1; }
.btn-lifecycle.activate:hover { background-color: #15803d; }

.btn-lifecycle.cancel { background-color: #dc2626; color: white; flex-grow: 1; }
.btn-lifecycle.cancel:hover { background-color: #b91c1c; }

.btn-lifecycle.complete { background-color: #2563eb; color: white; flex-grow: 1; }
.btn-lifecycle.complete:hover { background-color: #1d4ed8; }

.locked-state {
  font-size: 12.5px;
  color: var(--color-gray-500);
  background-color: var(--color-gray-50);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}

/* Timeline/Stop List styles */
.timeline-card {
  padding-bottom: 20px;
}

.badge-count {
  background-color: var(--color-accent-sage);
  color: var(--color-primary-dark);
  font-size: 11.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
}

.timeline-list {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
}

/* Vertical timeline vertical connector line */
.timeline-list::before {
  content: '';
  position: absolute;
  left: 44px;
  top: 36px;
  bottom: 36px;
  width: 2px;
  background-color: var(--color-gray-200);
}

.timeline-item {
  display: flex;
  gap: 20px;
  position: relative;
  z-index: 10;
}

.timeline-item.draggable-item {
  cursor: grab;
}

.timeline-item.draggable-item:active {
  cursor: grabbing;
}

.timeline-badge {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--color-white);
  border: 2.5px solid var(--color-gray-200);
  color: var(--color-gray-800);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  transition: all 0.25s ease;
}

.timeline-item.delivered .timeline-badge {
  border-color: var(--color-success);
  background-color: rgba(21, 128, 61, 0.05);
  color: var(--color-success);
}

.timeline-item.failed .timeline-badge {
  border-color: var(--color-danger);
  background-color: rgba(185, 28, 28, 0.05);
  color: var(--color-danger);
}

.timeline-item.out_for_delivery .timeline-badge {
  border-color: #8b5cf6;
  background-color: rgba(139, 92, 246, 0.05);
  color: #8b5cf6;
}

.stop-content {
  background-color: var(--color-white);
  border: 1.5px solid var(--color-gray-200);
  border-radius: 10px;
  padding: 16px;
  flex-grow: 1;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.25s;
}

.timeline-item:hover .stop-content {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.stop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.stop-id {
  font-family: monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-gray-500);
}

.badge-group {
  display: flex;
  gap: 6px;
  align-items: center;
}

.priority-pill {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.priority-pill.high { background-color: var(--color-danger-bg); color: var(--color-danger); }
.priority-pill.medium { background-color: #fef3c7; color: #d97706; }
.priority-pill.low { background-color: rgba(48, 109, 41, 0.08); color: var(--color-primary); }

.stop-status-badge {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
}
.stop-status-badge.pending { background-color: #fef3c7; color: #d97706; }
.stop-status-badge.routed { background-color: #dbeafe; color: #1e40af; }
.stop-status-badge.out_for_delivery { background-color: #f3e8ff; color: #7e22ce; }
.stop-status-badge.delivered { background-color: #dcfce7; color: #15803d; }
.stop-status-badge.failed { background-color: #fee2e2; color: #b91c1c; }

.stop-details-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stop-details-body .customer {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--color-gray-800);
}

.stop-details-body .address {
  font-size: 12.5px;
  color: var(--color-gray-500);
}

.stop-details-body .package {
  font-size: 11.5px;
  color: var(--color-gray-500);
}

.fail-reason {
  font-size: 11px;
  color: var(--color-danger);
  font-weight: 600;
  margin-top: 4px;
  background-color: rgba(239, 68, 68, 0.05);
  padding: 6px 8px;
  border-radius: 4px;
  border-left: 2.5px solid var(--color-danger);
}

/* Stop execution buttons */
.stop-actions {
  margin-top: 6px;
  border-top: 1px solid var(--color-gray-100);
  padding-top: 10px;
}

.stop-btn-row {
  display: flex;
  gap: 8px;
}

.btn-stop-action {
  font-size: 11px;
  font-weight: 700;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
  text-align: center;
}

.btn-stop-action.start { background-color: #7e22ce; color: white; }
.btn-stop-action.complete { background-color: #16a34a; color: white; flex-grow: 1; }
.btn-stop-action.fail { background-color: #dc2626; color: white; flex-grow: 1; }

.btn-stop-action:hover {
  opacity: 0.9;
  transform: translateY(-0.5px);
}

/* Bottom map styling */
.map-visualization {
  margin-top: 8px;
}

.map-wrapper {
  padding: 24px;
  background-color: var(--color-gray-50);
  display: flex;
  justify-content: center;
}

.map-svg {
  width: 100%;
  max-width: 600px;
  background-color: var(--color-white);
  border: 1.5px solid var(--color-gray-200);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
}

.map-label {
  font-size: 8px;
  font-weight: 700;
  fill: var(--color-gray-800);
  font-family: var(--font-sans);
  background-color: var(--color-white);
}

.pulse-ring {
  transform-origin: center;
  animation: ripple 2s infinite ease-out;
}

@keyframes ripple {
  0% { r: 6.5; opacity: 1; stroke-width: 1.5; }
  100% { r: 16; opacity: 0; stroke-width: 0.5; }
}

/* Responsiveness */
@media (max-width: 900px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
  .route-details-container {
    padding: 20px;
  }
}
</style>
