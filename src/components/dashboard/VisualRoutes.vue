<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DashboardLayout from '../common/DashboardLayout.vue'
import apiClient from '../../services/api'

interface Stop {
  orderId: string
  sequenceNumber: number
  customerName: string
  deliveryAddress: string
  status: string
  estimatedArrivalTime: string | null
  failedReasonNotes: string | null
  updatedAt: string | null
}

interface VisualRoute {
  routeId: string
  routeCode: string
  status: string
  driverId: string | null
  requiredVehicleType: string | null
  totalDistanceKm: number
  estimatedDurationMins: number
  stops: Stop[]
  driverName?: string
}

const routes = ref<VisualRoute[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const fetchDriverDetails = async (driverId: string) => {
  try {
    const res = await apiClient.get(`/drivers/${driverId}`)
    if (res.data?.status === 'success') {
      return res.data.data.firstName + ' ' + res.data.data.lastName
    }
  } catch (err) {
    console.error(err)
  }
  return 'Unknown Driver'
}

const fetchVisualRoutes = async () => {
  loading.value = true
  error.value = null
  try {
    // Fetch today's routes (simplified for UI, fetching first page)
    const res = await apiClient.get('/routes', { params: { size: 50, sort: 'routeDate,desc' } })
    if (res.data?.status === 'success') {
      const allRoutes = res.data.data.content || res.data.data
      
      const enrichedRoutes: VisualRoute[] = []
      
      for (const r of allRoutes) {
        if (r.status === 'COMPLETED' || r.status === 'CANCELLED') continue
        
        // Fetch stops
        const stopsRes = await apiClient.get(`/routes/${r.routeId}/stops`, { params: { size: 100 } })
        const stops = stopsRes.data?.data?.content || []
        
        // Sort stops by sequence
        stops.sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber)
        
        let dName = 'Unassigned'
        if (r.driverId) {
          dName = await fetchDriverDetails(r.driverId)
        }
        
        enrichedRoutes.push({
          ...r,
          stops,
          driverName: dName
        })
      }
      
      routes.value = enrichedRoutes
    }
  } catch (err: any) {
    error.value = 'Failed to load visual routes'
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchVisualRoutes()
})

