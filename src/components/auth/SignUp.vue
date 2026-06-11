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
const agreeToTerms = ref(false)
const role = ref('DISPATCHER') // Default role per API requirements

// UI States
const isSubmitting = ref(false)
const usernameTouched = ref(false)
const passwordTouched = ref(false)
const signupError = ref('')

// Username Validation
const usernameRegex = /^[a-zA-Z0-9_]{4,16}$/
const isUsernameValid = computed(() => usernameRegex.test(username.value))
const usernameErrorMessage = computed(() => {
  if (!usernameTouched.value) return ''
  if (!username.value) return 'Username is required'
  if (username.value.length < 4) return 'Must be at least 4 characters'
  if (username.value.length > 16) return 'Must not exceed 16 characters'
  if (!/^[a-zA-Z0-9_]+$/.test(username.value)) return 'Only letters, numbers, and underscores allowed'
  return ''
})

// Password Validation
const passwordCriteria = computed(() => {
  const p = password.value
  return [
    { label: 'At least 8 characters', met: p.length >= 8 },
    { label: 'At least 1 uppercase letter', met: /[A-Z]/.test(p) },
    { label: 'At least 1 number', met: /[0-9]/.test(p) },
    { label: 'At least 1 special character', met: /[^A-Za-z0-9]/.test(p) }
  ]
})

const isPasswordValid = computed(() => passwordCriteria.value.every(c => c.met))

const passwordStrength = computed(() => {
  if (!password.value) return 0
  let score = 0
  if (password.value.length >= 8) score += 25
  if (/[A-Z]/.test(password.value)) score += 25
  if (/[0-9]/.test(password.value)) score += 25
  if (/[^A-Za-z0-9]/.test(password.value)) score += 25
  return score
})

const strengthLabel = computed(() => {
  const score = passwordStrength.value
  if (score === 0) return { text: 'None', color: 'gray-500' }
  if (score <= 25) return { text: 'Weak', color: '#b91c1c' } // red
  if (score <= 50) return { text: 'Fair', color: '#d97706' } // amber
  if (score <= 75) return { text: 'Good', color: '#306D29' } // primary green
  return { text: 'Strong', color: '#0D530E' } // dark green
})

// Form Validation
const isFormValid = computed(() => {
  return (
    isUsernameValid.value &&
    isPasswordValid.value &&
    agreeToTerms.value
  )
})

// Submission Handler
const handleSignUp = async () => {
  usernameTouched.value = true
  passwordTouched.value = true
  
  if (!isFormValid.value) return

  isSubmitting.value = true
  signupError.value = ''
  
  try {
    // Call Pinia action (maps to POST /api/auth/signup)
    await authStore.signup(username.value, password.value, role.value)
  } catch (err: any) {
    signupError.value = authStore.error || err.message || 'Signup failed'
  } finally {
    isSubmitting.value = false
  }
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}
</script>

