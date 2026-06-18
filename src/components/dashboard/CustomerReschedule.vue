<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import apiClient from '../../services/api'

const route = useRoute()
const orderId = route.params.orderId as string

interface OrderDetails {
  orderId: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  timeWindowStart: string
  timeWindowEnd: string
  failedReasonNotes?: string | null
  rescheduledDate?: string | null
}

const order = ref<OrderDetails | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const selectedDate = ref('')
const submitting = ref(false)
const success = ref(false)

const fetchOrderDetails = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await apiClient.get(`/stops/${orderId}/customer-view`)
    if (response.data && response.data.status === 'success') {
      order.value = response.data.data
      if (order.value?.rescheduledDate) {
        selectedDate.value = order.value.rescheduledDate
      }
    } else {
      throw new Error(response.data.message || 'Failed to fetch order details')
    }
  } catch (err: any) {
    console.error(err)
    error.value = err.response?.data?.message || err.message || 'Unable to load order details. Please verify the URL or contact customer support.'
  } finally {
    loading.value = false
  }
}

const minDate = computed(() => {
  if (!order.value) return ''
  // Get original date from timeWindowStart
  const originalDate = new Date(order.value.timeWindowStart)
  // Add 1 day (a day after the failed order)
  originalDate.setDate(originalDate.getDate() + 1)
  
  // Also must be at least tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const baseDate = originalDate > tomorrow ? originalDate : tomorrow
  
  // Format as YYYY-MM-DD
  const yyyy = baseDate.getFullYear()
  const mm = String(baseDate.getMonth() + 1).padStart(2, '0')
  const dd = String(baseDate.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
})

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

const submitReschedule = async () => {
  if (!selectedDate.value) return
  submitting.value = true
  error.value = null
  try {
    const response = await apiClient.post(`/stops/${orderId}/customer-reschedule`, {
      rescheduleDate: selectedDate.value
    })
    if (response.data && response.data.status === 'success') {
      success.value = true
    } else {
      throw new Error(response.data.message || 'Failed to reschedule order')
    }
  } catch (err: any) {
    console.error(err)
    error.value = err.response?.data?.message || err.message || 'Failed to submit reschedule request. Please try again.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchOrderDetails()
})
</script>

<template>
  <div class="reschedule-page-wrapper">
    <div class="reschedule-container">
      <!-- Header / Logo -->
      <div class="brand-header">
        <div class="logo-box">
          <svg class="brand-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 8h14M5 12h14M5 16h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-title">LAST-MILE</span>
          <span class="brand-subtitle">DELIVERY MANAGEMENT</span>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="card loading-card">
        <div class="spinner"></div>
        <p>Loading your delivery details...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error && !order" class="card error-card">
        <div class="icon-warning">⚠️</div>
        <h3>Oops! Something went wrong</h3>
        <p>{{ error }}</p>
        <button @click="fetchOrderDetails" class="btn-primary" style="margin-top: 16px;">Try Again</button>
      </div>

      <!-- Main Content (Success / Form) -->
      <div v-else-if="order" class="card main-card">
        <div v-if="success" class="success-view">
          <div class="icon-success">✓</div>
          <h2>Reschedule Confirmed!</h2>
          <p class="success-message">
            Thank you, <strong>{{ order.customerName }}</strong>. Your preference to reschedule the delivery for 
            <strong>{{ formatDate(selectedDate) }}</strong> has been submitted.
          </p>
          <div class="divider"></div>
          <p class="next-steps">
            Our dispatchers will assign this date to a driver and update your route shortly. 
            You will receive a notification once the delivery is out for delivery.
          </p>
        </div>

        <div v-else class="form-view">
          <h2>Reschedule Delivery</h2>
          <p class="intro">
            We're sorry we missed you. Let us know when you would like us to re-attempt your delivery.
          </p>

          <!-- Order Summary -->
          <div class="order-summary">
            <h3>Delivery Details</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <span class="label">Order Reference</span>
                <span class="value">{{ order.orderId }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Customer Name</span>
                <span class="value">{{ order.customerName }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Delivery Address</span>
                <span class="value">{{ order.deliveryAddress }}</span>
              </div>
              <div class="summary-item" v-if="order.failedReasonNotes">
                <span class="label">Reason for Failure</span>
                <span class="value failed-reason">⚠️ {{ order.failedReasonNotes }}</span>
              </div>
            </div>
          </div>

          <!-- Reschedule Form -->
          <form @submit.prevent="submitReschedule" class="reschedule-form">
            <div class="form-group">
              <label for="reschedule-date">Select New Delivery Date</label>
              <div class="input-wrapper">
                <input 
                  id="reschedule-date"
                  type="date" 
                  v-model="selectedDate" 
                  :min="minDate"
                  required
                  class="date-input"
                />
              </div>
              <p class="help-text">
                Deliveries must be scheduled starting at least a day after the failed order. 
                Next available slot starts from: <strong>{{ formatDate(minDate) }}</strong>.
              </p>
            </div>

            <!-- Inline Error -->
            <div v-if="error" class="error-banner">
              {{ error }}
            </div>

            <button type="submit" :disabled="submitting" class="btn-primary">
              <span v-if="submitting">Submitting Request...</span>
              <span v-else>Confirm Reschedule Date</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reschedule-page-wrapper {
  min-height: 100vh;
  background-color: var(--color-bg-base);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
}

.reschedule-container {
  width: 100%;
  max-width: 540px;
}

.brand-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  justify-content: center;
}

.logo-box {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background-color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-bg-base);
}

.brand-svg {
  width: 24px;
  height: 24px;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 1.5px;
  color: var(--color-primary-dark);
}

.brand-subtitle {
  font-size: 9px;
  letter-spacing: 0.5px;
  color: var(--color-primary);
  font-weight: 700;
}

.card {
  background-color: var(--color-white);
  border-radius: 16px;
  border: 1.5px solid var(--color-gray-200);
  box-shadow: var(--shadow-lg);
  padding: 32px;
}

.loading-card, .error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 250px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-accent-sage);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.icon-warning {
  font-size: 48px;
  margin-bottom: 16px;
}

