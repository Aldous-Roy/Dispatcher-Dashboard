<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
import { useRoute } from 'vue-router'

const authStore = useAuthStore()
const route = useRoute()

const handleLogout = () => {
  authStore.logout()
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
        <!-- Overview / Dashboard -->
        <router-link to="/dashboard" class="nav-btn" :class="{ active: route.path === '/dashboard' }">
          <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
          </svg>
          Overview
        </router-link>

        <!-- Users -->
        <router-link to="/users" class="nav-btn" :class="{ active: route.path.startsWith('/users') }">
          <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A2.25 2.25 0 0112.75 21.5h-1.5a2.25 2.25 0 01-2.25-2.263V19.13M8.625 19.5a9.38 9.38 0 01-2.625.372 9.337 9.337 0 01-4.121-.952 4.125 4.125 0 017.533-2.493M8.625 19.5v-.003c0-1.113.285-2.16.786-3.07M8.625 19.5V19.13m4.846-8.19A2.225 2.225 0 0013.5 10.5h-3a2.225 2.225 0 00-1.229.44M12 13.5v-1.5m0 0a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5z" />
          </svg>
          Users
        </router-link>

        <!-- Drivers -->
        <router-link to="/drivers" class="nav-btn" :class="{ active: route.path.startsWith('/drivers') }">
          <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
          </svg>
          Drivers
        </router-link>

        <!-- Routes -->
        <router-link to="/routes" class="nav-btn" :class="{ active: route.path.startsWith('/routes') }">
          <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Routes
        </router-link>

        <!-- Stops -->
        <router-link to="/stops" class="nav-btn" :class="{ active: route.path.startsWith('/stops') }">
          <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25gC4.5 6.255 7.86 3 12 3s7.5 3.255 7.5 7.5z" />
          </svg>
          Pending Orders
        </router-link>

        <!-- Visual Routes -->
        <router-link to="/visual-routes" class="nav-btn" :class="{ active: route.path.startsWith('/visual-routes') }">
          <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
          </svg>
          Visual Routes
        </router-link>

        <!-- Tracking -->
        <router-link to="/tracking" class="nav-btn" :class="{ active: route.path === '/tracking' }">
          <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12z" />
          </svg>
          Live Tracking
        </router-link>
      </nav>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <div class="hub-info">
          <span class="hub-label">ACTIVE NODE HUB</span>
          <span class="hub-value">{{ authStore.hub || 'Metro Logistics Hub' }}</span>
        </div>
        
        <button @click="handleLogout" class="btn-logout" aria-label="Sign Out">
          <span>Sign Out Session</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="logout-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    </aside>

    <!-- Page Body -->
    <main class="dashboard-body">
      <slot></slot>
    </main>
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
  text-decoration: none;
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

.dashboard-body {
  padding: 40px;
  margin-left: 260px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  flex-grow: 1;
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .dashboard-sidebar {
    width: 70px;
    padding: 24px 8px;
  }
  .brand-text, .dispatcher-identity, .hub-info, .btn-logout span {
    display: none;
  }
  .dashboard-body {
    margin-left: 70px;
    padding: 20px;
  }
  .nav-btn {
    justify-content: center;
    padding: 12px;
  }
}
</style>
