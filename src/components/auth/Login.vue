<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// Form Fields
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const role = ref('DISPATCHER') // Default role per specification
// UI States
const isSubmitting = ref(false)
const usernameTouched = ref(false)
const passwordTouched = ref(false)
const loginError = ref('')

// Simple validation
const isUsernameValid = computed(() => username.value.length >= 4)
const isPasswordValid = computed(() => password.value.length >= 8)

const usernameErrorMessage = computed(() => {
  if (!usernameTouched.value) return ''
  if (!username.value) return 'Employee ID is required'
  if (username.value.length < 4) return 'Employee ID must be at least 4 characters'
  return ''
})

const passwordErrorMessage = computed(() => {
  if (!passwordTouched.value) return ''
  if (!password.value) return 'Password is required'
  if (password.value.length < 8) return 'Password must be at least 8 characters'
  return ''
})

const isFormValid = computed(() => {
  return isUsernameValid.value && isPasswordValid.value
})

const handleLogin = async () => {
  usernameTouched.value = true
  passwordTouched.value = true

  if (!isFormValid.value) return

  isSubmitting.value = true
  loginError.value = ''

  try {
    await authStore.login(username.value, password.value, role.value)
  } catch (err: any) {
    loginError.value = authStore.error || err.message || 'Authentication failed'
  } finally {
    isSubmitting.value = false
  }
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}
</script>