.icon-success {
  font-size: 48px;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: var(--color-success);
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
  font-weight: bold;
}

.success-view {
  text-align: center;
}

.success-view h2 {
  color: var(--color-primary-dark);
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 12px;
}

.success-message {
  color: var(--color-gray-800);
  font-size: 15px;
  line-height: 1.6;
}

.divider {
  height: 1.5px;
  background-color: var(--color-gray-200);
  margin: 24px 0;
}

.next-steps {
  font-size: 13.5px;
  color: var(--color-gray-500);
  line-height: 1.5;
}

.form-view h2 {
  color: var(--color-primary-dark);
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 8px;
}

.intro {
  color: var(--color-gray-500);
  font-size: 14.5px;
  margin-bottom: 24px;
  line-height: 1.5;
}

.order-summary {
  background-color: var(--color-gray-100);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.order-summary h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-gray-800);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-grid-item {
  display: flex;
  flex-direction: column;
}

.summary-grid-item .label {
  font-size: 11px;
  color: var(--color-gray-500);
  font-weight: 600;
  text-transform: uppercase;
}

.summary-grid-item .value {
  font-size: 13.5px;
  color: var(--color-gray-800);
  font-weight: 600;
}

.failed-reason {
  color: var(--color-danger) !important;
}

.reschedule-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-gray-800);
}

.date-input {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid var(--color-gray-200);
  border-radius: 8px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--color-gray-800);
  background-color: var(--color-white);
  outline: none;
  font-family: var(--font-sans);
}

.date-input:focus {
  border-color: var(--color-primary);
}

.help-text {
  font-size: 12px;
  color: var(--color-gray-500);
  line-height: 1.4;
}

.error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  border-radius: 8px;
  padding: 12px;
  font-size: 13.5px;
  font-weight: 600;
}

.btn-primary {
  width: 100%;
  padding: 14px;
  background-color: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: 8px;
  font-size: 14.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s;
  font-family: var(--font-sans);
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
}

.btn-primary:disabled {
  background-color: var(--color-accent-sage);
  color: var(--color-gray-500);
  cursor: not-allowed;
}
</style>
