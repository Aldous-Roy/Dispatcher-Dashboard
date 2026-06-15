<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DashboardLayout from '../common/DashboardLayout.vue'
import { usePagination } from '../../composables/usePagination'
import apiClient from '../../services/api'

interface RouteItem {
  routeId: string
  routeCode: string
  routeDate: string
  status: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  driverId: string | null
  totalDistanceKm: number
  estimatedDurationMins: number
}

const router = useRouter()

// Fetch helper mapping standard REST API query parameters
const fetchRoutes = async (params: { page: number; size: number; sort: string; search: string }) => {
  return apiClient.get('/routes', {
    params: {
      page: params.page,
      size: params.size,
      sort: params.sort,
      search: params.search
    }
  })
}

const {
  items: routes,
  total,
  loading,
  error,
  page,
  size,
  search,
  sort,
  loadData,
  handleSearch,
  handleSort,
  changePage
} = usePagination<RouteItem>(fetchRoutes, 'routeDate,desc', 10)

// Form drawer state for adding route
const showAddDrawer = ref(false)
const formRouteCode = ref('')
const formRouteDate = ref(new Date().toISOString().slice(0, 10))
const formDistance = ref(15.0)
const formDuration = ref(60)
const formPolyline = ref('encoded-polyline-placeholder')
const submitting = ref(false)
const formError = ref<string | null>(null)

const handleAddRoute = async () => {
  submitting.value = true
  formError.value = null
  try {
    const res = await apiClient.post('/routes', {
      routeCode: formRouteCode.value,
      routeDate: formRouteDate.value,
      totalDistanceKm: formDistance.value,
      estimatedDurationMins: formDuration.value,
      routePolyline: formPolyline.value
    })
    
    if (res.data && res.data.status === 'success') {
      showAddDrawer.value = false
      // Reset form
      formRouteCode.value = ''
      formRouteDate.value = new Date().toISOString().slice(0, 10)
      formDistance.value = 15.0
      formDuration.value = 60
      formPolyline.value = 'encoded-polyline-placeholder'
      // Refetch page
      loadData()
    } else {
      throw new Error(res.data.message || 'Creation failed')
    }
  } catch (err: any) {
    formError.value = err.response?.data?.message || err.message || 'Failed to create route'
  } finally {
    submitting.value = false
  }
}

// Assign Driver Drawer State
const showAssignDrawer = ref(false)
const assigningRouteId = ref<string | null>(null)
const availableDrivers = ref<any[]>([])
const selectedDriverId = ref('')
const assigningDriver = ref(false)
const assignError = ref<string | null>(null)

const openAssignDrawer = async (routeId: string) => {
  assigningRouteId.value = routeId
  selectedDriverId.value = ''
  assignError.value = null
  showAssignDrawer.value = true
  
  try {
    const res = await apiClient.get('/drivers')
    if (res.data && res.data.status === 'success') {
      const allDrivers = res.data.data?.content || res.data.data || []
      availableDrivers.value = allDrivers.filter((d: any) => d.active)
    }
  } catch (err) {
    console.warn('Failed to load available drivers:', err)
  }
}

const handleAssignDriver = async () => {
  if (!selectedDriverId.value || !assigningRouteId.value) return
  
  assigningDriver.value = true
  assignError.value = null
  
  try {
    const res = await apiClient.post(`/routes/${assigningRouteId.value}/assign-driver`, {
      driverId: selectedDriverId.value
    })
    
    if (res.data && res.data.status === 'success') {
      showAssignDrawer.value = false
      loadData()
    } else {
      throw new Error(res.data.message || 'Assignment failed')
    }
  } catch (err: any) {
    assignError.value = err.response?.data?.message || err.message || 'Failed to assign driver'
  } finally {
    assigningDriver.value = false
  }
}

const viewDetails = (routeId: string) => {
  router.push(`/routes/${routeId}`)
}
</script>

