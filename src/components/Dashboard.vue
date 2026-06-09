<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  username: string
  hub: string
}>()

const emit = defineEmits(['logout'])

// Dummy Fleet Data
const activeDrivers = ref([
  { id: 'DRV-101', name: 'Alex Miller', route: 'R-NORTH-01', stops: '8/12', status: 'Active', phone: '+1 555-0192' },
  { id: 'DRV-104', name: 'Sarah Connor', route: 'R-NORTH-04', stops: '12/12', status: 'Completed', phone: '+1 555-0145' },
  { id: 'DRV-208', name: 'Marcus Wright', route: 'R-EAST-02', stops: '3/10', status: 'On Break', phone: '+1 555-0221' },
  { id: 'DRV-309', name: 'Elena Rostova', route: 'R-METRO-09', stops: '6/15', status: 'Active', phone: '+1 555-0377' },
])

const handleLogout = () => {
  emit('logout')
}
</script>

<template>
  <div class="dashboard-container">
    <!-- Top Navigation Header -->
    <header class="dashboard-header">
      <div class="brand">
        <div class="logo-box">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="brand-svg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125a1.125 1.125 0 0 0 1.125-1.125V9.75M3.75 12h12.75M3 14.25h13.5m0 0V9.75M16.5 9.75V5.25A2.25 2.25 0 0 0 14.25 3H6.125A2.25 2.25 0 0 0 3.875 5.25V14.25m12.625-4.5h2.375A2.25 2.25 0 0 1 21 12v3.75m-2.25-5.25v2.25m-15-2.25h12" />
          </svg>
        </div>
        <span class="brand-name">LOGISPIN CONSOLE</span>
      </div>

      <div class="user-controls">
        <div class="user-badge">
          <span class="pulse-dot"></span>
          <span class="role">DISPATCHER:</span>
          <span class="username">{{ props.username || 'Admin' }}</span>
        </div>
        
        <button @click="handleLogout" class="btn-logout" aria-label="Sign Out">
          <span>Sign Out</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="logout-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Main Content Grid -->
    <main class="dashboard-body">
      <!-- Big styled page title as requested -->
      <div class="page-title-section">
        <h1>Dashboard</h1>
        <p class="subtitle">Logispin logistics network overview and active driver tracking</p>
      </div>

      <!-- Quick Stats / KPI Cards -->
      <section class="stats-panel">
        <div class="stat-card">
          <div class="icon-wrap bg-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A2.25 2.25 0 0 1 12.75 21.5h-1.5a2.25 2.25 0 0 1-2.25-2.263V19.13M8.625 19.5a9.38 9.38 0 0 1-2.625.372 9.337 9.337 0 0 1-4.121-.952 4.125 4.125 0 0 1 7.533-2.493M8.625 19.5v-.003c0-1.113.285-2.16.786-3.07M8.625 19.5V19.13m4.846-8.19A2.225 2.225 0 0 0 13.5 10.5h-3a2.225 2.225 0 0 0-1.229.44M12 13.5v-1.5m0 0a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5z" />
            </svg>
          </div>
          <div class="stat-info">
            <span class="value">4 / 4</span>
            <span class="label">Active Fleets</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="icon-wrap bg-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div class="stat-info">
            <span class="value">29 / 44</span>
            <span class="label">Stops Completed</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="icon-wrap bg-dark">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div class="stat-info">
            <span class="value">0</span>
            <span class="label">Pending Exceptions</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="icon-wrap bg-sage">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25gC4.5 6.358 7.858 3 12 3s7.5 3.358 7.5 7.5z" />
            </svg>
          </div>
          <div class="stat-info">
            <span class="value">{{ props.hub ? props.hub.toUpperCase() : 'METRO' }}</span>
            <span class="label">Assigned Node Terminal</span>
          </div>
        </div>
      </section>

      <!-- Active Drivers Table -->
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
                <td class="driver-stops">{{ driver.stops }}</td>
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
    </main>
  </div>
</template>

<style scoped>
.dashboard-container {
  width: 100%;
  min-height: 100vh;
  background-color: var(--color-bg-base);
  display: flex;
  flex-direction: column;
}

/* Header Styling */
.dashboard-header {
  background-color: var(--color-primary-dark);
  color: var(--color-bg-base);
  padding: 16px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-md);
  border-bottom: 2px solid var(--color-accent-sage);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
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

.brand-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1.5px;
}

.user-controls {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(231, 225, 177, 0.15);
  border: 1px solid rgba(231, 225, 177, 0.25);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13.5px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background-color: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
  animation: pulseIndicator 2s infinite;
}

@keyframes pulseIndicator {
  0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  70% { transform: scale(1.1); opacity: 0.5; box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { transform: scale(1); opacity: 0; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.user-badge .role {
  color: var(--color-accent-sage);
  font-weight: 600;
}

.user-badge .username {
  color: var(--color-white);
  font-weight: 700;
}

.btn-logout {
  background: none;
  border: 1.5px solid var(--color-accent-sage);
  color: var(--color-accent-sage);
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-sans);
  font-size: 13.5px;
  font-weight: 600;
  transition: all 0.25s;
}

.btn-logout:hover {
  background-color: var(--color-accent-sage);
  color: var(--color-primary-dark);
}

.logout-icon {
  width: 16px;
  height: 16px;
}

/* Dashboard Body Layout */
.dashboard-body {
  padding: 40px;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
  flex-grow: 1;
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

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .dashboard-header {
    padding: 16px;
  }
  
  .user-controls {
    gap: 10px;
  }
  
  .user-badge {
    padding: 4px 8px;
    font-size: 12px;
  }
  
  .user-badge .role {
    display: none;
  }
  
  .dashboard-body {
    padding: 20px;
    gap: 20px;
  }
  
  .page-title-section h1 {
    font-size: 28px;
  }
}
</style>