<template>
  <div class="signup-container">
    <!-- Main Split Signup Screen -->
    <div class="signup-split-layout">
      <!-- Left Panel: Animated Logistics Map & Info -->
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
          <h1>Route Control Starts Here.</h1>
          <p>
            Connect drivers, dispatch routes in real-time, optimize schedules, and manage exceptions from a centralized command center.
          </p>
        </div>

        <!-- Animated Route Simulator Map -->
        <div class="dispatch-map-simulator">
          <svg class="map-svg" viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Grid Lines for Technical Dashboard Aesthetic -->
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(231, 225, 177, 0.12)" stroke-width="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" rx="12" />

            <!-- Connection Routes (Animated dashed curves) -->
            <!-- Route A -->
            <path id="route-a" d="M 60,160 Q 140,80 200,120 T 320,80" fill="none" stroke="var(--color-accent-sage)" stroke-width="2" stroke-dasharray="6,4" class="animated-path-1" />
            <!-- Route B -->
            <path id="route-b" d="M 80,60 Q 200,200 280,180" fill="none" stroke="var(--color-accent-sage)" stroke-width="1.5" stroke-dasharray="5,5" class="animated-path-2" />
            
            <!-- Pulse Radar Ring on Central Hub -->
            <circle cx="200" cy="120" r="15" fill="none" stroke="var(--color-accent-sage)" stroke-width="1" class="radar-pulse-1" />
            <circle cx="200" cy="120" r="28" fill="none" stroke="var(--color-accent-sage)" stroke-width="1" class="radar-pulse-2" />

            <!-- Hub Nodes -->
            <!-- Central Hub (Metro) -->
            <circle cx="200" cy="120" r="8" fill="var(--color-primary)" />
            <circle cx="200" cy="120" r="4" fill="var(--color-bg-base)" />
            <text x="200" y="105" text-anchor="middle" class="map-label label-bold">MLC-9 (MAIN)</text>

            <!-- North Hub -->
            <circle cx="80" cy="60" r="6" fill="var(--color-primary-dark)" />
            <circle cx="80" cy="60" r="3" fill="var(--color-accent-sage)" />
            <text x="80" y="48" text-anchor="middle" class="map-label">NDH-1</text>

            <!-- South Hub -->
            <circle cx="280" cy="180" r="6" fill="var(--color-primary-dark)" />
            <circle cx="280" cy="180" r="3" fill="var(--color-accent-sage)" />
            <text x="280" y="198" text-anchor="middle" class="map-label">SVD-2</text>

            <!-- East Hub -->
            <circle cx="320" cy="80" r="6" fill="var(--color-primary-dark)" />
            <circle cx="320" cy="80" r="3" fill="var(--color-accent-sage)" />
            <text x="320" y="68" text-anchor="middle" class="map-label">EST-4</text>

            <!-- West Hub -->
            <circle cx="60" cy="160" r="6" fill="var(--color-primary-dark)" />
            <circle cx="60" cy="160" r="3" fill="var(--color-accent-sage)" />
            <text x="60" y="178" text-anchor="middle" class="map-label">WDT-3</text>

            <!-- Animated Vehicle Markers (SVG Trucks along paths) -->
            <!-- Marker A -->
            <g class="animated-vehicle-1">
              <circle r="5" fill="var(--color-primary-dark)" stroke="var(--color-bg-base)" stroke-width="1" />
              <path d="M-2 -2 L2 0 L-2 2 Z" fill="var(--color-bg-base)" transform="scale(0.8)" />
            </g>
            
            <!-- Marker B -->
            <g class="animated-vehicle-2">
              <circle r="4" fill="var(--color-primary)" stroke="var(--color-bg-base)" stroke-width="1" />
            </g>
          </svg>
        </div>

        <!-- Live Statistics Panel -->
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value pulse-text">24 / 28</span>
            <span class="stat-desc">Fleets Routed</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">99.8%</span>
            <span class="stat-desc">Delivery SLA</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">0.12s</span>
            <span class="stat-desc">Ping Latency</span>
          </div>
        </div>

        <div class="visual-footer">
          <span>Last-Mile Dispatch Systems Inc.</span>
          <span>System Version: 2026.1</span>
        </div>
      </div>

      <!-- Right Panel: Sign Up Form -->
      <div class="form-side">
        <div class="form-wrapper">
          <div class="form-header">
            <h2>Register Secure Account</h2>
            <p>Register your credentials to access your designated operations console.</p>
          </div>

          <form @submit.prevent="handleSignUp" class="signup-form">
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

            <!-- Username Input -->
            <div class="form-group" :class="{ 'has-error': usernameErrorMessage }">
              <label for="username">Username</label>
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
                  placeholder="e.g. jsmith_dispatch"
                  autocomplete="username"
                  required
                />
                <!-- Username checklist feedback -->
                <span v-if="username && isUsernameValid" class="field-feedback-success">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
              </div>
              <span v-if="usernameErrorMessage" class="error-msg">{{ usernameErrorMessage }}</span>
            </div>



            <!-- Password Input -->
            <div class="form-group" :class="{ 'has-error': passwordTouched && !isPasswordValid }">
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
                  placeholder="Create a secure password"
                  autocomplete="new-password"
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

              <!-- Password Strength Analyzer -->
              <div v-if="password" class="password-strength-box">
                <div class="strength-bar-container">
                  <div class="strength-bar" :style="{ width: passwordStrength + '%', backgroundColor: strengthLabel.color }"></div>
                </div>
                <div class="strength-info">
                  <span class="strength-text">Password Strength: <strong>{{ strengthLabel.text }}</strong></span>
                </div>

                <!-- Criteria Checklist -->
                <ul class="criteria-list">
                  <li v-for="(criterion, idx) in passwordCriteria" :key="idx" :class="{ 'met': criterion.met }">
                    <span class="bullet-icon">
                      <svg v-if="criterion.met" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </span>
                    <span class="criterion-label">{{ criterion.label }}</span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Terms and Agreements -->
            <div class="form-checkbox">
              <label class="checkbox-container">
                <input type="checkbox" v-model="agreeToTerms" required />
                <span class="checkmark"></span>
                <span class="checkbox-text">
                  I agree to the Last-Mile Dispatch Security Terms and operational guidelines for coordinate transmission.
                </span>
              </label>
            </div>

            <!-- Signup Error Alert -->
            <div v-if="signupError" class="login-error-alert">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="alert-icon">
                <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
              </svg>
              <span>{{ signupError }}</span>
            </div>

            <!-- Submit Button -->
            <button type="submit" class="btn-submit" :disabled="!isFormValid || isSubmitting">
              <span v-if="isSubmitting" class="loading-state">
                <svg class="spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="spinner-track"></circle>
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" class="spinner-head"></path>
                </svg>
                Processing Handshake...
              </span>
              <span v-else>Register Secure Account</span>
            </button>
          </form>

          <div class="form-footer">
            <p>Already registered on this terminal?</p>
            <a href="#" @click.prevent="router.push('/login')" class="login-link">Access Portal Login</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Main Container styling */