<template>
  <div class="login-container">
    <!-- Main Split Login Screen -->
    <div class="signup-split-layout">
      <!-- Left Panel: Animated Fleet Radar Console -->
      <div class="visual-side">
        <!-- Brand Badge -->
        <div class="brand-container">
          <div class="logo-box">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="brand-svg">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125a1.125 1.125 0 0 0 1.125-1.125V9.75M3.75 12h12.75M3 14.25h13.5m0 0V9.75M16.5 9.75V5.25A2.25 2.25 0 0 0 14.25 3H6.125A2.25 2.25 0 0 0 3.875 5.25V14.25m12.625-4.5h2.375A2.25 2.25 0 0 1 21 12v3.75m-2.25-5.25v2.25m-15-2.25h12" />
            </svg>
          </div>
          <span class="brand-name">LAST-MILE</span>
        </div>

        <div class="hero-content">
          <h1>Initialize Terminal Session.</h1>
          <p>
            Secure connection for authorized personnel. Log in to monitor active routing corridors, dispatch vehicles, and track driver SLA status.
          </p>
        </div>

        <!-- Fleet Radar Simulator -->
        <div class="dispatch-map-simulator">
          <svg class="map-svg" viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <!-- Technical Grid Pattern -->
              <pattern id="radar-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(231, 225, 177, 0.1)" stroke-width="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#radar-grid)" rx="12" />

            <!-- Concentric Radar Range Rings -->
            <circle cx="200" cy="120" r="30" fill="none" stroke="rgba(231, 225, 177, 0.18)" stroke-width="1" />
            <circle cx="200" cy="120" r="65" fill="none" stroke="rgba(231, 225, 177, 0.18)" stroke-dasharray="3,3" stroke-width="1" />
            <circle cx="200" cy="120" r="100" fill="none" stroke="rgba(231, 225, 177, 0.18)" stroke-width="1" />
            
            <!-- Axis lines -->
            <line x1="200" y1="10" x2="200" y2="230" stroke="rgba(231, 225, 177, 0.15)" stroke-width="1" />
            <line x1="20" y1="120" x2="380" y2="120" stroke="rgba(231, 225, 177, 0.15)" stroke-width="1" />
            
            <!-- Rotating Radar Sweep Line -->
            <line x1="200" y1="120" x2="200" y2="20" stroke="var(--color-accent-sage)" stroke-width="1.5" class="radar-sweep" />

            <!-- Radar Blips (Simulating trucks on map) -->
            <!-- Blip 1 (North-East) -->
            <g class="radar-blip blip-1">
              <circle cx="260" cy="70" r="4" fill="#10b981" />
              <circle cx="260" cy="70" r="12" fill="none" stroke="#10b981" stroke-width="1" class="blip-pulse" />
              <text x="270" y="73" class="blip-label">COR-301 (ACTIVE)</text>
            </g>

            <!-- Blip 2 (South-West) -->
            <g class="radar-blip blip-2">
              <circle cx="120" cy="170" r="4" fill="#10b981" />
              <circle cx="120" cy="170" r="12" fill="none" stroke="#10b981" stroke-width="1" class="blip-pulse" />
              <text x="130" y="173" class="blip-label">FLEET-B4 (ON ROUTE)</text>
            </g>

            <!-- Blip 3 (Center Main Hub) -->
            <circle cx="200" cy="120" r="6" fill="var(--color-bg-base)" stroke="var(--color-primary)" stroke-width="2" />
            <text x="200" y="137" text-anchor="middle" class="blip-hub-label">TERMINAL GATEWAY</text>

            <!-- Degree Labels -->
            <text x="200" y="24" text-anchor="middle" class="radar-deg">000° N</text>
            <text x="375" y="123" text-anchor="end" class="radar-deg">090° E</text>
            <text x="200" y="226" text-anchor="middle" class="radar-deg">180° S</text>
            <text x="25" y="123" class="radar-deg">270° W</text>
          </svg>
        </div>

        <!-- System Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value pulse-text">SECURE</span>
            <span class="stat-desc">Security Status</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">14 Nodes</span>
            <span class="stat-desc">Sector Corridors</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">100%</span>
            <span class="stat-desc">GPS Lock Status</span>
          </div>
        </div>

        <div class="visual-footer">
          <span>Last-Mile Dispatch Systems Inc.</span>
          <span>System Version: 2026.1</span>
        </div>
      </div>

      <!-- Right Panel: Sign In Form -->
      <div class="form-side">
        <div class="form-wrapper">
          <div class="form-header">
            <h2>Portal Sign In</h2>
            <p>Access your designated operations console and manage terminal resources.</p>
          </div>

          <form @submit.prevent="handleLogin" class="signup-form">
            <!-- Role Selection -->
            <div class="form-group">
              <label for="role">Authorized Session Role</label>
              <div class="input-icon-wrapper">
                <span class="field-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.746 3.746 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12z" />
                  </svg>
                </span>
                <select id="role" v-model="role" required>
                  <option value="DISPATCHER">Dispatcher</option>
                  <option value="FLEET_MANAGER">Fleet Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            <!-- Employee ID Input -->
            <div class="form-group" :class="{ 'has-error': usernameErrorMessage }">
              <label for="username">Employee ID</label>
              <div class="input-icon-wrapper">
                <span class="field-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </span>
                <input 
                  type="text" 
                  id="username" 
                  v-model="username"
                  @blur="usernameTouched = true"
                  placeholder="e.g. EMP1001"
                  autocomplete="username"
                  required
                />
              </div>
              <span v-if="usernameErrorMessage" class="error-msg">{{ usernameErrorMessage }}</span>
            </div>



            <!-- Password Input -->
            <div class="form-group" :class="{ 'has-error': passwordErrorMessage }">
              <label for="password">Password</label>
              <div class="input-icon-wrapper">
                <span class="field-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z" />
                  </svg>
                </span>
                <input 
                  :type="showPassword ? 'text' : 'password'" 
                  id="password" 
                  v-model="password"
                  @blur="passwordTouched = true"
                  placeholder="Enter security password"
                  autocomplete="current-password"
                  required
                />
                <button type="button" @click="togglePasswordVisibility" class="btn-toggle-eye" aria-label="Toggle Password Visibility">
                  <!-- Eye Icon -->
                  <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="eye-svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <!-- Eye Slash Icon -->
                  <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="eye-svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L17.772 17.772m0 0a3 3 0 11-4.243-4.243m4.243 4.243L19.5 19.5M3 3l3.228 3.228" />
                  </svg>
                </button>
              </div>
              <span v-if="passwordErrorMessage" class="error-msg">{{ passwordErrorMessage }}</span>
            </div>

            <!-- Error Message Banner -->
            <div v-if="loginError" class="login-error-alert">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="alert-icon">
                <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
              </svg>
              <span>{{ loginError }}</span>
            </div>

            <!-- Submit Button -->
            <button type="submit" class="btn-submit" :disabled="!isFormValid || isSubmitting">
              <span v-if="isSubmitting" class="loading-state">
                <svg class="spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="spinner-track"></circle>
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" class="spinner-head"></path>
                </svg>
                Syncing Credentials...
              </span>
              <span v-else>Initialize Terminal Session</span>
            </button>
          </form>

          <div class="form-footer">
            <p>New operator on this terminal?</p>
            <a href="#" @click.prevent="router.push('/signup')" class="login-link">Register Secure Account</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Main Container styling */