<template>
  <DashboardLayout>
    <div class="page-title-section">
      <div class="title-left">
        <h1>Dispatch Routes</h1>
        <p class="subtitle">Create new corridors, assign orders, and monitor active route schedules</p>
      </div>
      <button @click="showAddDrawer = true" class="btn-create">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="plus-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Create Route
      </button>
    </div>

    <section class="table-section">
      <div class="card-header border-none">
        <div class="header-left">
          <h3>Registered Dispatch Schedules</h3>
          <span class="badge-count">{{ total }} routes</span>
        </div>
        
        <!-- Search bar -->
        <div class="search-box">
          <input 
            type="text" 
            v-model="search" 
            @input="handleSearch"
            placeholder="Search route code..."
            class="input-search"
          />
          <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <!-- Loading / Error States -->
      <div v-if="loading" class="loading-state-box">
        <div class="spinner"></div>
        <p>Syncing dispatch routes...</p>
      </div>

      <div v-else-if="error" class="error-state-box">
        <p class="error-msg">⚠️ {{ error }}</p>
        <button @click="changePage(page)" class="btn-retry">Retry Load</button>
      </div>

      <!-- Table Content -->
      <div v-else class="table-wrapper">
        <table class="fleet-table">
          <thead>
            <tr>
              <th class="sortable" @click="handleSort('routeId')">
                Route ID
                <span v-if="sort.startsWith('routeId,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th class="sortable" @click="handleSort('routeCode')">
                Route Code
                <span v-if="sort.startsWith('routeCode,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th class="sortable" @click="handleSort('routeDate')">
                Route Date
                <span v-if="sort.startsWith('routeDate,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th class="sortable" @click="handleSort('totalDistanceKm')">
                Distance
                <span v-if="sort.startsWith('totalDistanceKm,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th class="sortable" @click="handleSort('estimatedDurationMins')">
                Est. Duration
                <span v-if="sort.startsWith('estimatedDurationMins,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th>Operator ID</th>
              <th class="sortable" @click="handleSort('status')">
                Status
                <span v-if="sort.startsWith('status,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="route in routes" :key="route.routeId" class="driver-row" @click="viewDetails(route.routeId)">
              <td class="driver-id">{{ route.routeId.slice(0, 8) }}...</td>
              <td class="driver-name">{{ route.routeCode }}</td>
              <td class="date-cell">{{ route.routeDate }}</td>
              <td class="cap-cell">{{ route.totalDistanceKm }} km</td>
              <td class="cap-cell">{{ route.estimatedDurationMins }} mins</td>
              <td class="employee-id-cell">{{ route.driverId || 'Unassigned' }}</td>
              <td>
                <span class="route-status-pill" :class="route.status.toLowerCase()">
                  {{ route.status }}
                </span>
              </td>
              <td @click.stop style="display: flex; gap: 8px;">
                <button 
                  v-if="!route.driverId && (route.status === 'DRAFT' || route.status === 'PUBLISHED')" 
                  @click="openAssignDrawer(route.routeId)" 
                  class="btn-toggle-status"
                  style="background-color: var(--color-primary); color: white;"
                >
                  Assign Driver
                </button>
                <button @click="viewDetails(route.routeId)" class="btn-toggle-status">
                  View Details
                </button>
              </td>
            </tr>
            <tr v-if="routes.length === 0">
              <td colspan="8" class="empty-row-text">No dispatch routes registered on the server.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="pagination-footer" v-if="total > 0 && !loading && !error">
        <span class="page-info">
          Showing page {{ page }} of {{ Math.ceil(total / size) }}
        </span>
        <div class="pagination-buttons">
          <button 
            @click="changePage(page - 1)" 
            :disabled="page <= 1"
            class="btn-page"
          >
            Previous
          </button>
          <button 
            @click="changePage(page + 1)" 
            :disabled="page >= Math.ceil(total / size)"
            class="btn-page"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <!-- Create Route Slide Out Drawer -->
    <div class="details-drawer-overlay" v-if="showAddDrawer" @click="showAddDrawer = false">
      <div class="details-drawer" @click.stop>
        <div class="drawer-header">
          <h2>Create Dispatch Route</h2>
          <button @click="showAddDrawer = false" class="btn-close-drawer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="close-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form @submit.prevent="handleAddRoute" class="drawer-form">
          <div v-if="formError" class="form-error-banner">
            {{ formError }}
          </div>
          <div class="form-group">
            <label>Route Code</label>
            <input type="text" v-model="formRouteCode" required class="input-form" placeholder="e.g. RT-20260612-01" />
          </div>
          <div class="form-group">
            <label>Route Date</label>
            <input type="date" v-model="formRouteDate" required class="input-form" />
          </div>
          <div class="form-group">
            <label>Total Distance (km)</label>
            <input type="number" step="0.1" v-model="formDistance" required class="input-form" min="0.1" />
          </div>
          <div class="form-group">
            <label>Estimated Duration (mins)</label>
            <input type="number" v-model="formDuration" required class="input-form" min="1" />
          </div>
          <button type="submit" :disabled="submitting" class="btn-submit-form">
            <span v-if="submitting">Saving Route...</span>
            <span v-else>Create Route</span>
          </button>
        </form>
      </div>
    </div>

    <!-- Assign Driver Drawer -->
    <div class="details-drawer-overlay" v-if="showAssignDrawer" @click="showAssignDrawer = false">
      <div class="details-drawer" @click.stop>
        <div class="drawer-header">
          <h2>Assign Driver</h2>
          <button @click="showAssignDrawer = false" class="btn-close-drawer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="close-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form @submit.prevent="handleAssignDriver" class="drawer-form">
          <div v-if="assignError" class="form-error-banner">
            {{ assignError }}
          </div>
          <div class="form-group">
            <label>Select Driver</label>
            <select v-model="selectedDriverId" required class="input-form">
              <option value="" disabled>Select a driver...</option>
              <option v-for="d in availableDrivers" :key="d.driverId || d.employeeId" :value="d.driverId || d.employeeId">
                {{ d.firstName }} {{ d.lastName }} ({{ d.employeeId }})
              </option>
            </select>
          </div>
          <button type="submit" :disabled="assigningDriver || !selectedDriverId" class="btn-submit-form">
            <span v-if="assigningDriver">Assigning...</span>
            <span v-else>Assign Driver</span>
          </button>
        </form>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.page-title-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title-section h1 {
  font-size: 24px;
  font-weight: 800;
  color: var(--color-primary-dark);
}

