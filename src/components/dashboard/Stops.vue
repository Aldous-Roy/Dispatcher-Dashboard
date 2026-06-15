<script setup lang="ts">
import { ref } from 'vue'
import DashboardLayout from '../common/DashboardLayout.vue'
import { usePagination } from '../../composables/usePagination'
import apiClient from '../../services/api'

interface StopItem {
  orderId: string
  routeCode: string | null
  sequenceNumber: number | null
  customerName: string
  customerPhone: string
  deliveryAddress: string
  status: 'PENDING' | 'ROUTED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED'
  requiredPodType: string
  estimatedArrivalTime: string | null
  createdAt: string
  updatedAt: string
}

// Fetch helper mapping standard REST API query parameters
const fetchStops = async (params: { page: number; size: number; sort: string; search: string }) => {
  return apiClient.get('/stops', {
    params: {
      page: params.page,
      size: params.size,
      sort: params.sort,
      search: params.search
    }
  })
}

const {
  items: stops,
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
} = usePagination<StopItem>(fetchStops, 'createdAt,desc', 10)

// Form drawer state for adding stop
const showAddDrawer = ref(false)
const formOrderId = ref('')
const formCustomerName = ref('')
const formCustomerPhone = ref('')
const formAddress = ref('')
const formLatitude = ref(12.9715987)
const formLongitude = ref(77.594566)
const formTimeStart = ref(new Date().toISOString().slice(0, 16))
const formTimeEnd = ref(new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 16))
const formWeight = ref(1.0)
const formVolume = ref(0.01)
const formServiceMins = ref(5)
const formPodType = ref('PHOTO_REQUIRED')
const submitting = ref(false)
const formError = ref<string | null>(null)

const handleAddStop = async () => {
  submitting.value = true
  formError.value = null
  try {
    const res = await apiClient.post('/stops', {
      orderId: formOrderId.value,
      routeCode: null, // Always unassigned initially
      customerName: formCustomerName.value,
      customerPhone: formCustomerPhone.value,
      deliveryAddress: formAddress.value,
      latitude: formLatitude.value,
      longitude: formLongitude.value,
      timeWindowStart: formTimeStart.value,
      timeWindowEnd: formTimeEnd.value,
      packageWeightKg: formWeight.value,
      packageVolumeCbms: formVolume.value,
      serviceTimeMins: formServiceMins.value,
      requiredPodType: formPodType.value
    })
    
    if (res.data && res.data.status === 'success') {
      showAddDrawer.value = false
      // Reset form
      formOrderId.value = ''
      formCustomerName.value = ''
      formCustomerPhone.value = ''
      formAddress.value = ''
      formLatitude.value = 12.9715987
      formLongitude.value = 77.594566
      formWeight.value = 1.0
      formVolume.value = 0.01
      formServiceMins.value = 5
      formPodType.value = 'PHOTO_REQUIRED'
      // Refetch page
      loadData()
    } else {
      throw new Error(res.data.message || 'Creation failed')
    }
  } catch (err: any) {
    formError.value = err.response?.data?.message || err.message || 'Failed to create stop'
  } finally {
    submitting.value = false
  }
}

// Assign Route Drawer State
const showAssignDrawer = ref(false)
const assigningStopId = ref<string | null>(null)
const availableRoutes = ref<any[]>([])
const selectedRouteId = ref('')
const assigningRoute = ref(false)
const assignError = ref<string | null>(null)
const loadingRoutes = ref(false)

const openAssignDrawer = async (stop: StopItem) => {
  assigningStopId.value = stop.orderId
  selectedRouteId.value = ''
  assignError.value = null
  availableRoutes.value = []
  showAssignDrawer.value = true
  loadingRoutes.value = true
  
  try {
    const res = await apiClient.get('/routes', {
      params: { page: 0, size: 100, sort: 'routeDate,desc' }
    })
    if (res.data && res.data.status === 'success') {
      const allRoutes = res.data.data?.content || res.data.data || []
      // Show all non-terminal routes (exclude COMPLETED and CANCELLED)
      availableRoutes.value = allRoutes.filter(
        (r: any) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED'
      )
    }
  } catch (err: any) {
    console.warn('Failed to load available routes:', err)
    assignError.value = 'Failed to load routes. Please try again.'
  } finally {
    loadingRoutes.value = false
  }
}

const handleAssignRoute = async () => {
  if (!selectedRouteId.value || !assigningStopId.value) return
  
  assigningRoute.value = true
  assignError.value = null
  
  try {
    const res = await apiClient.post(`/routes/${selectedRouteId.value}/assign-orders`, {
      orderIds: [assigningStopId.value]
    })
    
    if (res.data && res.data.status === 'success') {
      showAssignDrawer.value = false
      loadData()
    } else {
      throw new Error(res.data.message || 'Assignment failed')
    }
  } catch (err: any) {
    assignError.value = err.response?.data?.message || err.message || 'Failed to assign route'
  } finally {
    assigningRoute.value = false
  }
}