.login-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  background-color: var(--color-bg-base);
  box-sizing: border-box;
}

/* Layout Split */
.signup-split-layout {
  display: flex;
  width: 100%;
  min-height: 100vh;
}

/* LEFT PANEL: VISUAL & DECORATIVE */
.visual-side {
  flex: 1.1;
  background: linear-gradient(135deg, var(--color-primary-dark) 0%, #173d14 100%);
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  color: var(--color-bg-base);
  overflow: hidden;
}

.visual-side::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 70% 30%, rgba(231, 225, 177, 0.12) 0%, transparent 60%);
  pointer-events: none;
}

.brand-container {
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
}

.logo-box {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background-color: var(--color-accent-sage);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary-dark);
  box-shadow: var(--shadow-md);
}

.brand-svg {
  width: 24px;
  height: 24px;
}

.brand-name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--color-bg-base);
}

.hero-content {
  margin-top: 40px;
  max-width: 520px;
  z-index: 10;
}

.hero-content h1 {
  font-size: 44px;
  font-weight: 700;
  color: var(--color-white);
  line-height: 1.15;
  margin-bottom: 16px;
  letter-spacing: -1px;
}

.hero-content p {
  font-size: 17px;
  color: var(--color-accent-sage);
  line-height: 1.6;
}

/* Radar Simulator Layout */
.dispatch-map-simulator {
  margin: 32px 0;
  background: rgba(13, 83, 14, 0.4);
  border: 1px solid rgba(231, 225, 177, 0.2);
  border-radius: 14px;
  padding: 12px;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.2), var(--shadow-lg);
  backdrop-filter: blur(8px);
  z-index: 10;
  position: relative;
}

.map-svg {
  width: 100%;
  height: auto;
  display: block;
}

.radar-sweep {
  transform-origin: 200px 120px;
  animation: sweepRadar 6s linear infinite;
}

