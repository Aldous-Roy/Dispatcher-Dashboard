<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '../common/DashboardLayout.vue'
import { usePagination } from '../../composables/usePagination'
import apiClient from '../../services/api'

interface DriverItem {
  driverId: string
  employeeId: string
  firstName: string
  lastName: string
  phoneNumber: string
  maxPackageCapacity: number
  maxWeightCapacityKg: number
  active: boolean
  createdAt: string
  updatedAt: string
  vehicleType?: string
  password?: string
}

const route = useRoute()
const router = useRouter()

// Fetch helper mapping standard REST API query parameters
const fetchDrivers = async (params: { page: number; size: number; sort: string; search: string }) => {
  return apiClient.get('/drivers', {
    params: {
      page: params.page,
      size: params.size,
      sort: params.sort,
      search: params.search
    }
  })
}

const {
  items: drivers,
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
} = usePagination<DriverItem>(fetchDrivers, 'createdAt,desc', 10)

// Detail drawer state for selected driver
const selectedDriverId = ref<string | null>(null)
const selectedDriver = ref<DriverItem | null>(null)
const selectedDriverLocation = ref<{ latitude: number; longitude: number; timestamp?: string } | null>(null)
const loadingLocation = ref(false)

const openDriverDetails = (driverId: string) => {
  router.push(`/drivers/${driverId}`)
}

const closeDriverDetails = () => {
  router.push('/drivers')
}

// Create Driver State
const showCreateModal = ref(false)
const createLoading = ref(false)
const createError = ref('')
const createSuccess = ref(false)
const newDriver = ref({
  firstName: '',
  lastName: '',
  phoneNumber: '',
  password: '',
  vehicleType: 'VAN'
})
const createdDriverData = ref<any>(null)

const handleCreateDriver = async () => {
  createError.value = ''
  createLoading.value = true
  createSuccess.value = false
  try {
    const res = await apiClient.post('/drivers/register', {
      firstName: newDriver.value.firstName,
      lastName: newDriver.value.lastName,
      phoneNumber: newDriver.value.phoneNumber,
      password: newDriver.value.password,
      vehicleType: newDriver.value.vehicleType,
      active: true
    })
    if (res.data && res.data.status === 'success') {
      createSuccess.value = true
      createdDriverData.value = {
        employeeId: res.data.data.employeeId,
        password: newDriver.value.password
      }
      
      // Save password mapping locally in the browser so it can be exported to CSV later
      try {
        const savedPasswords = JSON.parse(localStorage.getItem('driver_passwords') || '{}')
        savedPasswords[res.data.data.employeeId] = newDriver.value.password
        localStorage.setItem('driver_passwords', JSON.stringify(savedPasswords))
      } catch (e) {
        console.error('Failed to save driver password locally:', e)
      }

      loadData()
      // Reset form
      newDriver.value = {
        firstName: '',
        lastName: '',
        phoneNumber: '',
        password: '',
        vehicleType: 'VAN'
      }
    } else {
      createError.value = 'Failed to create driver'
    }
  } catch (err: any) {
    createError.value = err.response?.data?.message || 'Error creating driver'
  } finally {
    createLoading.value = false
  }
}

const closeCreateModal = () => {
  showCreateModal.value = false
  createSuccess.value = false
  createError.value = ''
}