.signup-container {
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

/* Visual Background Grid Decorator */
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

/* Map Simulator Styles */
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

.map-label {
  font-size: 9px;
  fill: var(--color-accent-sage);
  font-family: var(--font-sans);
  letter-spacing: 0.5px;
}

.label-bold {
  font-weight: bold;
  fill: var(--color-white);
  font-size: 10px;
}

/* Route SVG Animations */
.animated-path-1 {
  stroke-dasharray: 8, 6;
  animation: dash1 25s linear infinite;
}

.animated-path-2 {
  stroke-dasharray: 6, 6;
  animation: dash2 20s linear infinite;
}

@keyframes dash1 {
  to {
    stroke-dashoffset: -1000;
  }
}

@keyframes dash2 {
  to {
    stroke-dashoffset: 1000;
  }
}

/* Radar Pulse Animations */
.radar-pulse-1, .radar-pulse-2 {
  transform-origin: 200px 120px;
  animation: pulseRadar 3s ease-out infinite;
}

.radar-pulse-2 {
  animation-delay: 1.5s;
}

@keyframes pulseRadar {
  0% {
    transform: scale(0.2);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.2);
    opacity: 0;
  }
}

/* Vehicle Markers along SVG path motion */
.animated-vehicle-1 {
  offset-path: path("M 60,160 Q 140,80 200,120 T 320,80");
  animation: travel-1 15s linear infinite;
  offset-rotate: auto;
}

.animated-vehicle-2 {
  offset-path: path("M 80,60 Q 200,200 280,180");
  animation: travel-2 12s linear infinite alternate;
}

@keyframes travel-1 {
  0% { offset-distance: 0%; }
  100% { offset-distance: 100%; }
}