@keyframes sweepRadar {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Radar Blip Animations */
.radar-blip {
  opacity: 0;
  animation: blipFade 6s infinite ease-out;
}

.blip-1 {
  animation-delay: 1.2s;
}

.blip-2 {
  animation-delay: 4.2s;
}

.blip-pulse {
  transform-origin: inherit;
  animation: blipRing 1.5s ease-out infinite;
}

@keyframes blipFade {
  0% { opacity: 0; }
  10% { opacity: 1; }
  50% { opacity: 0.8; }
  100% { opacity: 0; }
}

@keyframes blipRing {
  0% { transform: scale(0.3); opacity: 0.8; }
  100% { transform: scale(1.3); opacity: 0; }
}

/* SVG Text elements style */
.blip-label {
  font-size: 8px;
  fill: #34d399;
  font-family: var(--font-mono, monospace);
  font-weight: bold;
}

.blip-hub-label {
  font-size: 9px;
  fill: var(--color-white);
  font-family: var(--font-sans);
  font-weight: bold;
}

.radar-deg {
  font-size: 8px;
  fill: var(--color-accent-sage);
  opacity: 0.6;
  font-family: var(--font-mono, monospace);
}

/* Stats Dashboard Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  z-index: 10;
}

.stat-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(231, 225, 177, 0.1);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  backdrop-filter: blur(4px);
  transition: transform 0.3s ease, border-color 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: rgba(231, 225, 177, 0.25);
  background: rgba(255, 255, 255, 0.08);
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-white);
  margin-bottom: 4px;
}

.stat-desc {
  font-size: 11px;
  color: var(--color-accent-sage);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.pulse-text {
  animation: textPulse 2s infinite ease-in-out;
}

@keyframes textPulse {
  0%, 100% { opacity: 0.9; color: #10b981; }
  50% { opacity: 1; color: var(--color-white); }
}

.visual-footer {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(231, 225, 177, 0.5);
  margin-top: 24px;
  z-index: 10;
}

/* RIGHT PANEL: FORM SECTION */
.form-side {
  flex: 0.9;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background-color: var(--color-white);
}

.form-wrapper {
  width: 100%;
  max-width: 440px;
  animation: fadeIn 0.6s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

.form-header {
  margin-bottom: 32px;
}

.form-header h2 {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-primary-dark);
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}

.form-header p {
  color: var(--color-gray-500);
  font-size: 15px;
  line-height: 1.5;
}

.signup-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.form-group label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-gray-800);
}

.input-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 14px;
  color: var(--color-gray-500);
  display: flex;
  align-items: center;
  pointer-events: none;
}

.field-icon svg {
  width: 20px;
  height: 20px;
}

.input-icon-wrapper input,
.input-icon-wrapper select {
  width: 100%;
  padding: 13px 16px 13px 44px;
  border-radius: 10px;
  border: 1.5px solid var(--color-gray-200);
  background-color: var(--color-gray-50);
  color: var(--color-gray-800);
  font-size: 15px;
  font-family: var(--font-sans);
  transition: all 0.25s ease;
  outline: none;
}

.input-icon-wrapper input::placeholder {
  color: var(--color-gray-500);
  opacity: 0.7;
}

.input-icon-wrapper input:hover,
.input-icon-wrapper select:hover {
  border-color: var(--color-accent-sage);
}

.input-icon-wrapper input:focus,
.input-icon-wrapper select:focus {
  border-color: var(--color-primary);
  background-color: var(--color-white);
  box-shadow: 0 0 0 4px rgba(48, 109, 41, 0.08);
}

.input-icon-wrapper select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a826e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 16px;
  padding-right: 40px;
  cursor: pointer;
}

.btn-toggle-eye {
  position: absolute;
  right: 14px;
  background: none;
  border: none;
  color: var(--color-gray-500);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.btn-toggle-eye:hover {
  color: var(--color-primary);
}

.eye-svg {
  width: 20px;
  height: 20px;
}

.has-error .input-icon-wrapper input {
  border-color: var(--color-danger);
  background-color: var(--color-danger-bg);
}

.has-error .input-icon-wrapper input:focus {
  box-shadow: 0 0 0 4px rgba(185, 28, 28, 0.1);
}

.error-msg {
  color: var(--color-danger);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  margin-top: 2px;
}

/* Submit Button */
.btn-submit {
  width: 100%;
  padding: 14px;
  border-radius: 10px;
  border: none;
  background-color: var(--color-primary);
  color: var(--color-bg-base);
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-md);
}

.btn-submit:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn-submit:active:not(:disabled) {
  transform: translateY(0);
}

.btn-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

/* Loader Animation */
.loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
}

.spinner {
  animation: rotateSpinner 1.2s linear infinite;
  width: 20px;
  height: 20px;
}

.spinner-track {
  opacity: 0.2;
}

@keyframes rotateSpinner {
  100% { transform: rotate(360deg); }
}

.form-footer {
  margin-top: 32px;
  text-align: center;
  font-size: 14px;
  color: var(--color-gray-500);
}

.login-link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 600;
  margin-left: 5px;
  display: inline-block;
  transition: color 0.2s;
}

