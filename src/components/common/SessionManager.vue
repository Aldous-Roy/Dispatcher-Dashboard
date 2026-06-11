<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import apiClient from '../../services/api'

const authStore = useAuthStore()
const isExpanded = ref(false)
const remainingTimeStr = ref('00:00:00')
const copied = ref(false)
const simLoading = ref(false)

// Function to format seconds into HH:MM:SS
const formatTime = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return '00:00:00'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  return [hours, minutes, seconds]
    .map(val => String(val).padStart(2, '0'))
    .join(':')
}

// Timer loop
let timerId: any = null
const updateTimer = () => {
  remainingTimeStr.value = formatTime(authStore.tokenTimeRemaining)
  
  // Auto-logout if expired and authenticated
  if (authStore.isAuthenticated && authStore.tokenTimeRemaining <= 0 && !authStore.isMocked) {
    authStore.logout()
  }
}

onMounted(() => {
  updateTimer()
  timerId = setInterval(updateTimer, 1000)
})

onUnmounted(() => {
  if (timerId) clearInterval(timerId)
})

// Token status metadata
const statusInfo = computed(() => {
  if (!authStore.isAuthenticated) {
    return { text: 'EXPIRED', class: 'expired', color: 'var(--color-danger)' }
  }
  if (authStore.isMocked) {
    return { text: 'MOCKED ACTIVE', class: 'mocked', color: '#d97706' }
  }
  const remaining = authStore.tokenTimeRemaining
  if (remaining < 300) { // less than 5 mins
    return { text: 'WARNING (EXPIRING)', class: 'warning', color: 'var(--color-danger)' }
  }
  return { text: 'SECURE SESSION', class: 'secure', color: 'var(--color-success)' }
})

// Helper to copy token to clipboard
const copyToken = async () => {
  if (!authStore.token) return
  try {
    await navigator.clipboard.writeText(authStore.token)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (err) {
    console.error('Failed to copy token:', err)
  }
}

// Simulate a 401 error using Axios configuration to test interceptor
const trigger401Simulation = async () => {
  simLoading.value = true
  try {
    // We force a simulated 401 error rejection through Axios
    // by using a custom adapter or calling a dummy route
    await apiClient.request({
      url: '/auth/test-401-simulation',
      // We pass a custom mock adapter that rejects with 401 status to trigger interceptor
      adapter: () => {
        return Promise.reject({
          response: {
            status: 401,
            data: { message: 'Session expired (Simulated 401)' }
          }
        })
      }
    })
  } catch (err: any) {
    console.info('Interceptor handled simulated 401 error:', err)
  } finally {
    simLoading.value = false
  }
}
</script>

<template>
  <div class="session-console-root" v-if="authStore.isAuthenticated">
    <!-- Floating Trigger Badge when collapsed -->
    <button 
      v-if="!isExpanded" 
      @click="isExpanded = true" 
      class="floating-console-badge"
      title="Security Session Control"
    >
      <div class="badge-content">
        <span class="pulse-indicator" :style="{ backgroundColor: statusInfo.color }"></span>
        <span class="console-label">🔑 LOCK: {{ remainingTimeStr }}</span>
      </div>
    </button>

    <!-- Expanded Terminal Overlay -->
    <div v-else class="expanded-console-panel">
      <!-- Header -->
      <div class="console-header">
        <div class="title-section">
          <svg class="terminal-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h4>Security Control Console</h4>
        </div>
        <button @click="isExpanded = false" class="close-btn" aria-label="Close Console">×</button>
      </div>

      <!-- Content -->
      <div class="console-body">
        
        <!-- Status Indicator Grid -->
        <div class="status-grid">
          <div class="status-item">
            <span class="label">Session Status</span>
            <span class="value status-text" :class="statusInfo.class">
              {{ statusInfo.text }}
            </span>
          </div>
          <div class="status-item">
            <span class="label">Time Remaining</span>
            <span class="value timer-value font-mono">{{ remainingTimeStr }}</span>
          </div>
        </div>

        <!-- Dispatcher Identity Card -->
        <div class="identity-card">
          <div class="id-header">
            <span class="badge-role">{{ authStore.role }}</span>
            <span class="badge-hub">Terminal Hub: {{ authStore.hub }}</span>
          </div>
          
          <div class="id-body">
            <div class="id-avatar">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" clip-rule="evenodd" />
              </svg>
            </div>
            
            <div class="id-details">
              <div class="detail-row">
                <span class="dt-label">Name</span>
                <span class="dt-val">{{ authStore.name }}</span>
              </div>
              <div class="detail-row">
                <span class="dt-label">Employee ID</span>
                <span class="dt-val font-mono">{{ authStore.employeeId || 'N/A' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Decoded JWT Token Preview -->
        <div class="token-section">
          <div class="token-header">
            <span>Authentication JWT Token</span>
            <button @click="copyToken" class="copy-btn">
              {{ copied ? 'Copied!' : 'Copy String' }}
            </button>
          </div>
          <div class="token-box font-mono">
            {{ authStore.token }}
          </div>
        </div>

        <!-- Controls/Testing tools -->
        <div class="control-actions">
          <button 
            @click="trigger401Simulation" 
            class="btn-control action-simulate-401"
            :disabled="simLoading"
          >
            <span class="btn-spinner" v-if="simLoading"></span>
            <span>Trigger 401 Intercept (Auto-Logout)</span>
          </button>
          
          <button @click="authStore.logout" class="btn-control action-manual-logout">
            Sign Out Session
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.session-console-root {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
}

/* Floating Badge */
.floating-console-badge {
  background-color: var(--color-primary-dark);
  color: var(--color-bg-base);
  border: 1.5px solid var(--color-accent-sage);
  border-radius: 30px;
  padding: 10px 18px;
  cursor: pointer;
  box-shadow: var(--shadow-lg), 0 0 0 4px rgba(48, 109, 41, 0.2);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  outline: none;
}

.floating-console-badge:hover {
  transform: translateY(-2px);
  background-color: var(--color-primary);
  box-shadow: var(--shadow-xl), 0 0 0 6px rgba(48, 109, 41, 0.3);
}

.badge-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pulse-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulseSession 1.5s infinite;
}

@keyframes pulseSession {
  0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(231, 225, 177, 0.5); }
  70% { transform: scale(1.3); opacity: 0.5; box-shadow: 0 0 0 6px rgba(231, 225, 177, 0); }
  100% { transform: scale(1); opacity: 0; box-shadow: 0 0 0 0 rgba(231, 225, 177, 0); }
}

.console-label {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 13.5px;
  letter-spacing: 0.5px;
}

/* Expanded Panel */
.expanded-console-panel {
  width: 380px;
  background: rgba(44, 51, 35, 0.96);
  border: 2px solid var(--color-accent-sage);
  border-radius: 16px;
  box-shadow: var(--shadow-xl);
  backdrop-filter: blur(12px);
  overflow: hidden;
  color: var(--color-bg-base);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.console-header {
  background: var(--color-gray-800);
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(231, 225, 177, 0.2);
}

.title-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.terminal-icon {
  width: 18px;
  height: 18px;
  color: var(--color-accent-sage);
}

.console-header h4 {
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--color-white);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-accent-sage);
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--color-white);
}

