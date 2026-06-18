<script setup lang="ts">
import DashboardLayout from '../common/DashboardLayout.vue'
import { usePagination } from '../../composables/usePagination'
import apiClient from '../../services/api'

interface UserItem {
  employeeId: string
  name: string
  role: string
  active: boolean
}

// Fetch helper mapping standard REST API query parameters
const fetchUsers = async (params: { page: number; size: number; sort: string; search: string }) => {
  return apiClient.get('/users', {
    params: {
      page: params.page,
      size: params.size,
      sort: params.sort,
      search: params.search
    }
  })
}

const {
  items: users,
  total,
  loading,
  error,
  page,
  size,
  search,
  sort,
  handleSearch,
  handleSort,
  changePage
} = usePagination<UserItem>(fetchUsers, 'employeeId,asc', 10)

// Helper to determine active status class
const getActiveLabel = (active: boolean) => active ? 'Active' : 'Inactive'
const getActivePillClass = (active: boolean) => active ? 'status-pill active' : 'status-pill inactive'
</script>

<template>
  <DashboardLayout>
    <div class="page-title-section">
      <h1>Users</h1>
      <p class="subtitle">Search and view active dispatcher and terminal profiles on the system</p>
    </div>

    <section class="table-section">
      <div class="card-header border-none">
        <div class="header-left">
          <h3>System Users</h3>
          <span class="badge-count">{{ total }} items</span>
        </div>
        
        <!-- Search bar -->
        <div class="search-box">
          <input 
            type="text" 
            v-model="search" 
            @input="handleSearch"
            placeholder="Search employee ID or name..."
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
        <p>Retrieving user profiles...</p>
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
              <th class="sortable" @click="handleSort('employeeId')">
                Employee ID 
                <span v-if="sort.startsWith('employeeId,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th class="sortable" @click="handleSort('name')">
                Full Name
                <span v-if="sort.startsWith('name,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th class="sortable" @click="handleSort('role')">
                User Role
                <span v-if="sort.startsWith('role,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
              <th class="sortable" @click="handleSort('active')">
                Status
                <span v-if="sort.startsWith('active,')">{{ sort.endsWith('asc') ? '▲' : '▼' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.employeeId">
              <td class="driver-id">{{ user.employeeId }}</td>
              <td class="driver-name">{{ user.name }}</td>
              <td class="role-cell">{{ user.role }}</td>
              <td>
                <span :class="getActivePillClass(user.active)">
                  <span class="dot"></span>
                  {{ getActiveLabel(user.active) }}
                </span>
              </td>
            </tr>
            <tr v-if="users.length === 0">
              <td colspan="4" class="empty-row-text">No matching users found in the system registry.</td>
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

.fleet-table tbody tr:hover {
  background-color: rgba(231, 225, 177, 0.05);
}

.driver-id {
  font-family: monospace;
  font-weight: 700;
  color: var(--color-primary);
}

.driver-name {
  font-weight: 600;
}

.role-cell {
  font-weight: 600;
  color: var(--color-gray-500);
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

/* State boxes */
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

/* Pagination Footer */
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
</style>