.login-link:hover {
  color: var(--color-primary-dark);
  text-decoration: underline;
}


/* SUCCESS BOARD CONSOLE STYLING */
.success-console {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  padding: 40px;
  background-color: var(--color-bg-base);
}

.console-card {
  width: 100%;
  max-width: 640px;
  background: var(--color-white);
  border: 1px solid var(--color-accent-sage);
  border-radius: 16px;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  animation: terminalOpen 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes terminalOpen {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.console-header {
  background: var(--color-gray-800);
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.window-buttons {
  display: flex;
  gap: 6px;
}

.window-buttons .dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.window-buttons .red { background-color: #ef4444; }
.window-buttons .yellow { background-color: #f59e0b; }
.window-buttons .green { background-color: #10b981; }

.console-title {
  color: var(--color-accent-sage);
  font-size: 12px;
  font-family: var(--font-mono, monospace);
  font-weight: 500;
  letter-spacing: 1px;
}

.console-status-pill {
  font-size: 11px;
  font-weight: bold;
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  padding: 3px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background-color: #10b981;
  border-radius: 50%;
  animation: pulseIndicator 1.5s infinite;
}

.console-body {
  padding: 40px;
  text-align: center;
}

.success-icon-wrapper {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: rgba(48, 109, 41, 0.1);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
}

.success-check-icon {
  width: 42px;
  height: 42px;
}

.console-body h2 {
  font-size: 26px;
  color: var(--color-primary-dark);
  margin-bottom: 8px;
}

.console-intro {
  font-size: 15px;
  color: var(--color-gray-500);
  margin-bottom: 28px;
}

/* Details Panel */
.details-panel {
  background-color: var(--color-gray-50);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  padding: 16px 20px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 13.5px;
  border-bottom: 1px solid var(--color-gray-100);
  padding-bottom: 8px;
}

.detail-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.detail-row .label {
  color: var(--color-gray-500);
  font-weight: 600;
}

.detail-row .value {
  color: var(--color-gray-800);
  font-weight: 700;
}

.code-text {
  font-family: var(--font-mono, monospace);
  color: var(--color-primary) !important;
}

.badge-clearance {
  background-color: rgba(48, 109, 41, 0.08);
  color: var(--color-primary-dark);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

/* Live Terminal Log */
.terminal-log {
  background-color: var(--color-gray-800);
  border-radius: 8px;
  padding: 16px;
  text-align: left;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  line-height: 1.6;
  color: #d1d5db;
  margin-bottom: 32px;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3);
}

.log-time { color: var(--color-accent-sage); }
.log-sys { color: #38bdf8; }
.log-net { color: #fb7185; }
.log-success-msg { color: #34d399; font-weight: bold; }
.log-line .highlight { color: #fbbf24; }

.blink {
  animation: cursorBlink 1s infinite step-end;
  color: #34d399;
}

@keyframes cursorBlink {
  from, to { opacity: 1; }
  50% { opacity: 0; }
}

.btn-console-primary {
  padding: 14px 28px;
  background-color: var(--color-primary);
  color: var(--color-bg-base);
  border: none;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.25s;
  box-shadow: var(--shadow-md);
}

.btn-console-primary:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn-arrow-icon {
  width: 18px;
  height: 18px;
}

.login-error-alert {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 12px;
  border-radius: 8px;
  margin-top: 8px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
}

.alert-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--color-danger);
}

/* RESPONSIVE BREAKPOINTS */
@media (max-width: 1024px) {
  .signup-split-layout {
    flex-direction: column;
  }

  .visual-side {
    padding: 32px;
    min-height: auto;
  }

  .hero-content h1 {
    font-size: 32px;
  }

  .dispatch-map-simulator {
    margin: 20px 0;
  }

  .form-side {
    padding: 40px 20px;
  }

  .success-console {
    padding: 20px 10px;
  }

  .console-body {
    padding: 24px 16px;
  }
}
</style>
