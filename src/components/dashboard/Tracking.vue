<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import DashboardLayout from '../common/DashboardLayout.vue'
import { useWebsocket } from '../../composables/useWebsocket'
import apiClient from '../../services/api'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icon path issue in Vite build
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

interface DriverItem {
  driverId: string
  employeeId: string
  firstName: string
  lastName: string
  phoneNumber: string
  active: boolean
}

const drivers = ref<DriverItem[]>([])
const loadingDrivers = ref(false)
const selectedDriver = ref<DriverItem | null>(null)

// Map and marker instance
let mapInstance: L.Map | null = null
let markerInstance: L.Marker | null = null

const {
  connected,
  lastLocation,
  locationLog,
  connect: connectWs,
  disconnect: disconnectWs,
  subscribeToDriver
} = useWebsocket()

const loadDriversList = async () => {
  loadingDrivers.value = true
  try {
    const res = await apiClient.get('/drivers')
    if (res.data && res.data.status === 'success') {
      // Filter for active drivers only for real-time tracking
      const allDrivers = res.data.data?.content || res.data.data || []
      drivers.value = allDrivers.filter((d: any) => d.active)
    }
  } catch (err) {
    console.error('Failed to load drivers for tracking:', err)
  } finally {
    loadingDrivers.value = false
  }
}

const selectDriver = (driver: DriverItem) => {
  selectedDriver.value = driver
  locationLog.value = [] // Clear history log
  
  // Connect and subscribe to the selected driver topic
  connectWs()
  
  // Try fetching latest known location from database first
  apiClient.get(`/tracking/location/${driver.driverId}`).then((res) => {
    if (res.data && res.data.status === 'success' && res.data.data) {
      const dbLoc = res.data.data
      updateMapPosition(dbLoc.latitude, dbLoc.longitude)
    }
  }).catch((e) => {
    console.warn('Could not query database location for starting coordinate:', e)
  })

  // Subscribe to live broker updates
  subscribeToDriver(driver.driverId, (newLoc) => {
    updateMapPosition(newLoc.latitude, newLoc.longitude)
  })
}

const updateMapPosition = (latitude: number, longitude: number) => {
  if (!mapInstance) return

  const latLng = L.latLng(latitude, longitude)
  
  if (markerInstance) {
    markerInstance.setLatLng(latLng)
  } else {
    markerInstance = L.marker(latLng).addTo(mapInstance)
  }

  // Soft pan to coordinate
  mapInstance.setView(latLng, 14, { animate: true })
}

onMounted(() => {
  loadDriversList()

  // Initialize Leaflet Map centered in India/Delhi default view
  mapInstance = L.map('tracking-map-canvas', {
    zoomControl: true,
    attributionControl: false
  }).setView([28.6139, 77.2090], 10)

  // Use OpenStreetMap standard tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapInstance)
})

onUnmounted(() => {
  disconnectWs()
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
  markerInstance = null
})

const formatTime = (timeStr: string) => {
  return new Date(timeStr).toLocaleTimeString()
}
</script>

<template>
  <DashboardLayout>
    <div class="page-title-section">
      <h1>Live Operator Telemetry</h1>
      <p class="subtitle">Subscribe to active driver terminals and track delivery vehicles in real-time</p>
    </div>

    <div class="tracking-split-layout">
      <!-- Left pane: Active drivers selection list -->
      <div class="tracking-sidebar">
        <div class="sidebar-header">
          <h3>Active Drivers</h3>
          <span class="badge-count">{{ drivers.length }} online</span>
        </div>

        <div v-if="loadingDrivers" class="loading-state">
          <div class="spinner-small"></div>
          <span>Loading list...</span>
        </div>

        <div v-else-if="drivers.length === 0" class="empty-state">
          <p>No active drivers currently registered for tracking.</p>
        </div>

        <div v-else class="drivers-scrollable-list">
          <div 
            v-for="driver in drivers" 
            :key="driver.driverId" 
            class="driver-item"
            :class="{ active: selectedDriver?.driverId === driver.driverId }"
            @click="selectDriver(driver)"
          >
            <div class="avatar-small">
              {{ driver.firstName[0] }}{{ driver.lastName[0] }}
            </div>
            <div class="info">
              <h4>{{ driver.firstName }} {{ driver.lastName }}</h4>
              <span>ID: {{ driver.employeeId }}</span>
            </div>
            <span class="indicator-dot"></span>
          </div>
        </div>
      </div>

      <!-- Center pane: Live OpenStreetMap Render -->
      <div class="map-container">
        <div id="tracking-map-canvas"></div>
      </div>

      <!-- Right pane: Console log and STOMP details -->
      <div class="console-pane">
        <div class="console-header">
          <h3>WebSocket Telemetry Log</h3>
          <span class="socket-status" :class="{ connected }">
            {{ connected ? 'STOMP CONNECTED' : 'STOMP DISCONNECTED' }}
          </span>
        </div>

        <div class="console-body" v-if="selectedDriver">
          <div class="driver-status-card">
            <h4>{{ selectedDriver.firstName }} {{ selectedDriver.lastName }}</h4>
            <span class="driver-phone">📞 {{ selectedDriver.phoneNumber }}</span>
            
            <div class="coords-box" v-if="lastLocation">
              <span class="coords-lbl">LATEST GPS SIGNAL</span>
              <span class="coords-val">{{ lastLocation.latitude.toFixed(6) }}, {{ lastLocation.longitude.toFixed(6) }}</span>
            </div>
            <div class="coords-box unassigned" v-else>
              <span>Awaiting coordinates broadcast signal...</span>
            </div>
          </div>

          <div class="log-stream-box">
            <h5>Signal Stream</h5>
            <div class="stream-log-list">
              <div 
                v-for="(log, idx) in locationLog" 
                :key="idx" 
                class="log-item"
              >
                <span class="log-time">{{ formatTime(log.timestamp) }}</span>
                <span class="log-txt">GPS Ping: {{ log.latitude.toFixed(5) }}, {{ log.longitude.toFixed(5) }}</span>
              </div>
              <div v-if="locationLog.length === 0" class="empty-log-text">
                No telemetry log data. Telemetry logs update automatically.
              </div>
            </div>
          </div>
        </div>
        
        <div class="empty-console" v-else>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="radar-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12z" />
          </svg>
          <p>Select an active operator to initiate live vehicle telemetry.</p>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.page-title-section h1 {
  font-size: 24px;
  font-weight: 800;
  color: var(--color-primary-dark);
}