@keyframes travel-2 {
  0% { offset-distance: 0%; }
  100% { offset-distance: 100%; }
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
  0%, 100% { opacity: 0.9; }
  50% { opacity: 1; color: var(--color-accent-sage); }
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

/* Signup Inputs Styles */
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

/* Arrow dropdown reset for styled Select */
.input-icon-wrapper select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a826e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 16px;
  padding-right: 40px;
  cursor: pointer;
}

/* Password Eye Button */
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

/* Checkmark dynamic success icon on username */
.field-feedback-success {
  position: absolute;
  right: 14px;
  color: var(--color-success);
  display: flex;
  align-items: center;
}

.field-feedback-success svg {
  width: 18px;
  height: 18px;
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

/* Projected Dispatcher ID style */
.mock-id-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-gray-100);
  border: 1px dashed var(--color-accent-sage);
  border-radius: 8px;
  padding: 10px 14px;
  position: relative;
  overflow: hidden;
}

.mock-id-field::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: var(--color-primary);
}

.pulse-ring {
  width: 6px;
  height: 6px;
  background-color: var(--color-primary);
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
  animation: pulseIndicator 1.5s infinite;
}

@keyframes pulseIndicator {
  0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(48, 109, 41, 0.4); }
  70% { transform: scale(1.1); opacity: 0.5; box-shadow: 0 0 0 6px rgba(48, 109, 41, 0); }
  100% { transform: scale(1); opacity: 0; box-shadow: 0 0 0 0 rgba(48, 109, 41, 0); }
}

.id-text {
  font-family: var(--font-mono, monospace);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary-dark);
  flex-grow: 1;
}

.badge-role {
  font-size: 10px;
  font-weight: 700;
  background-color: var(--color-accent-sage);
  color: var(--color-primary-dark);
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.field-tip {
  font-size: 11px;
  color: var(--color-gray-500);
}

/* Password Strength Box */
.password-strength-box {
  margin-top: 10px;
  background: var(--color-gray-50);
  border: 1.5px solid var(--color-gray-100);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.strength-bar-container {
  width: 100%;
  height: 5px;
  background-color: var(--color-gray-200);
  border-radius: 3px;
  overflow: hidden;
}

.strength-bar {
  height: 100%;
  transition: width 0.4s ease, background-color 0.4s;
  width: 0;
}

.strength-info {
  font-size: 12.5px;
  color: var(--color-gray-800);
}

.criteria-list {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  margin-top: 4px;
}

.criteria-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-gray-500);
  transition: color 0.25s;
}

.criteria-list li.met {
  color: var(--color-success);
  font-weight: 500;
}

.bullet-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: var(--color-gray-200);
  color: var(--color-gray-500);
  transition: all 0.25s;
}

.criteria-list li.met .bullet-icon {
  background-color: rgba(21, 128, 61, 0.12);
  color: var(--color-success);
}

.bullet-icon svg {
  width: 10px;
  height: 10px;
}

/* Custom Styled Checkbox */
.form-checkbox {
  margin-top: 6px;
}

.checkbox-container {
  display: flex;
  position: relative;
  padding-left: 28px;
  cursor: pointer;
  font-size: 13.5px;
  color: var(--color-gray-800);
  user-select: none;
  line-height: 1.4;
}

.checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  position: absolute;
  top: 2px;
  left: 0;
  height: 18px;
  width: 18px;
  background-color: var(--color-gray-50);
  border: 1.5px solid var(--color-gray-200);
  border-radius: 4px;
  transition: all 0.2s;
}

.checkbox-container:hover input ~ .checkmark {
  border-color: var(--color-accent-sage);
}

.checkbox-container input:checked ~ .checkmark {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.checkbox-container input:checked ~ .checkmark:after {
  display: block;
}

.checkbox-container .checkmark:after {
  left: 5px;
  top: 2px;
  width: 5px;
  height: 9px;
  border: solid var(--color-white);
  border-width: 0 2.2px 2.2px 0;
  transform: rotate(45deg);
}

.checkbox-text {
  font-weight: 500;
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

/* Loader Animation inside Button */
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

/* Footer Link styling */
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

/* System Details panel */
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
