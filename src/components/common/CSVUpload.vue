<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  (e: 'stops-loaded', stops: ParsedStop[]): void
}>()

export interface ParsedStop {
  orderId: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  latitude: number
  longitude: number
  deliveryDate: string
  packageWeightKg: number
  packageVolumeCbms: number
  serviceTimeMins: number
  requiredPodType: string
}

const isDragging = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  errorMessage.value = ''
  successMessage.value = ''

  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0]
    processFile(file)
  }
}

const handleFileSelect = (e: Event) => {
  errorMessage.value = ''
  successMessage.value = ''
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    processFile(target.files[0])
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const processFile = (file: File) => {
  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    errorMessage.value = 'Invalid file type. Please upload a .csv file.'
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string
      const stops = parseCSV(text)
      if (stops.length === 0) {
        errorMessage.value = 'No valid records found in the CSV.'
        return
      }
      successMessage.value = `Successfully parsed ${stops.length} delivery stops.`
      emit('stops-loaded', stops)
    } catch (err: any) {
      errorMessage.value = err.message || 'Error parsing CSV file.'
    }
  }
  reader.onerror = () => {
    errorMessage.value = 'Failed to read the file.'
  }
  reader.readAsText(file)
}

const parseCSV = (text: string): ParsedStop[] => {
  const lines = text.split(/\r?\n/)
  if (lines.length === 0 || !lines[0].trim()) {
    throw new Error('CSV is empty.')
  }

  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
  
  // Find column indices case-insensitively
  const orderIdIdx = headers.findIndex(h => h.toLowerCase() === 'orderid')
  const customerNameIdx = headers.findIndex(h => h.toLowerCase() === 'customername')
  const customerPhoneIdx = headers.findIndex(h => h.toLowerCase() === 'customerphone')
  const deliveryAddressIdx = headers.findIndex(h => h.toLowerCase() === 'deliveryaddress')
  const latitudeIdx = headers.findIndex(h => h.toLowerCase() === 'latitude')
  const longitudeIdx = headers.findIndex(h => h.toLowerCase() === 'longitude')
  const deliveryDateIdx = headers.findIndex(h => h.toLowerCase() === 'deliverydate')
  const packageWeightKgIdx = headers.findIndex(h => h.toLowerCase() === 'packageweightkg')
  const packageVolumeCbmsIdx = headers.findIndex(h => h.toLowerCase() === 'packagevolumecbms')
  const serviceTimeMinsIdx = headers.findIndex(h => h.toLowerCase() === 'servicetimemins')
  const requiredPodTypeIdx = headers.findIndex(h => h.toLowerCase() === 'requiredpodtype')

  if (orderIdIdx === -1 || customerNameIdx === -1 || deliveryAddressIdx === -1) {
    throw new Error('Missing required columns. CSV headers must include at least: "orderId", "customerName", "deliveryAddress"')
  }

  const stops: ParsedStop[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // Skip blank lines

    // Parse CSV line handling quotes correctly
    const columns: string[] = []
    let currentVal = ''
    let insideQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"') {
        insideQuotes = !insideQuotes
      } else if (char === ',' && !insideQuotes) {
        columns.push(currentVal.trim().replace(/^["']|["']$/g, ''))
        currentVal = ''
      } else {
        currentVal += char
      }
    }
    columns.push(currentVal.trim().replace(/^["']|["']$/g, ''))

    const orderId = columns[orderIdIdx]
    const customerName = columns[customerNameIdx]
    const customerPhone = customerPhoneIdx !== -1 ? columns[customerPhoneIdx] : '+91 00000 00000'
    const deliveryAddress = columns[deliveryAddressIdx]
    const latitude = latitudeIdx !== -1 && columns[latitudeIdx] ? parseFloat(columns[latitudeIdx]) : 28.6139
    const longitude = longitudeIdx !== -1 && columns[longitudeIdx] ? parseFloat(columns[longitudeIdx]) : 77.2090
    const deliveryDate = deliveryDateIdx !== -1 && columns[deliveryDateIdx] ? columns[deliveryDateIdx] : new Date().toISOString().slice(0, 10)
    const packageWeightKg = packageWeightKgIdx !== -1 && columns[packageWeightKgIdx] ? parseFloat(columns[packageWeightKgIdx]) : 1.0
    const packageVolumeCbms = packageVolumeCbmsIdx !== -1 && columns[packageVolumeCbmsIdx] ? parseFloat(columns[packageVolumeCbmsIdx]) : 0.01
    const serviceTimeMins = serviceTimeMinsIdx !== -1 && columns[serviceTimeMinsIdx] ? parseInt(columns[serviceTimeMinsIdx]) : 5
    const requiredPodType = requiredPodTypeIdx !== -1 && columns[requiredPodTypeIdx] ? columns[requiredPodTypeIdx] : 'NONE'
    
    if (!orderId || !customerName || !deliveryAddress) {
      continue // skip if missing critical data
    }

    stops.push({
      orderId,
      customerName,
      customerPhone,
      deliveryAddress,
      latitude,
      longitude,
      deliveryDate,
      packageWeightKg,
      packageVolumeCbms,
      serviceTimeMins,
      requiredPodType
    })
  }

  return stops
}
</script>

<template>
  <div class="csv-upload-card">
    <div class="card-desc">
      <h3>CSV Import Wizard</h3>
      <p>Import new stops directly into the planner. Files must contain columns like: <code>orderId</code>, <code>customerName</code>, <code>deliveryAddress</code>.</p>
    </div>

    <!-- Drop Zone -->
    <div 
      class="dropzone"
      :class="{ 'dragging': isDragging }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="triggerFileInput"
    >
      <input 
        type="file" 
        ref="fileInput" 
        class="hidden-file-input" 
        accept=".csv" 
        @change="handleFileSelect"
      />
      
      <div class="dropzone-content">
        <div class="upload-icon-box">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="upload-svg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
        </div>
        <div class="dropzone-text">
          <span class="highlight">Click to upload</span> or drag and drop CSV file here
        </div>
        <div class="dropzone-subtext">Supports standard CSV files (.csv)</div>
      </div>
    </div>

    <!-- Feedback States -->
    <transition name="slide">
      <div v-if="errorMessage" class="alert-box error-alert">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="alert-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <span>{{ errorMessage }}</span>
      </div>
      <div v-else-if="successMessage" class="alert-box success-alert">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="alert-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ successMessage }}</span>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.csv-upload-card {
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-desc h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-primary-dark);
  margin-bottom: 4px;
}

.card-desc p {
  font-size: 13px;
  color: var(--color-gray-500);
  line-height: 1.4;
}

.card-desc code {
  background-color: var(--color-gray-100);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: var(--color-primary-dark);
}

.dropzone {
  border: 2px dashed var(--color-gray-200);
  background-color: var(--color-gray-50);
  border-radius: 10px;
  padding: 30px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
}

.dropzone:hover, .dropzone.dragging {
  border-color: var(--color-primary);
  background-color: rgba(48, 109, 41, 0.03);
}

.hidden-file-input {
  display: none;
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: rgba(48, 109, 41, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  transition: transform 0.25s ease;
}

.dropzone:hover .upload-icon-box {
  transform: translateY(-2px);
}

.upload-svg {
  width: 22px;
  height: 22px;
}

.dropzone-text {
  font-size: 14px;
  color: var(--color-gray-800);
  font-weight: 500;
}

.dropzone-text .highlight {
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: underline;
}

.dropzone-subtext {
  font-size: 11.5px;
  color: var(--color-gray-500);
}

/* Alert Boxes */
.alert-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.4;
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.alert-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.error-alert {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
}

.success-alert {
  background-color: rgba(48, 109, 41, 0.06);
  border: 1px solid rgba(48, 109, 41, 0.2);
  color: var(--color-primary-dark);
}
</style>