.page-title-section .subtitle {
  font-size: 13px;
  color: var(--color-gray-500);
}

.tracking-split-layout {
  display: flex;
  height: calc(100vh - 180px);
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

/* Sidebar selection list styles */
.tracking-sidebar {
  width: 250px;
  border-right: 1.5px solid var(--color-gray-150);
  background-color: var(--color-gray-50);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1.5px solid var(--color-gray-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.badge-count {
  background-color: var(--color-accent-sage);
  color: var(--color-primary-dark);
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--color-gray-500);
  font-size: 12.5px;
}

.spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-accent-sage);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-bottom: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.drivers-scrollable-list {
  flex-grow: 1;
  overflow-y: auto;
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.driver-item {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.driver-item:hover {
  background-color: var(--color-gray-100);
}

.driver-item.active {
  background-color: rgba(48, 109, 41, 0.08);
  border-left: 3.5px solid var(--color-primary);
  padding-left: 12.5px;
}

.avatar-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--color-accent-sage);
  color: var(--color-primary-dark);
  font-weight: 800;
  font-size: 11.5px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.driver-item .info h4 {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-gray-800);
}

.driver-item .info span {
  font-size: 10.5px;
  color: var(--color-gray-500);
  font-family: monospace;
}

.indicator-dot {
  position: absolute;
  right: 16px;
  width: 6.5px;
  height: 6.5px;
  border-radius: 50%;
  background-color: var(--color-success);
}

/* Map canvas styles */
.map-container {
  flex-grow: 1;
  background-color: #f6f5f0;
  position: relative;
}

#tracking-map-canvas {
  width: 100%;
  height: 100%;
  z-index: 10;
}

/* Console pane styling */
.console-pane {
  width: 320px;
  border-left: 1.5px solid var(--color-gray-200);
  background-color: var(--color-gray-50);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.console-header {
  padding: 16px;
  border-bottom: 1.5px solid var(--color-gray-200);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.console-header h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.socket-status {
  font-size: 9.5px;
  font-weight: 800;
  color: var(--color-danger);
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.socket-status.connected {
  color: var(--color-success);
}

.console-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-grow: 1;
  overflow-y: auto;
}

.driver-status-card {
  padding: 14px;
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.driver-status-card h4 {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-gray-800);
}

.driver-phone {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gray-500);
}

.coords-box {
  margin-top: 8px;
  background-color: rgba(48, 109, 41, 0.06);
  border: 1.5px solid var(--color-accent-sage);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.coords-box.unassigned {
  background-color: var(--color-gray-100);
  border-color: var(--color-gray-200);
  color: var(--color-gray-500);
  font-size: 11.5px;
  text-align: center;
  font-weight: 600;
}

.coords-lbl {
  font-size: 9px;
  font-weight: 800;
  color: var(--color-primary-dark);
}

.coords-val {
  font-family: monospace;
  font-weight: 700;
  font-size: 13.5px;
  color: var(--color-primary);
}

.log-stream-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-grow: 1;
}

.log-stream-box h5 {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--color-gray-500);
  letter-spacing: 0.5px;
}

.stream-log-list {
  background-color: var(--color-gray-800);
  color: #38bdf8;
  font-family: monospace;
  font-size: 11px;
  padding: 10px;
  border-radius: 8px;
  height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.2);
}

.log-item {
  display: flex;
  gap: 6px;
  line-height: 1.3;
}

.log-time {
  color: var(--color-accent-sage);
}

.log-txt {
  word-break: break-all;
}

.empty-log-text {
  color: #64748b;
  text-align: center;
  padding: 40px 10px;
}

.empty-console {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: var(--color-gray-500);
  font-size: 13px;
  gap: 12px;
}

.radar-icon {
  width: 48px;
  height: 48px;
  color: var(--color-accent-sage);
  animation: pulse 2s infinite ease-in-out;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.7; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.7; }
}
</style>