const downloadDriversCSV = () => {
  if (!drivers.value || drivers.value.length === 0) return
  
  const headers = ['Driver ID', 'Employee ID', 'First Name', 'Last Name', 'Phone Number', 'Vehicle Type', 'Password']
  const csvRows = []
  csvRows.push(headers.join(','))

  drivers.value.forEach(d => {
    const pwd = d.password || ''
    const row = [
      d.driverId,
      d.employeeId,
      d.firstName,
      d.lastName,
      d.phoneNumber,
      d.vehicleType || 'VAN',
      pwd
    ]
    csvRows.push(row.map(val => `"${val}"`).join(','))
  })
  
  const csvString = csvRows.join('\n')
  const blob = new Blob([csvString], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.setAttribute('hidden', '')
  a.setAttribute('href', url)
  a.setAttribute('download', 'driver_details.csv')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const fetchDriverLocation = async (driverId: string) => {
  loadingLocation.value = true
  selectedDriverLocation.value = null
  try {
    const res = await apiClient.get(`/tracking/location/${driverId}`)
    if (res.data && res.data.status === 'success' && res.data.data) {
      selectedDriverLocation.value = res.data.data
    }
  } catch (e) {
    console.warn(`Failed to fetch location for driver ${driverId}:`, e)
  } finally {
    loadingLocation.value = false
  }
}

// Watch router path driverId selection
watch(
  () => route.params.driverId,
  async (newId) => {
    if (newId) {
      selectedDriverId.value = newId as string
      // Find locally first
      const matched = drivers.value.find(d => d.driverId === newId)
      if (matched) {
        selectedDriver.value = matched
      } else {
        // Fetch specific driver if deep linked directly
        try {
          const res = await apiClient.get('/drivers')
          const list = res.data?.data?.content || res.data?.data || []
          const found = list.find((d: any) => d.driverId === newId)
          if (found) selectedDriver.value = found
        } catch (e) {
          console.warn('Failed to load deep-linked driver details:', e)
        }
      }
      if (selectedDriverId.value) {
        fetchDriverLocation(selectedDriverId.value)
      }
    } else {
      selectedDriverId.value = null
      selectedDriver.value = null
      selectedDriverLocation.value = null
    }
  },
  { immediate: true }
)

// Activate/Deactivate Toggle
// const toggleDriverStatus = async (driver: DriverItem) => {
// ...
// }

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
        <h1>Drivers</h1>
        <p class="subtitle">Configure operational operator capacities and view live attendance status</p>
      </div>
      <div class="header-actions" style="display: flex; gap: 12px; align-items: center;">
        <button @click="downloadDriversCSV" class="btn-download" style="background-color: #10b981; color: white; padding: 8px 16px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Download driver details
        </button>
        <button @click="showCreateModal = true" class="btn-create" style="background-color: var(--color-primary); color: white; padding: 8px 16px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
          Create Driver
        </button>
      </div>
    </div>

    <section class="table-section">
      <div class="card-header border-none">
        <div class="header-left">
          <h3>Drivers List</h3>
          <span class="badge-count">{{ total }} operators</span>
        </div>
        
        <!-- Search bar -->
        <div class="search-box">
          <input 
            type="text" 
            v-model="search" 
            @input="handleSearch"
            placeholder="Search driver ID, phone, or name..."
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
        <p>Syncing drivers registry...</p>
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
              <th class="sortable" @click="handleSort('driverId')">
                Driver ID
                <span v-if="sort.startsWith('driverId,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th class="sortable" @click="handleSort('employeeId')">
                Employee ID
                <span v-if="sort.startsWith('employeeId,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th>Full Name</th>
              <th>Phone Number</th>
              <th class="sortable" @click="handleSort('maxPackageCapacity')">
                Max Pkgs
                <span v-if="sort.startsWith('maxPackageCapacity,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th class="sortable" @click="handleSort('maxWeightCapacityKg')">
                Max Weight
                <span v-if="sort.startsWith('maxWeightCapacityKg,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th>Created At</th>
              <th class="sortable" @click="handleSort('active')">
                Status
                <span v-if="sort.startsWith('active,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="driver in drivers" :key="driver.driverId" class="driver-row" @click="openDriverDetails(driver.driverId)">
              <td class="driver-id">{{ driver.driverId.slice(0, 8) }}...</td>
              <td class="employee-id-cell">{{ driver.employeeId }}</td>
              <td class="driver-name">
                {{ driver.firstName }} {{ driver.lastName }}
                <div style="font-size: 11px; color: var(--color-gray-500); font-weight: 600; text-transform: uppercase; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                  <span>{{ driver.vehicleType === 'BIKE' ? '🚲' : '🚚' }}</span>
                  <span>{{ driver.vehicleType || 'VAN' }}</span>
                </div>
              </td>
              <td class="phone-cell">{{ driver.phoneNumber }}</td>
              <td class="cap-cell">{{ driver.maxPackageCapacity }} items</td>
              <td class="cap-cell">{{ driver.maxWeightCapacityKg }} kg</td>
              <td class="date-cell">{{ formatDate(driver.createdAt) }}</td>
              <td>
                <span :class="driver.active ? 'status-pill active' : 'status-pill inactive'">
                  <span class="dot"></span>
                  {{ driver.active ? 'Active' : 'Inactive' }}
                </span>
              </td>
            </tr>
            <tr v-if="drivers.length === 0">
              <td colspan="8" class="empty-row-text">No logistics operators registered.</td>
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

    <!-- Create Driver Modal -->
    <div v-if="showCreateModal" class="modal-backdrop" @click="closeCreateModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Register New Driver</h2>
          <button class="btn-close" @click="closeCreateModal">✕</button>
        </div>
        
        <div class="modal-body" v-if="!createSuccess">
          <p class="modal-desc">Create a new driver profile. They will use the generated Employee ID and the password you set to login to the mobile app.</p>
          
          <div class="form-group">
            <label>First Name</label>
            <input type="text" v-model="newDriver.firstName" placeholder="e.g. John" class="form-input" />
          </div>
          
          <div class="form-group">
            <label>Last Name</label>
            <input type="text" v-model="newDriver.lastName" placeholder="e.g. Doe" class="form-input" />
          </div>
          
          <div class="form-group">
            <label>Phone Number</label>
            <input type="text" v-model="newDriver.phoneNumber" placeholder="e.g. 9876543210" class="form-input" />
          </div>
          
          <div class="form-group">
            <label>Login Password</label>
            <input type="text" v-model="newDriver.password" placeholder="Set a permanent password" class="form-input" />
            <span style="font-size: 11px; color: #64748b; margin-top: 4px; display: block;">Drivers cannot change this password later.</span>
          </div>

          <div class="form-group">
            <label>Vehicle Type</label>
            <select v-model="newDriver.vehicleType" class="form-input">
              <option value="VAN">Van (50 pkgs / 300kg)</option>
              <option value="BIKE">Bike (15 pkgs / 20kg)</option>
            </select>
          </div>
          
          <div v-if="createError" class="error-msg" style="margin-top: 10px; padding: 10px; background: #fef2f2; border-radius: 6px;">
            ⚠️ {{ createError }}
          </div>
        </div>

        <div class="modal-body success-state" v-else>
          <div class="success-icon">✅</div>
          <h3>Driver Registered Successfully!</h3>
          <p>Please share these exact credentials with the driver:</p>
          
          <div class="credentials-box">
            <div class="cred-row">
              <span class="cred-label">Employee ID:</span>
              <span class="cred-value">{{ createdDriverData?.employeeId }}</span>
            </div>
            <div class="cred-row">
              <span class="cred-label">Password:</span>
              <span class="cred-value">{{ createdDriverData?.password }}</span>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeCreateModal" v-if="!createSuccess">Cancel</button>
          <button class="btn-save" @click="handleCreateDriver" :disabled="createLoading || !newDriver.firstName || !newDriver.lastName || !newDriver.password" v-if="!createSuccess">
            {{ createLoading ? 'Registering...' : 'Register Driver' }}
          </button>
          <button class="btn-save" @click="closeCreateModal" v-if="createSuccess">Done</button>
        </div>
      </div>
    </div>

    <!-- Slide Out Drawer for Driver Details -->
    <div class="details-drawer-overlay" v-if="selectedDriver" @click="closeDriverDetails">
      <div class="details-drawer" @click.stop>
        <div class="drawer-header">
          <h2>Driver Profile details</h2>
          <button @click="closeDriverDetails" class="btn-close-drawer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="close-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="drawer-body">
          <div class="profile-card-large">
            <div class="avatar-large">
              {{ selectedDriver.firstName[0].toUpperCase() }}{{ selectedDriver.lastName[0].toUpperCase() }}
            </div>
            <h3>{{ selectedDriver.firstName }} {{ selectedDriver.lastName }}</h3>
            <span class="badge-large-id">ID: {{ selectedDriver.employeeId }}</span>
            <span :class="selectedDriver.active ? 'status-pill active' : 'status-pill inactive'" style="margin-top: 8px;">
              <span class="dot"></span>
              {{ selectedDriver.active ? 'Active Operator' : 'Inactive Operator' }}
            </span>
          </div>

          <div class="profile-section">
            <h4>Contact Info</h4>
            <p>📞 Phone: <strong>{{ selectedDriver.phoneNumber }}</strong></p>
          </div>

          <div class="profile-section">
            <h4>Vehicle & Capacity</h4>
            <div style="margin-bottom: 12px; font-weight: bold; color: var(--color-primary-dark); font-size: 13.5px; display: flex; align-items: center; gap: 6px;">
              <span>{{ selectedDriver.vehicleType === 'BIKE' ? '🚲' : '🚚' }}</span>
              <span>Vehicle Type: {{ selectedDriver.vehicleType || 'VAN' }}</span>
            </div>
            <div class="capacities-grid">
              <div class="capacity-box">
                <span class="cap-lbl">Max Packages</span>
                <span class="cap-val">{{ selectedDriver.maxPackageCapacity }} items</span>
              </div>
              <div class="capacity-box">
                <span class="cap-lbl">Max Weight</span>
                <span class="cap-val">{{ selectedDriver.maxWeightCapacityKg }} kg</span>
              </div>
            </div>
          </div>

          <div class="profile-section">
            <h4>Realtime Telemetry Details</h4>
            <div v-if="loadingLocation" class="loading-loc">
              <div class="spinner-small"></div>
              <span>Querying driver terminal coordinates...</span>
            </div>
            <div v-else-if="selectedDriverLocation" class="loc-details">
              <p>📌 Coordinates: <strong>{{ selectedDriverLocation.latitude.toFixed(5) }}, {{ selectedDriverLocation.longitude.toFixed(5) }}</strong></p>
              <p>🕒 Updated: <strong>{{ formatDate(selectedDriverLocation.timestamp || '') }}</strong></p>
              <!-- Mini map iframe visualizer -->
              <div class="mini-map-box">
                <iframe 
                  width="100%" 
                  height="120" 
                  frameborder="0" 
                  scrolling="no" 
                  marginheight="0" 
                  marginwidth="0" 
                  :src="`https://maps.google.com/maps?q=${selectedDriverLocation.latitude},${selectedDriverLocation.longitude}&z=14&output=embed`"
                ></iframe>
              </div>
            </div>
            <div v-else class="empty-loc">
              <p>No coordinates registered for this driver yet.</p>
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

.phone-cell {
  color: var(--color-gray-800);
  font-weight: 600;
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

.btn-toggle-status.deactivate {
  border-color: var(--color-danger);
  background-color: rgba(185, 28, 28, 0.05);
  color: var(--color-danger);
}

.btn-toggle-status.deactivate:hover {
  background-color: var(--color-danger);
  color: white;
}

/* Status pills */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
}

.status-pill.active {
  background-color: rgba(21, 128, 61, 0.1);
  color: var(--color-success);
}

.status-pill.active .dot {
  width: 6px;
  height: 6px;
  background-color: var(--color-success);
  border-radius: 50%;
}

.status-pill.inactive {
  background-color: rgba(100, 116, 139, 0.1);
  color: var(--color-gray-500);
}

.status-pill.inactive .dot {
  width: 6px;
  height: 6px;
  background-color: var(--color-gray-500);
  border-radius: 50%;
}

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

.drawer-body {
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex-grow: 1;
}

.profile-card-large {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px;
  background-color: var(--color-gray-50);
  border-radius: 12px;
  border: 1px solid var(--color-gray-200);
}

.avatar-large {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--color-accent-sage);
  color: var(--color-primary-dark);
  font-size: 22px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  box-shadow: var(--shadow-md);
}

.profile-card-large h3 {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-gray-800);
  margin-bottom: 2px;
}