.console-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Status Indicator Grid */
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.status-item {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(231, 225, 177, 0.15);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
}

.status-item .label {
  font-size: 11px;
  color: var(--color-accent-sage);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.status-item .value {
  font-size: 16px;
  font-weight: 700;
}

.timer-value {
  color: var(--color-white);
}

.status-text.secure { color: #34d399; }
.status-text.warning { color: #f59e0b; }
.status-text.expired { color: #f87171; }
.status-text.mocked { color: #fbbf24; }

.font-mono {
  font-family: monospace;
}

/* Identity Card */
.identity-card {
  background: rgba(13, 83, 14, 0.25);
  border: 1px solid rgba(231, 225, 177, 0.25);
  border-radius: 10px;
  padding: 12px;
}

.id-header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  border-bottom: 1px dashed rgba(231, 225, 177, 0.2);
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.badge-role {
  background: var(--color-primary);
  color: var(--color-white);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.badge-hub {
  color: var(--color-accent-sage);
}

.id-body {
  display: flex;
  gap: 12px;
  align-items: center;
}

.id-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: var(--color-accent-sage);
  flex-shrink: 0;
}

.id-details {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.dt-label {
  color: var(--color-accent-sage);
}

.dt-val {
  font-weight: 600;
  color: var(--color-white);
}

/* Token Section */
.token-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.token-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11.5px;
  color: var(--color-accent-sage);
}

.copy-btn {
  background: none;
  border: 1px solid rgba(231, 225, 177, 0.3);
  color: var(--color-accent-sage);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 10.5px;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: rgba(231, 225, 177, 0.1);
  color: var(--color-white);
}

.token-box {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(231, 225, 177, 0.15);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 11px;
  word-break: break-all;
  max-height: 52px;
  overflow-y: auto;
  color: #a7f3d0;
}

/* Control Actions */
.control-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.btn-control {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.25s;
}

.action-simulate-401 {
  background: rgba(185, 28, 28, 0.15);
  border: 1.5px solid var(--color-danger);
  color: #fca5a5;
}

.action-simulate-401:hover:not(:disabled) {
  background: var(--color-danger);
  color: var(--color-white);
}

.action-simulate-401:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-manual-logout {
  background: transparent;
  border: 1.5px solid rgba(231, 225, 177, 0.4);
  color: var(--color-accent-sage);
}

.action-manual-logout:hover {
  background: var(--color-accent-sage);
  color: var(--color-gray-800);
}

.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