.page-title-section .subtitle {
  font-size: 13px;
  color: var(--color-gray-500);
}

.btn-create {
  background-color: var(--color-primary);
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
  font-family: var(--font-sans);
}

.btn-create:hover {
  background-color: var(--color-primary-dark);
}

.plus-icon {
  width: 16px;
  height: 16px;
}

.table-section {
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-header {
  border-bottom: 1.5px solid var(--color-gray-100);
  padding: 16px 20px;
  background-color: var(--color-gray-50);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.card-header.border-none {
  border-bottom: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-left h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.badge-count {
  background-color: var(--color-accent-sage);
  color: var(--color-primary-dark);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
}

.search-box {
  position: relative;
  width: 280px;
}

.input-search {
  width: 100%;
  padding: 8px 14px;
  padding-left: 36px;
  border: 1.5px solid var(--color-gray-200);
  border-radius: 8px;
  background-color: var(--color-white);
  color: var(--color-gray-800);
  font-size: 12.5px;
  font-weight: 600;
  font-family: var(--font-sans);
  transition: all 0.2s;
}

.input-search:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(48, 109, 41, 0.1);
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 15px;
  height: 15px;
  color: var(--color-gray-500);
}

/* Table styles */
.table-wrapper {
  overflow-x: auto;
}

.fleet-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13.5px;
}

.fleet-table th {
  background-color: var(--color-gray-50);
  color: var(--color-gray-500);
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 20px;
  border-bottom: 1.5px solid var(--color-gray-200);
}

.fleet-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.fleet-table th.sortable:hover {
  color: var(--color-primary-dark);
  background-color: var(--color-gray-100);
}

.fleet-table td {
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-gray-100);
  color: var(--color-gray-800);
}