// Stop state actions
const startDelivery = async (stop: StopItem) => {
  try {
    const res = await apiClient.post(`/stops/${stop.orderId}/start-delivery`)
    if (res.data && res.data.status === 'success') {
      loadData()
    }
  } catch (err) {
    console.error('Failed to start delivery:', err)
  }
}

const completeDelivery = async (stop: StopItem) => {
  try {
    const res = await apiClient.post(`/stops/${stop.orderId}/complete-delivery`)
    if (res.data && res.data.status === 'success') {
      loadData()
    }
  } catch (err) {
    console.error('Failed to complete delivery:', err)
  }
}

const failDelivery = async (stop: StopItem) => {
  const reason = prompt('Please enter the failure reason:', 'Customer not available')
  if (reason === null) return
  
  try {
    const res = await apiClient.post(`/stops/${stop.orderId}/fail-delivery`, {
      reason
    })
    if (res.data && res.data.status === 'success') {
      loadData()
    }
  } catch (err) {
    console.error('Failed to fail delivery:', err)
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <DashboardLayout>
    <div class="page-title-section">
      <div class="title-left">
        <h1>Stops / Orders</h1>
        <p class="subtitle">Import dispatch stops, register package dimensions, and change delivery execution states</p>
      </div>
      <button @click="showAddDrawer = true" class="btn-create">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="plus-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Register Stop
      </button>
    </div>

    <section class="table-section">
      <div class="card-header border-none">
        <div class="header-left">
          <h3>Logistics Stops Registry</h3>
          <span class="badge-count">{{ total }} items</span>
        </div>
        
        <!-- Search bar -->
        <div class="search-box">
          <input 
            type="text" 
            v-model="search" 
            @input="handleSearch"
            placeholder="Search order, customer, address, route..."
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
        <p>Syncing stops registry...</p>
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
              <th class="sortable" @click="handleSort('orderId')">
                Order ID
                <span v-if="sort.startsWith('orderId,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th class="sortable" @click="handleSort('routeCode')">
                Route Code
                <span v-if="sort.startsWith('routeCode,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Delivery Address</th>
              <th class="sortable" @click="handleSort('status')">
                Status
                <span v-if="sort.startsWith('status,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th>POD Constraint</th>
              <th>Registered At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stop in stops" :key="stop.orderId">
              <td class="driver-id">{{ stop.orderId }}</td>
              <td class="employee-id-cell">{{ stop.routeCode || 'Unassigned' }}</td>
              <td class="driver-name">{{ stop.customerName }}</td>
              <td class="phone-cell">{{ stop.customerPhone }}</td>
              <td class="address-cell" :title="stop.deliveryAddress">{{ stop.deliveryAddress.slice(0, 30) }}...</td>
              <td>
                <span class="stop-status-badge" :class="stop.status.toLowerCase()">
                  {{ stop.status.replace(/_/g, ' ') }}
                </span>
              </td>
              <td class="pod-cell">{{ stop.requiredPodType }}</td>
              <td class="date-cell">{{ formatDate(stop.createdAt) }}</td>
              <td>
                <div class="actions-cell-group">
                  <button 
                    v-if="stop.status === 'PENDING'" 
                    @click="openAssignDrawer(stop)" 
                    class="btn-stop-action"
                    style="background-color: var(--color-primary); color: white;"
                  >
                    Assign Route
                  </button>
                  <button 
                    v-else-if="stop.status === 'ROUTED'" 
                    @click="startDelivery(stop)" 
                    class="btn-stop-action start"
                  >
                    Start
                  </button>
                  <template v-else-if="stop.status === 'OUT_FOR_DELIVERY'">
                    <button @click="completeDelivery(stop)" class="btn-stop-action complete">Ok</button>
                    <button @click="failDelivery(stop)" class="btn-stop-action fail">Fail</button>
                  </template>
                  <span v-else class="locked-state-lbl">Locked</span>
                </div>
              </td>
            </tr>
            <tr v-if="stops.length === 0">
              <td colspan="9" class="empty-row-text">No logistics stops found.</td>
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

    <!-- Create Stop Slide Out Drawer -->
    <div class="details-drawer-overlay" v-if="showAddDrawer" @click="showAddDrawer = false">
      <div class="details-drawer" @click.stop>
        <div class="drawer-header">
          <h2>Register Stop Order</h2>
          <button @click="showAddDrawer = false" class="btn-close-drawer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="close-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form @submit.prevent="handleAddStop" class="drawer-form">
          <div v-if="formError" class="form-error-banner">
            {{ formError }}
          </div>
          <div class="form-group">
            <label>Order ID</label>
            <input type="text" v-model="formOrderId" required class="input-form" placeholder="e.g. ORD-1005" />
          </div>
          <div class="form-group">
            <label>Customer Name</label>
            <input type="text" v-model="formCustomerName" required class="input-form" placeholder="e.g. Alice Cooper" />
          </div>
          <div class="form-group">
            <label>Customer Phone</label>
            <input type="text" v-model="formCustomerPhone" required class="input-form" placeholder="e.g. 9876543210" />
          </div>
          <div class="form-group">
            <label>Delivery Address</label>
            <input type="text" v-model="formAddress" required class="input-form" placeholder="e.g. 45 Park Avenue" />
          </div>
          <div class="form-group">
            <label>Latitude</label>
            <input type="number" step="0.0000001" v-model="formLatitude" required class="input-form" />
          </div>
          <div class="form-group">
            <label>Longitude</label>
            <input type="number" step="0.0000001" v-model="formLongitude" required class="input-form" />
          </div>
          <div class="form-group">
            <label>Package Weight (kg)</label>
            <input type="number" step="0.01" v-model="formWeight" required class="input-form" />
          </div>
          <div class="form-group">
            <label>Package Volume (cbm)</label>
            <input type="number" step="0.001" v-model="formVolume" required class="input-form" />
          </div>
          <div class="form-group">
            <label>Service Time (mins)</label>
            <input type="number" v-model="formServiceMins" required class="input-form" />
          </div>
          <div class="form-group">
            <label>Required POD Type</label>
            <select v-model="formPodType" class="input-form" style="background-color: var(--color-white);">
              <option value="PHOTO_REQUIRED">Photo Required</option>
              <option value="SIGNATURE_REQUIRED">Signature Required</option>
              <option value="PIN_REQUIRED">PIN Required</option>
              <option value="NOT_REQUIRED">Not Required</option>
            </select>
          </div>
          <button type="submit" :disabled="submitting" class="btn-submit-form">
            <span v-if="submitting">Registering...</span>
            <span v-else>Register Order</span>
          </button>
        </form>
      </div>
    </div>

    <!-- Assign Route Drawer -->
    <div class="details-drawer-overlay" v-if="showAssignDrawer" @click="showAssignDrawer = false">
      <div class="details-drawer" @click.stop>
        <div class="drawer-header">
          <h2>Assign Route</h2>
          <button @click="showAssignDrawer = false" class="btn-close-drawer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="close-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form @submit.prevent="handleAssignRoute" class="drawer-form">
          <div v-if="assignError" class="form-error-banner">
            {{ assignError }}
          </div>

          <!-- Loading state -->
          <div v-if="loadingRoutes" style="display: flex; align-items: center; gap: 10px; padding: 20px 0; justify-content: center; color: var(--color-gray-500); font-size: 13px; font-weight: 600;">
            <div class="spinner" style="width: 20px; height: 20px; border-width: 2.5px;"></div>
            Loading available routes...
          </div>

          <!-- No routes available -->
          <div v-else-if="availableRoutes.length === 0" style="text-align: center; padding: 24px 0; color: var(--color-gray-500); font-size: 13px;">
            <p style="font-weight: 700; margin-bottom: 4px;">No routes available</p>
            <p style="font-size: 12px;">Create a route first from the Routes page, then come back to assign stops.</p>
          </div>

          <!-- Route selector -->
          <template v-else>
            <div class="form-group">
              <label>Select Route <span style="font-weight: 500; color: var(--color-gray-500);">({{ availableRoutes.length }} available)</span></label>
              <select v-model="selectedRouteId" required class="input-form" style="background-color: var(--color-white);">
                <option value="" disabled>Select a route...</option>
                <option v-for="r in availableRoutes" :key="r.routeId" :value="r.routeId">
                  {{ r.routeCode }} — {{ r.routeDate }} ({{ r.status }}) {{ r.driverId ? '' : '⚠ No driver' }}
                </option>
              </select>
            </div>
            <button type="submit" :disabled="assigningRoute || !selectedRouteId" class="btn-submit-form">
              <span v-if="assigningRoute">Assigning...</span>
              <span v-else>Assign to Route</span>
            </button>
          </template>
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

.phone-cell {
  color: var(--color-gray-800);
  font-weight: 600;
}

.address-cell {
  color: var(--color-gray-500);
  font-size: 12.5px;
}

.pod-cell {
  font-size: 11px;
  color: var(--color-gray-500);
  font-weight: 700;
}

.date-cell {
  font-size: 11.5px;
  color: var(--color-gray-500);
  font-weight: 500;
}

.actions-cell-group {
  display: flex;
  gap: 6px;
  align-items: center;
}

.locked-state-lbl {
  font-size: 11px;
  color: var(--color-gray-500);
  font-weight: 700;
}

/* Stop action controls inside details page */
.btn-stop-action {
  font-size: 10.5px;
  font-weight: 700;
  border: none;
  border-radius: 5px;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
  text-align: center;
}

.btn-stop-action.start { background-color: #7e22ce; color: white; }
.btn-stop-action.complete { background-color: #16a34a; color: white; }
.btn-stop-action.fail { background-color: #dc2626; color: white; }

.btn-stop-action:hover {
  opacity: 0.9;
  transform: translateY(-0.5px);
}

/* Status badges */
.stop-status-badge {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 4px;
  display: inline-block;
}
.stop-status-badge.pending { background-color: #fef3c7; color: #d97706; }
.stop-status-badge.routed { background-color: #dbeafe; color: #1e40af; }
.stop-status-badge.out_for_delivery { background-color: #f3e8ff; color: #7e22ce; }
.stop-status-badge.delivered { background-color: #dcfce7; color: #15803d; }
.stop-status-badge.failed { background-color: #fee2e2; color: #b91c1c; }

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