.badge-large-id {
  font-family: monospace;
  font-size: 11px;
  color: var(--color-gray-500);
}

.profile-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-section h4 {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--color-gray-500);
  letter-spacing: 0.5px;
  border-bottom: 1.5px solid var(--color-gray-100);
  padding-bottom: 6px;
}

.profile-section p {
  font-size: 13.5px;
  color: var(--color-gray-800);
}

.capacities-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.capacity-box {
  background-color: var(--color-gray-50);
  border: 1px solid var(--color-gray-200);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.cap-lbl {
  font-size: 10px;
  color: var(--color-gray-500);
  font-weight: 700;
  text-transform: uppercase;
}

.cap-val {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-gray-800);
}

.loading-loc, .empty-loc {
  padding: 20px;
  text-align: center;
  color: var(--color-gray-500);
  font-size: 13px;
}

.loading-loc {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-accent-sage);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s infinite linear;
}

.loc-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mini-map-box {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1.5px solid var(--color-gray-200);
  margin-top: 8px;
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

/* Modal Styles */
.modal-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 450px;
  max-width: 90vw;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  overflow: hidden;
}

.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-gray-100);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--color-gray-500);
}

.modal-body {
  padding: 24px;
}

.modal-desc {
  font-size: 13px;
  color: var(--color-gray-500);
  margin-bottom: 20px;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-gray-800);
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-gray-200);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 13.5px;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.modal-footer {
  padding: 16px 24px;
  background-color: var(--color-gray-50);
  border-top: 1px solid var(--color-gray-100);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel {
  background: white;
  border: 1px solid var(--color-gray-200);
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.btn-save {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-state {
  text-align: center;
  padding: 30px 20px;
}

.success-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.credentials-box {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 16px;
  margin-top: 20px;
  text-align: left;
}

.cred-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.cred-row:last-child {
  margin-bottom: 0;
}

.cred-label {
  font-weight: 600;
  color: var(--color-gray-500);
}

.cred-value {
  font-weight: 700;
  color: var(--color-primary-dark);
  font-family: monospace;
  font-size: 15px;
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