.driver-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.driver-row:hover {
  background-color: rgba(231, 225, 177, 0.15) !important;
}

.driver-id {
  font-family: monospace;
  font-weight: 700;
  color: var(--color-primary);
}

.employee-id-cell {
  font-family: monospace;
  color: var(--color-gray-500);
  font-weight: 600;
}

.driver-name {
  font-weight: 700;
}

.cap-cell {
  font-weight: 600;
  color: var(--color-gray-500);
}

.date-cell {
  font-size: 11.5px;
  color: var(--color-gray-500);
  font-weight: 500;
}

.btn-toggle-status {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid var(--color-primary);
  background-color: rgba(48, 109, 41, 0.05);
  color: var(--color-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.btn-toggle-status:hover {
  background-color: var(--color-primary);
  color: white;
}

/* Status pills */
.route-status-pill {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 0.5px;
  display: inline-block;
}

.route-status-pill.draft { background-color: #e2e8f0; color: #475569; }
.route-status-pill.published { background-color: #dbeafe; color: #1e40af; }
.route-status-pill.active { background-color: #dcfce7; color: #15803d; }
.route-status-pill.completed { background-color: #f1f5f9; color: #64748b; }
.route-status-pill.cancelled { background-color: #fee2e2; color: #991b1b; }

/* Slide Out Drawer Overlays */
.details-drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(13, 83, 14, 0.2);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
  backdrop-filter: blur(2px);
}

.details-drawer {
  width: 380px;
  background-color: var(--color-white);
  height: 100vh;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawer-header {
  padding: 20px;
  border-bottom: 1.5px solid var(--color-gray-100);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer-header h2 {
  font-size: 17px;
  font-weight: 800;
  color: var(--color-primary-dark);
}

.btn-close-drawer {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-gray-500);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-icon {
  width: 20px;
  height: 20px;
}

/* Form Styling */
.drawer-form {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-grow: 1;
  overflow-y: auto;
}

.form-error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  font-weight: 600;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-gray-800);
}

.input-form {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid var(--color-gray-200);
  border-radius: 8px;
  font-size: 13px;
  font-family: var(--font-sans);
  background-color: var(--color-white);
  color: var(--color-gray-800);
  transition: all 0.2s;
}

.input-form:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(48, 109, 41, 0.1);
}

.btn-submit-form {
  margin-top: 10px;
  background-color: var(--color-primary);
  color: white;
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.btn-submit-form:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}

.btn-submit-form:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Pagination styles */
.pagination-footer {
  border-top: 1.5px solid var(--color-gray-100);
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-info {
  font-size: 12.5px;
  color: var(--color-gray-500);
  font-weight: 600;
}

.pagination-buttons {
  display: flex;
  gap: 8px;
}

.btn-page {
  padding: 6px 12px;
  border: 1px solid var(--color-gray-200);
  border-radius: 6px;
  background-color: var(--color-white);
  color: var(--color-gray-800);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.btn-page:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-page:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-state-box, .error-state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  text-align: center;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3.5px solid var(--color-accent-sage);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-msg {
  color: var(--color-danger);
  font-weight: 600;
  margin-bottom: 12px;
}

.btn-retry {
  background-color: var(--color-primary);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font-sans);
}

.empty-row-text {
  text-align: center;
  color: var(--color-gray-500);
  padding: 30px !important;
  font-weight: 500;
}
</style>