const formatTime = (isoString: string | null) => {
  if (!isoString) return 'Pending'
  const d = new Date(isoString)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const getDelayStatus = (stop: Stop) => {
  if (stop.status === 'FAILED') return { text: 'Cannot be delivered', class: 'text-failed' }
  if (stop.status === 'DELIVERED') return { text: 'Delivered', class: 'text-success' }
  
  if (stop.status === 'OUT_FOR_DELIVERY' || stop.status === 'ROUTED') {
    if (stop.estimatedArrivalTime) {
      const eta = new Date(stop.estimatedArrivalTime).getTime()
      const now = new Date().getTime()
      const diffMins = Math.floor((now - eta) / 60000)
      
      if (diffMins > 0) {
        if (diffMins >= 60) {
          return { text: `Delayed ${Math.floor(diffMins/60)}hrs`, class: 'text-delayed' }
        }
        return { text: `Delayed ${diffMins}mins`, class: 'text-delayed' }
      }
      return { text: 'On Time', class: 'text-ontime' }
    }
  }
  return { text: 'Pending Dispatch', class: 'text-pending' }
}

const getVehicleIcon = (type: string | null) => {
  if (type === 'BIKE') return '🛵'
  if (type === 'VAN') return '🚐'
  return '🚚'
}
</script>

<template>
  <DashboardLayout>
    <div class="page-title-section">
      <div class="title-left">
        <h1>Visual Routes</h1>
        <p class="subtitle">Live train-line view of active routes and ETAs</p>
      </div>
      <button @click="fetchVisualRoutes" class="btn-refresh">
        Refresh Data
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading active routes...</p>
    </div>
    
    <div v-else-if="error" class="error-state">
      {{ error }}
    </div>

    <div v-else-if="routes.length === 0" class="empty-state">
      No active routes for today. Click "Auto Allocate Today's Orders" in Pending Orders to generate routes!
    </div>

    <div v-else class="routes-grid">
      <div v-for="route in routes" :key="route.routeId" class="route-card">
        <div class="route-header">
          <div class="header-main">
            <span class="vehicle-icon">{{ getVehicleIcon(route.requiredVehicleType) }}</span>
            <div class="header-info">
              <h3>{{ route.routeCode }}</h3>
              <span class="driver-name">{{ route.driverName }}</span>
            </div>
          </div>
          <span class="route-status" :class="route.status.toLowerCase()">{{ route.status }}</span>
        </div>
        
        <div class="train-line-container">
          <div v-for="(stop, index) in route.stops" :key="stop.orderId" class="stop-node">
            <div class="node-left">
              <div class="time-eta">{{ formatTime(stop.estimatedArrivalTime) }}</div>
            </div>
            
            <div class="node-center">
              <div class="line-segment" v-if="index !== route.stops.length - 1"></div>
              <div class="node-dot" :class="stop.status.toLowerCase()"></div>
            </div>
            
            <div class="node-right">
              <div class="stop-name">{{ stop.customerName }} - <span class="stop-id">{{ stop.orderId }}</span></div>
              <div class="stop-address">{{ stop.deliveryAddress }}</div>
              <div class="realtime-status" :class="getDelayStatus(stop).class">
                {{ getDelayStatus(stop).text }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.page-title-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}
.page-title-section h1 { font-size: 24px; font-weight: 800; color: var(--color-primary-dark); }
.page-title-section .subtitle { font-size: 13px; color: var(--color-gray-500); }
.btn-refresh {
  background-color: var(--color-white); border: 1.5px solid var(--color-gray-200);
  padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;
}
.loading-state, .error-state, .empty-state { text-align: center; padding: 60px; color: var(--color-gray-500); }
.spinner { width: 32px; height: 32px; border: 3px solid var(--color-accent-sage); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s infinite linear; margin: 0 auto 16px; }
@keyframes spin { to { transform: rotate(360deg); } }

.routes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 24px; }
.route-card { background: white; border-radius: 12px; border: 1px solid var(--color-gray-200); box-shadow: var(--shadow-sm); overflow: hidden; }
.route-header { padding: 16px 20px; background: var(--color-gray-50); border-bottom: 1px solid var(--color-gray-100); display: flex; justify-content: space-between; align-items: center; }
.header-main { display: flex; align-items: center; gap: 12px; }
.vehicle-icon { font-size: 24px; }
.header-info h3 { margin: 0; font-size: 15px; font-weight: 800; color: var(--color-primary-dark); }
.driver-name { font-size: 12px; color: var(--color-gray-500); font-weight: 600; }
.route-status { font-size: 10px; font-weight: 700; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; }
.route-status.created { background: #fef3c7; color: #d97706; }
.route-status.assigned { background: #dbeafe; color: #1e40af; }
.route-status.in_progress { background: #f3e8ff; color: #7e22ce; }

.train-line-container { padding: 24px 20px; }
.stop-node { display: flex; gap: 16px; position: relative; min-height: 80px; }
.node-left { width: 60px; text-align: right; padding-top: 2px; }
.time-eta { font-size: 12px; font-weight: 700; color: var(--color-gray-800); }
.node-center { width: 20px; position: relative; display: flex; justify-content: center; }
.line-segment { position: absolute; top: 16px; bottom: -16px; width: 2px; background: var(--color-gray-200); }
.node-dot { width: 14px; height: 14px; border-radius: 50%; background: white; border: 3px solid var(--color-gray-300); z-index: 2; margin-top: 2px; }
.node-dot.delivered { border-color: #16a34a; background: #dcfce7; }
.node-dot.failed { border-color: #dc2626; background: #fee2e2; }
.node-dot.out_for_delivery { border-color: #7e22ce; background: #f3e8ff; }
.node-dot.routed { border-color: #3b82f6; }

.node-right { flex: 1; padding-bottom: 24px; }
.stop-name { font-size: 13.5px; font-weight: 700; color: var(--color-gray-800); margin-bottom: 4px; }
.stop-id { color: var(--color-gray-400); font-family: monospace; font-size: 12px; }
.stop-address { font-size: 12px; color: var(--color-gray-500); line-height: 1.4; margin-bottom: 6px; }
.realtime-status { font-size: 11px; font-weight: 700; }
.text-failed { color: #dc2626; }
.text-success { color: #16a34a; }
.text-delayed { color: #d97706; }
.text-ontime { color: #16a34a; }
.text-pending { color: var(--color-gray-400); }
</style>
