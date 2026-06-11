<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import apiClient from '../../services/api'

const authStore = useAuthStore()

// Logout handler
const handleLogout = () => {
  authStore.logout()
}

// Active view state: 'dashboard' | 'drivers' | 'alerts'
const currentView = ref<'dashboard' | 'drivers' | 'alerts'>('dashboard')

// Timeframe state
const selectedTimeframe = ref<'1d' | '30d' | '60d' | '90d' | '1y'>('30d')

interface Driver {
  id: string
  name: string
  route: string
  assigned: number
  completed: number
  pending: number
  exceptions: number
  status: string
  phone: string
}

// Driver Roster Table State & Filters
const searchQuery = ref('')
const statusFilter = ref('ALL')

const fallbackDrivers: Driver[] = [
  { id: 'DRV-101', name: 'Rajesh Kumar', route: 'DEL-NCR-01', assigned: 8, completed: 6, pending: 1, exceptions: 1, status: 'Active', phone: '+91 98765 43210' },
  { id: 'DRV-104', name: 'Amit Sharma', route: 'MUM-WST-04', assigned: 5, completed: 5, pending: 0, exceptions: 0, status: 'Completed', phone: '+91 87654 32109' },
  { id: 'DRV-208', name: 'Priya Patel', route: 'BLR-OUT-02', assigned: 7, completed: 4, pending: 2, exceptions: 1, status: 'On Break', phone: '+91 76543 21098' },
  { id: 'DRV-309', name: 'Vikram Singh', route: 'HYD-MTR-09', assigned: 9, completed: 7, pending: 2, exceptions: 0, status: 'Active', phone: '+91 91234 56789' },
  { id: 'DRV-112', name: 'Karan Johar', route: 'DEL-SOUTH-02', assigned: 4, completed: 2, pending: 2, exceptions: 0, status: 'Inactive', phone: '+91 95555 12345' },
  { id: 'DRV-215', name: 'Neha Gupta', route: 'BLR-EC-05', assigned: 6, completed: 5, pending: 0, exceptions: 1, status: 'Active', phone: '+91 96666 54321' }
]

const drivers = ref<Driver[]>([])

const loadDrivers = async () => {
  try {
    const response = await apiClient.get('/drivers')
    if (response.data && response.data.status === 'success') {
      const apiDrivers = response.data.data || []
      if (apiDrivers.length > 0) {
        drivers.value = apiDrivers.map((apiDriver: any) => {
          const fullName = `${apiDriver.firstName} ${apiDriver.lastName}`
          const existing = fallbackDrivers.find(d => d.name === fullName || d.id === apiDriver.employeeId)
          return {
            id: apiDriver.employeeId || apiDriver.driverId,
            name: fullName,
            route: existing?.route || 'DEL-NCR-01',
            assigned: existing?.assigned || 0,
            completed: existing?.completed || 0,
            pending: existing?.pending || 0,
            exceptions: existing?.exceptions || 0,
            status: apiDriver.active ? (existing?.status || 'Active') : 'Inactive',
            phone: apiDriver.phoneNumber ? `+91 ${apiDriver.phoneNumber}` : (existing?.phone || '+91 99999 99999')
          }
        })
        return
      }
    }
  } catch (err) {
    console.warn('Manager failed to load drivers from API:', err)
  }
  drivers.value = JSON.parse(JSON.stringify(fallbackDrivers))
}

onMounted(() => {
  loadDrivers()
})

// Compute timeframe stats dynamically
const timeframeStats = computed(() => {
  const d1Stops = drivers.value.reduce((sum, d) => sum + d.assigned, 0) || 39
  const d1Completed = drivers.value.reduce((sum, d) => sum + d.completed, 0) || 27
  const d1Pending = drivers.value.reduce((sum, d) => sum + d.pending, 0) || 8
  const d1Exceptions = drivers.value.reduce((sum, d) => sum + d.exceptions, 0) || 4
  const activeFleet = drivers.value.filter(d => d.status !== 'Inactive').length || 5
  const totalFleet = drivers.value.length || 6

  let multiplier = 1
  let isHistorical = true
  
  switch (selectedTimeframe.value) {
    case '1d':
      multiplier = 1
      isHistorical = false
      break
    case '30d':
      multiplier = 30
      break
    case '60d':
      multiplier = 60
      break
    case '90d':
      multiplier = 90
      break
    case '1y':
      multiplier = 365
      break
  }

  if (!isHistorical) {
    const slaPercent = (d1Completed + d1Exceptions) > 0 
      ? Math.round((d1Completed / (d1Completed + d1Exceptions)) * 1000) / 10 
      : 89.1
    return {
      stops: d1Stops,
      completed: d1Completed,
      pending: d1Pending,
      exceptions: d1Exceptions,
      activeFleet: `${activeFleet} / ${totalFleet}`,
      sla: `${slaPercent}%`,
      slaRaw: slaPercent,
      utilizationDesc: `${Math.round((activeFleet / totalFleet) * 100)}% resource utilization`,
      progressDesc: `${Math.round((d1Completed / d1Stops) * 100)}% progress rate`,
      exceptionDesc: `${Math.round((d1Exceptions / d1Stops) * 1000) / 10}% exception rate`
    }
  } else {
    const totalStops = Math.round(d1Stops * multiplier * 0.95)
    const exceptions = Math.round(totalStops * 0.078)
    const completed = totalStops - exceptions
    const pending = 0
    const slaPercent = Math.round((completed / totalStops) * 1000) / 10
    
    return {
      stops: totalStops,
      completed: completed,
      pending: pending,
      exceptions: exceptions,
      activeFleet: `${activeFleet} / ${totalFleet}`,
      sla: `${slaPercent}%`,
      slaRaw: slaPercent,
      utilizationDesc: `Avg ${Math.round((activeFleet / totalFleet) * 100)}% utilization`,
      progressDesc: `100% resolution rate`,
      exceptionDesc: `${Math.round((exceptions / totalStops) * 1000) / 10}% exception rate`
    }
  }
})

// KPI metrics
const kpis = computed(() => {
  const stats = timeframeStats.value
  return [
    { label: 'Total Managed Stops', value: stats.stops.toString(), desc: stats.progressDesc, icon: 'route', color: '#306D29' },
    { label: 'Completed Deliveries', value: stats.completed.toString(), desc: stats.progressDesc, icon: 'check-circle', color: '#15803d' },
    { label: 'Pending Stops', value: stats.pending.toString(), desc: selectedTimeframe.value === '1d' ? 'In-route / assigned' : 'Historical resolved', icon: 'clock', color: '#b45309' },
    { label: 'SLA Alert Exceptions', value: stats.exceptions.toString(), desc: stats.exceptionDesc, icon: 'exclamation-triangle', color: '#b91c1c' },
    { label: 'Active Driver Fleet', value: stats.activeFleet, desc: stats.utilizationDesc, icon: 'truck', color: '#306D29' },
    { label: 'Operational SLA', value: stats.sla, desc: 'Completed vs Exceptions', icon: 'shield-check', color: '#15803d' }
  ]
})

// SVG Donut Chart Interactive State
const hoveredDonut = ref<string | null>(null)
const donutSlices = computed(() => {
  const stats = timeframeStats.value
  if (selectedTimeframe.value === '1d') {
    return [
      { label: 'Completed', count: stats.completed, percentage: Math.round((stats.completed / stats.stops) * 1000) / 10 || 0, color: '#306D29', hoverColor: '#0D530E', key: 'completed' },
      { label: 'Pending', count: stats.pending, percentage: Math.round((stats.pending / stats.stops) * 1000) / 10 || 0, color: '#eab308', hoverColor: '#d97706', key: 'pending' },
      { label: 'Exceptions', count: stats.exceptions, percentage: Math.round((stats.exceptions / stats.stops) * 1000) / 10 || 0, color: '#b91c1c', hoverColor: '#991b1b', key: 'exceptions' }
    ]
  } else {
    const completedPercent = Math.round((stats.completed / stats.stops) * 1000) / 10 || 0
    const exceptionsPercent = Math.round((stats.exceptions / stats.stops) * 1000) / 10 || 0
    return [
      { label: 'Completed', count: stats.completed, percentage: completedPercent, color: '#306D29', hoverColor: '#0D530E', key: 'completed' },
      { label: 'Exceptions', count: stats.exceptions, percentage: exceptionsPercent, color: '#b91c1c', hoverColor: '#991b1b', key: 'exceptions' }
    ]
  }
})

// Circumference of Donut Chart Circle (r=70 => 2 * pi * 70 = 439.82)
const donutCircumference = 439.82
const donutData = computed(() => {
  let accumulatedPercent = 0
  const totalStops = timeframeStats.value.stops
  return donutSlices.value.map(slice => {
    const strokeDasharray = `${(slice.count / totalStops) * donutCircumference} ${donutCircumference}`
    const strokeDashoffset = -((accumulatedPercent / 100) * donutCircumference)
    accumulatedPercent += slice.percentage
    return {
      ...slice,
      strokeDasharray,
      strokeDashoffset
    }
  })
})

const donutCenterText = computed(() => {
  const stats = timeframeStats.value
  if (hoveredDonut.value === 'completed') {
    return { label: 'Completed', value: `${stats.completed} Stops`, percent: `${Math.round((stats.completed / stats.stops) * 1000) / 10}%` }
  } else if (hoveredDonut.value === 'pending' && selectedTimeframe.value === '1d') {
    return { label: 'Pending', value: `${stats.pending} Stops`, percent: `${Math.round((stats.pending / stats.stops) * 1000) / 10}%` }
  } else if (hoveredDonut.value === 'exceptions') {
    return { label: 'Exceptions', value: `${stats.exceptions} Stops`, percent: `${Math.round((stats.exceptions / stats.stops) * 1000) / 10}%` }
  } else {
    return { label: 'Overall SLA', value: stats.sla, percent: stats.slaRaw >= 90 ? 'High Efficiency' : 'Action Required' }
  }
})

// SVG Line Chart Trend
const hoveredLineIndex = ref<number | null>(null)
const lineData = computed(() => {
  const timeframe = selectedTimeframe.value
  if (timeframe === '1d') {
    return [
      { day: '08:00', completed: 8, target: 10, exceptions: 1 },
      { day: '10:00', completed: 18, target: 20, exceptions: 2 },
      { day: '12:00', completed: 35, target: 35, exceptions: 3 },
      { day: '14:00', completed: 48, target: 45, exceptions: 4 },
      { day: '16:00', completed: 58, target: 55, exceptions: 4 },
      { day: '18:00', completed: 72, target: 70, exceptions: 6 },
      { day: '20:00', completed: 82, target: 75, exceptions: 10 }
    ]
  } else if (timeframe === '30d') {
    return [
      { day: 'Wk 1', completed: 210, target: 220, exceptions: 18 },
      { day: 'Wk 2', completed: 240, target: 220, exceptions: 15 },
      { day: 'Wk 3', completed: 265, target: 250, exceptions: 12 },
      { day: 'Wk 4', completed: 280, target: 260, exceptions: 20 },
      { day: 'Wk 5', completed: 295, target: 280, exceptions: 14 },
      { day: 'Wk 6', completed: 310, target: 300, exceptions: 11 },
      { day: 'Current', completed: 325, target: 300, exceptions: 8 }
    ]
  } else if (timeframe === '60d') {
    return [
      { day: 'Day 10', completed: 410, target: 450, exceptions: 35 },
      { day: 'Day 20', completed: 460, target: 450, exceptions: 32 },
      { day: 'Day 30', completed: 520, target: 500, exceptions: 28 },
      { day: 'Day 40', completed: 540, target: 520, exceptions: 40 },
      { day: 'Day 50', completed: 590, target: 580, exceptions: 31 },
      { day: 'Day 60', completed: 640, target: 600, exceptions: 25 },
      { day: 'Current', completed: 670, target: 620, exceptions: 21 }
    ]
  } else if (timeframe === '90d') {
    return [
      { day: 'Wk 2', completed: 620, target: 650, exceptions: 52 },
      { day: 'Wk 4', completed: 710, target: 700, exceptions: 48 },
      { day: 'Wk 6', completed: 830, target: 800, exceptions: 41 },
      { day: 'Wk 8', completed: 890, target: 850, exceptions: 60 },
      { day: 'Wk 10', completed: 960, target: 920, exceptions: 49 },
      { day: 'Wk 12', completed: 1040, target: 980, exceptions: 38 },
      { day: 'Current', completed: 1120, target: 1050, exceptions: 32 }
    ]
  } else {
    return [
      { day: '2 Mos', completed: 2400, target: 2500, exceptions: 198 },
      { day: '4 Mos', completed: 2850, target: 2700, exceptions: 182 },
      { day: '6 Mos', completed: 3200, target: 3000, exceptions: 155 },
      { day: '8 Mos', completed: 3450, target: 3200, exceptions: 220 },
      { day: '10 Mos', completed: 3800, target: 3600, exceptions: 185 },
      { day: '12 Mos', completed: 4100, target: 3900, exceptions: 152 },
      { day: 'Current', completed: 4350, target: 4100, exceptions: 128 }
    ]
  }
})

// Map coordinates for line chart (viewBox 0 0 500 220)
const lineChartPoints = computed(() => {
  const width = 420
  const height = 140
  const startX = 50
  const startY = 170

  const data = lineData.value
  const maxVal = Math.max(...data.map(d => Math.max(d.completed, d.target))) * 1.15 || 100

  return data.map((d, i) => {
    const x = startX + i * (width / 6)
    const yCompleted = startY - (d.completed / maxVal) * height
    const yTarget = startY - (d.target / maxVal) * height
    return {
      ...d,
      x,
      yCompleted,
      yTarget,
      maxVal
    }
  })
})

const completedPath = computed(() => {
  return lineChartPoints.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yCompleted}`).join(' ')
})

const targetPath = computed(() => {
  return lineChartPoints.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yTarget}`).join(' ')
})

// SVG Bar Chart Driver Workloads (viewBox 0 0 500 220)
const hoveredBarIndex = ref<number | null>(null)
const driverWorkloadData = [
  { name: 'Rajesh Kumar', code: 'Rajesh', assigned: 8, completed: 6, exceptions: 1 },
  { name: 'Amit Sharma', code: 'Amit', assigned: 5, completed: 5, exceptions: 0 },
  { name: 'Priya Patel', code: 'Priya', assigned: 7, completed: 4, exceptions: 1 },
  { name: 'Vikram Singh', code: 'Vikram', assigned: 9, completed: 7, exceptions: 0 },
  { name: 'Karan Johar', code: 'Karan', assigned: 4, completed: 2, exceptions: 0 },
  { name: 'Neha Gupta', code: 'Neha', assigned: 6, completed: 5, exceptions: 1 }
]

// Coordinate mapping for Bar Chart
const barChartGroups = computed(() => {
  const startX = 60
  const width = 410
  const startY = 170
  const barWidth = 16
  const groupSpacing = width / 6

  return driverWorkloadData.map((d, i) => {
    const xGroup = startX + i * groupSpacing
    const hAssigned = (d.assigned / 12) * 140
    const hCompleted = (d.completed / 12) * 140
    
    const yAssigned = startY - hAssigned
    const yCompleted = startY - hCompleted

    return {
      ...d,
      xAssigned: xGroup,
      yAssigned,
      hAssigned,
      xCompleted: xGroup + barWidth + 4,
      yCompleted,
      hCompleted,
      xCenter: xGroup + barWidth,
      efficiency: Math.round((d.completed / d.assigned) * 100)
    }
  })
})

const filteredDrivers = computed(() => {
  return drivers.value.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          d.id.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          d.route.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesStatus = statusFilter.value === 'ALL' || d.status.toUpperCase() === statusFilter.value
    return matchesSearch && matchesStatus
  })
})

const getSlaRate = (d: Driver) => {
  if (d.completed + d.exceptions === 0) return '100%'
  const rate = (d.completed / (d.completed + d.exceptions)) * 100
  return `${Math.round(rate)}%`
}

const getSlaClass = (d: Driver) => {
  if (d.completed + d.exceptions === 0) return 'sla-excellent'
  const rate = (d.completed / (d.completed + d.exceptions)) * 100
  if (rate >= 85) return 'sla-excellent'
  if (rate >= 70) return 'sla-warning'
  return 'sla-danger'
}

// Operational Status Alerts
const alerts = ref([
  { id: 'ALT-01', type: 'exception', timestamp: '10:42 AM', driver: 'Rajesh Kumar (DRV-101)', message: 'Reported delay exception at Stop STP-1002 (Traffic congestion in Connaught Place).', status: 'Unacknowledged' },
  { id: 'ALT-02', type: 'info', timestamp: '10:15 AM', driver: 'Priya Patel (DRV-208)', message: 'Switched operational state to [On Break]. Route BLR-OUT-02 is paused.', status: 'Unacknowledged' },
  { id: 'ALT-03', type: 'warning', timestamp: '09:48 AM', driver: 'System Watchdog', message: 'SLA drop detected on Route BLR-OUT-02. Current completion efficiency is 80.0%.', status: 'Unacknowledged' },
  { id: 'ALT-04', type: 'success', timestamp: '09:00 AM', driver: 'System Planner', message: 'Auto-sequence route generated and pushed to 5 active dispatcher terminals.', status: 'Unacknowledged' }
])

const unacknowledgedCount = computed(() => alerts.value.filter(a => a.status === 'Unacknowledged').length)

const acknowledgeAlert = (id: string) => {
  const alertIndex = alerts.value.findIndex(a => a.id === id)
  if (alertIndex !== -1) {
    alerts.value[alertIndex].status = 'Acknowledged'
  }
}

const acknowledgeAllAlerts = () => {
  alerts.value.forEach(a => {
    a.status = 'Acknowledged'
  })
}

// Dynamic Actionable Suggestions based on active drivers
const suggestions = computed(() => {
  const items = []
  
  // 1. Congestion Window Adjustment
  const highExceptionDriver = drivers.value.find(d => d.exceptions > 0)
  if (highExceptionDriver) {
    items.push({
      type: 'warning',
      title: 'Congestion Window Adjustment',
      text: `High Exception rate on ${highExceptionDriver.route} (${highExceptionDriver.name}). Suggest shifting departure start window by -30 mins to bypass localized bottleneck congestion.`
    })
  } else {
    items.push({
      type: 'info',
      title: 'Congestion Watch',
      text: 'Exception rates currently optimal. Maintain departure schedules to protect current SLA.'
    })
  }

  // 2. SLA Load Balancing Alert
  const lowSlaDriver = drivers.value.find(d => {
    if (d.completed + d.exceptions === 0) return false
    const rate = (d.completed / (d.completed + d.exceptions)) * 100
    return rate < 80
  })
  if (lowSlaDriver) {
    const helper = drivers.value.find(d => d.id !== lowSlaDriver.id && d.status === 'Active' && d.exceptions === 0) || { name: 'Neha Gupta', route: 'BLR-EC-05' }
    items.push({
      type: 'danger',
      title: 'SLA Load Balancing Alert',
      text: `SLA drop below 80% on route ${lowSlaDriver.route} (${lowSlaDriver.name}). Suggest split-assigning next sequence stops to ${helper.name} (${helper.route}) to balance stop count.`
    })
  } else {
    items.push({
      type: 'success',
      title: 'Operational Load Balance',
      text: 'Driver workload distribution is balanced. Current dispatch capacity is within threshold limits.'
    })
  }

  // 3. Resource Optimization
  const activeFleet = drivers.value.filter(d => d.status !== 'Inactive').length
  const totalFleet = drivers.value.length
  const utilization = totalFleet > 0 ? (activeFleet / totalFleet) * 100 : 0
  if (utilization >= 80) {
    items.push({
      type: 'info',
      title: 'High Fleet Utilization',
      text: `Active fleet utilization is at ${Math.round(utilization)}%. Target resource extension: suggest onboarding +1 backup driver for expected volume spikes in next 48h.`
    })
  } else {
    items.push({
      type: 'success',
      title: 'Fleet Capacity Ready',
      text: `Active fleet utilization is at ${Math.round(utilization)}%. Available backup capacity is sufficient for current demand.`
    })
  }

  // 4. Route Cluster Density
  const highStopDriver = drivers.value.reduce((max, d) => (d.assigned > max.assigned ? d : max), { assigned: 0, route: 'N/A' })
  if (highStopDriver.assigned > 6) {
    items.push({
      type: 'warning',
      title: 'Route Cluster Dispersal',
      text: `High stop density (${highStopDriver.assigned} stops) on route ${highStopDriver.route}. Run spatial clustering optimization on terminal to reduce total travel distance by 12%.`
    })
  }

  return items
})

// Exporters
const isExportingCSV = ref(false)
const showExportSuccess = ref(false)

const exportCSV = () => {
  isExportingCSV.value = true
  
  let rowCount = 30
  switch (selectedTimeframe.value) {
    case '1d':
      rowCount = 1
      break
    case '30d':
      rowCount = 30
      break
    case '60d':
      rowCount = 60
      break
    case '90d':
      rowCount = 90
      break
    case '1y':
      rowCount = 365
      break
  }

  const headers = [
    'Date',
    'Total Stops',
    'Completed Deliveries',
    'Exceptions',
    'SLA Rate',
    'Active Drivers',
    'Operating Cost (INR)'
  ]

  const rows: any[] = []
  const today = new Date()

  for (let i = 0; i < rowCount; i++) {
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() - i)
    const dateString = targetDate.toISOString().slice(0, 10)

    const baseStops = drivers.value.reduce((sum, d) => sum + d.assigned, 0) || 39
    
    const randomFactor = 0.85 + Math.random() * 0.35
    const stops = Math.round(baseStops * randomFactor)
    
    const slaRate = Math.round((85 + Math.random() * 13) * 10) / 10
    const completed = Math.round(stops * (slaRate / 100))
    const exceptions = stops - completed
    
    const activeDrivers = Math.min(drivers.value.length || 6, Math.max(3, Math.round(5 + (Math.random() * 2 - 1))))
    
    const operatingCost = activeDrivers * 1800 + completed * 150

    rows.push([
      dateString,
      stops,
      completed,
      exceptions,
      `${slaRate}%`,
      activeDrivers,
      operatingCost
    ])
  }

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `fleet-executive-analytics_${selectedTimeframe.value}_${today.toISOString().slice(0, 10)}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  setTimeout(() => {
    isExportingCSV.value = false
    showExportSuccess.value = true
    setTimeout(() => {
      showExportSuccess.value = false
    }, 3000)
  }, 1000)
}

const triggerPrint = () => {
  window.print()
}
</script>

<template>
  <div class="manager-container">
    <!-- Printable Only Header -->
    <div class="print-banner">
      <h2>LAST-MILE EXECUTIVE FLEET ANALYTICS REPORT</h2>
      <p class="print-meta">
        Generated: {{ new Date().toLocaleString() }} | 
        User: {{ authStore.name }} (ID: {{ authStore.employeeId }} | Role: {{ authStore.role }}) | 
        Hub: {{ authStore.hub }}
      </p>
      <hr />
    </div>

    <!-- Executive Sidebar -->
    <aside class="manager-sidebar">
      <div class="sidebar-brand">
        <div class="logo-box">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="brand-svg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-title">LAST-MILE</span>
          <span class="brand-subtitle">EXECUTIVE CONSOLE</span>
        </div>
      </div>

      <!-- Manager Identity Badge -->
      <div class="manager-identity">
        <div class="identity-avatar">
          <span>{{ authStore.name.slice(0, 2).toUpperCase() }}</span>
        </div>
        <div class="identity-details">
          <h4 class="mgr-name">{{ authStore.name }}</h4>
          <span class="mgr-badge">{{ authStore.employeeId }}</span>
          <span class="mgr-role">{{ authStore.role === 'ADMIN' ? 'System Admin' : 'Fleet Manager' }}</span>
        </div>
      </div>

      <!-- Sidebar Menu Navigation -->
      <nav class="sidebar-nav">
        <button 
          @click="currentView = 'dashboard'" 
          class="nav-btn" 
          :class="{ 'active': currentView === 'dashboard' }"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="nav-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
          </svg>
          SLA Analytics
        </button>

        <button 
          @click="currentView = 'drivers'" 
          class="nav-btn" 
          :class="{ 'active': currentView === 'drivers' }"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="nav-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          Driver Performance
        </button>

        <button 
          @click="currentView = 'alerts'" 
          class="nav-btn alerts-nav-btn" 
          :class="{ 'active': currentView === 'alerts' }"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="nav-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Operations Alerts
          <span v-if="unacknowledgedCount > 0" class="badge-count">{{ unacknowledgedCount }}</span>
        </button>
      </nav>

      <!-- Sidebar Footer Action (Logout) -->
      <div class="sidebar-footer">
        <div class="hub-info">
          <span class="hub-label">ACTIVE OPERATIONS HUB</span>
          <span class="hub-value">{{ authStore.hub }}</span>
        </div>
        
        <button @click="handleLogout" class="btn-logout">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="logout-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Terminate Session
        </button>
      </div>
    </aside>

    <!-- Main Dashboard Area -->
    <main class="manager-main">
      <!-- Top Action Bar -->
      <header class="main-header">
        <div class="header-titles">
          <h1>Last-Mile Executive Dashboard</h1>
          <p>Analytical operations overview for terminal <strong>{{ authStore.hub }}</strong></p>
        </div>

        <div class="header-actions">
          <button @click="triggerPrint" class="btn-action btn-print">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="btn-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0a2.25 2.25 0 0 1-2.247 2.114H8.59Guidem2.25 2.25 0 0 1-2.247-2.114L17.66 18zm0 0c-.043-.213-.06-.431-.06-.65V10.5a2.25 2.25 0 0 0-2.25-2.25h-6.75A2.25 2.25 0 0 0 6.3 10.5v6.85c0 .219-.017.437-.06.65M16.5 10.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
            </svg>
            Export PDF / Print
          </button>
          
          <button @click="exportCSV" class="btn-action btn-csv" :disabled="isExportingCSV">
            <span v-if="isExportingCSV" class="loading-state">
              <span class="spinner-small"></span>
              Exporting...
            </span>
            <span v-else>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="btn-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV Data
            </span>
          </button>
        </div>
      </header>

      <!-- Toast Export Feedback -->
      <div v-if="showExportSuccess" class="toast-success">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="toast-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
        <span>CSV Report successfully compiled and downloaded!</span>
      </div>

      <!-- VIEW 1: DASHBOARD SLA ANALYTICS -->
      <div v-if="currentView === 'dashboard'" class="dashboard-view-content">
        <!-- Timeframe Selector Tabs -->
        <div class="timeframe-selector-container">
          <div class="timeframe-buttons">
            <button 
              v-for="tf in ['1d', '30d', '60d', '90d', '1y']" 
              :key="tf"
              @click="selectedTimeframe = tf"
              class="timeframe-btn"
              :class="{ 'active': selectedTimeframe === tf }"
            >
              {{ tf === '1d' ? '1 Day' : tf === '30d' ? '30 Days' : tf === '60d' ? '60 Days' : tf === '90d' ? '90 Days' : '1 Year' }}
            </button>
          </div>
          <span class="timeframe-meta">Cumulative Report Status: <strong>Ready</strong></span>
        </div>
        <!-- KPI Scorecard Cards Grid -->
        <section class="kpi-grid">
          <div v-for="(kpi, i) in kpis" :key="i" class="kpi-card" :style="{ '--kpi-border': kpi.color }">
            <div class="kpi-header">
              <span class="kpi-label">{{ kpi.label }}</span>
              <span class="kpi-icon-wrapper" :style="{ backgroundColor: kpi.color + '15', color: kpi.color }">
                <!-- Inline SVG Map Icons based on label -->
                <svg v-if="kpi.icon === 'route'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.446 6.002-3.478a.75.75 0 0 0 0-1.302L15.503 9.44a.75.75 0 0 0-.503-.19H9.003c-.178 0-.353.064-.492.182L2.502 14.922a.75.75 0 0 0 0 1.156l6.009 5.067a.75.75 0 0 0 .984 0l6.008-5.067a.75.75 0 0 0 0-1.156z" /></svg>
                <svg v-else-if="kpi.icon === 'check-circle'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                <svg v-else-if="kpi.icon === 'clock'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                <svg v-else-if="kpi.icon === 'exclamation-triangle'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                <svg v-else-if="kpi.icon === 'truck'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125a1.125 1.125 0 0 0 1.125-1.125V9.75M3.75 14.25h12m0 0V9.75m0 4.5h3.75M12 4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V9.75H12V4.875z" /></svg>
                <svg v-else-if="kpi.icon === 'shield-check'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.746 3.746 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12z" /></svg>
              </span>
            </div>
            <div class="kpi-body">
              <span class="kpi-value">{{ kpi.value }}</span>
              <span class="kpi-desc">{{ kpi.desc }}</span>
            </div>
          </div>
        </section>

        <!-- Charts Grid (Interactive Custom SVGs) -->
        <section class="charts-grid">
          <!-- Chart 1: Donut Chart SLA Distribution -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Delivery Status Distribution</h3>
              <p>Hover segments to review exact figures</p>
            </div>
            <div class="chart-content donut-layout">
              <div class="donut-svg-wrapper">
                <svg viewBox="0 0 200 200" class="donut-chart-svg">
                  <!-- Base Background circle -->
                  <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(231, 225, 177, 0.4)" stroke-width="14" />
                  
                  <!-- Segment Slices -->
                  <circle 
                    v-for="slice in donutData" 
                    :key="slice.key"
                    cx="100" 
                    cy="100" 
                    r="70" 
                    fill="none" 
                    :stroke="slice.color" 
                    :stroke-width="hoveredDonut === slice.key ? 18 : 14"
                    :stroke-dasharray="slice.strokeDasharray" 
                    :stroke-dashoffset="slice.strokeDashoffset"
                    transform="rotate(-90 100 100)"
                    stroke-linecap="round"
                    class="donut-slice"
                    @mouseenter="hoveredDonut = slice.key"
                    @mouseleave="hoveredDonut = null"
                  />
                </svg>
                
                <!-- Inner Text Overlay -->
                <div class="donut-text-overlay">
                  <span class="donut-text-label">{{ donutCenterText.label }}</span>
                  <span class="donut-text-value">{{ donutCenterText.value }}</span>
                  <span class="donut-text-percent">{{ donutCenterText.percent }}</span>
                </div>
              </div>
              
              <div class="donut-legend">
                <div 
                  v-for="slice in donutSlices" 
                  :key="slice.key" 
                  class="legend-item"
                  :class="{ 'dimmed': hoveredDonut && hoveredDonut !== slice.key }"
                  @mouseenter="hoveredDonut = slice.key"
                  @mouseleave="hoveredDonut = null"
                >
                  <span class="legend-color" :style="{ backgroundColor: slice.color }"></span>
                  <span class="legend-label">{{ slice.label }}</span>
                  <span class="legend-count">{{ slice.count }} stops</span>
                  <span class="legend-percent">{{ slice.percentage }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Chart 2: SLA Completion Trend (Line) -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>SLA Trend Line</h3>
              <p>Completion volumes plotted against operational targets</p>
            </div>
            <div class="chart-content line-chart-container">
              <svg viewBox="0 0 500 220" class="line-chart-svg">
                <!-- Grid lines -->
                <line x1="50" y1="30" x2="470" y2="30" stroke="#E7E1B1" stroke-dasharray="4,4" />
                <line x1="50" y1="65" x2="470" y2="65" stroke="#E7E1B1" stroke-dasharray="4,4" />
                <line x1="50" y1="100" x2="470" y2="100" stroke="#E7E1B1" stroke-dasharray="4,4" />
                <line x1="50" y1="135" x2="470" y2="135" stroke="#E7E1B1" stroke-dasharray="4,4" />
                <line x1="50" y1="170" x2="470" y2="170" stroke="#306D29" stroke-width="1.5" />
                
                <!-- Y-Axis labels -->
                <text x="40" y="34" fill="#306D29" font-size="10" text-anchor="end">{{ lineChartPoints[0] ? Math.round(lineChartPoints[0].maxVal) : 100 }}</text>
                <text x="40" y="69" fill="#306D29" font-size="10" text-anchor="end">{{ lineChartPoints[0] ? Math.round(lineChartPoints[0].maxVal * 0.75) : 75 }}</text>
                <text x="40" y="104" fill="#306D29" font-size="10" text-anchor="end">{{ lineChartPoints[0] ? Math.round(lineChartPoints[0].maxVal * 0.5) : 50 }}</text>
                <text x="40" y="139" fill="#306D29" font-size="10" text-anchor="end">{{ lineChartPoints[0] ? Math.round(lineChartPoints[0].maxVal * 0.25) : 25 }}</text>
                <text x="40" y="174" fill="#306D29" font-size="10" text-anchor="end">0</text>
                
                <!-- X-Axis labels -->
                <text 
                  v-for="(p, idx) in lineChartPoints" 
                  :key="'lbl-'+idx" 
                  :x="p.x" 
                  y="192" 
                  fill="#306D29" 
                  font-size="10" 
                  text-anchor="middle"
                >
                  {{ p.day }}
                </text>

                <!-- Target Path -->
                <path :d="targetPath" fill="none" stroke="#7a826e" stroke-width="2" stroke-dasharray="5,3" opacity="0.6" />
                
                <!-- Completed Path -->
                <path :d="completedPath" fill="none" stroke="#0D530E" stroke-width="3.5" stroke-linecap="round" />

                <!-- Vertical guide line on hover -->
                <line 
                  v-if="hoveredLineIndex !== null"
                  :x1="lineChartPoints[hoveredLineIndex].x" 
                  y1="30" 
                  :x2="lineChartPoints[hoveredLineIndex].x" 
                  y2="170" 
                  stroke="rgba(48, 109, 41, 0.4)" 
                  stroke-width="1.5" 
                  stroke-dasharray="3,3" 
                />

                <!-- Node Points -->
                <g v-for="(p, idx) in lineChartPoints" :key="'pts-'+idx">
                  <!-- Invisible wider hit area for hover -->
                  <circle 
                    :cx="p.x" 
                    cy="100" 
                    r="25" 
                    fill="transparent" 
                    style="cursor: pointer;"
                    @mouseenter="hoveredLineIndex = idx"
                    @mouseleave="hoveredLineIndex = null"
                  />
                  <!-- Target node -->
                  <circle 
                    :cx="p.x" 
                    :cy="p.yTarget" 
                    r="4" 
                    fill="#ffffff" 
                    stroke="#7a826e" 
                    stroke-width="1.5" 
                  />
                  <!-- Completed node -->
                  <circle 
                    :cx="p.x" 
                    :cy="p.yCompleted" 
                    :r="hoveredLineIndex === idx ? 7 : 4.5" 
                    fill="#0D530E" 
                    stroke="#ffffff" 
                    :stroke-width="hoveredLineIndex === idx ? 2.5 : 1.5"
                    style="transition: all 0.2s;"
                  />
                </g>
              </svg>

              <!-- Absolute Tooltip Overlay -->
              <div v-if="hoveredLineIndex !== null" class="chart-tooltip line-tooltip">
                <span class="tooltip-title">{{ lineData[hoveredLineIndex].day }} Operations</span>
                <div class="tooltip-row">
                  <span class="bullet" style="background-color: #0D530E"></span>
                  <span class="lbl">Completed:</span>
                  <strong class="val">{{ lineData[hoveredLineIndex].completed }} stops</strong>
                </div>
                <div class="tooltip-row">
                  <span class="bullet" style="background-color: #7a826e"></span>
                  <span class="lbl">SLA Target:</span>
                  <strong class="val">{{ lineData[hoveredLineIndex].target }} stops</strong>
                </div>
                <div class="tooltip-row">
                  <span class="bullet" style="background-color: #b91c1c"></span>
                  <span class="lbl">Exceptions:</span>
                  <strong class="val">{{ lineData[hoveredLineIndex].exceptions }}</strong>
                </div>
                <div class="tooltip-footer">
                  SLA Target Met: 
                  <span :style="{ color: lineData[hoveredLineIndex].completed >= lineData[hoveredLineIndex].target ? '#15803d' : '#b45309' }">
                    {{ lineData[hoveredLineIndex].completed >= lineData[hoveredLineIndex].target ? 'EXCEEDED' : 'WARNING' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Chart 3: Driver Workload Utilization (Bar) -->
          <div class="chart-card workload-card">
            <div class="chart-header">
              <h3>Driver Workload Utilization</h3>
              <p>Stops completed versus overall assigned load</p>
            </div>
            <div class="chart-content bar-chart-container">
              <svg viewBox="0 0 500 220" class="bar-chart-svg">
                <!-- Grid lines -->
                <line x1="50" y1="30" x2="470" y2="30" stroke="#E7E1B1" stroke-dasharray="4,4" />
                <line x1="50" y1="76" x2="470" y2="76" stroke="#E7E1B1" stroke-dasharray="4,4" />
                <line x1="50" y1="123" x2="470" y2="123" stroke="#E7E1B1" stroke-dasharray="4,4" />
                <line x1="50" y1="170" x2="470" y2="170" stroke="#306D29" stroke-width="1.5" />
                
                <!-- Y-Axis labels -->
                <text x="40" y="34" fill="#306D29" font-size="10" text-anchor="end">12</text>
                <text x="40" y="80" fill="#306D29" font-size="10" text-anchor="end">8</text>
                <text x="40" y="127" fill="#306D29" font-size="10" text-anchor="end">4</text>
                <text x="40" y="174" fill="#306D29" font-size="10" text-anchor="end">0</text>
                
                <!-- Bars representation -->
                <g 
                  v-for="(grp, idx) in barChartGroups" 
                  :key="'bar-'+idx"
                  @mouseenter="hoveredBarIndex = idx"
                  @mouseleave="hoveredBarIndex = null"
                  style="cursor: pointer;"
                >
                  <!-- Assigned Bar -->
                  <rect 
                    :x="grp.xAssigned" 
                    :y="grp.yAssigned" 
                    width="14" 
                    :height="grp.hAssigned" 
                    fill="#E7E1B1" 
                    rx="2"
                    :opacity="hoveredBarIndex === idx ? 1.0 : 0.85"
                    style="transition: all 0.2s;"
                  />
                  <!-- Completed Bar -->
                  <rect 
                    :x="grp.xCompleted" 
                    :y="grp.yCompleted" 
                    width="14" 
                    :height="grp.hCompleted" 
                    fill="#306D29" 
                    rx="2"
                    :opacity="hoveredBarIndex === idx ? 1.0 : 0.85"
                    style="transition: all 0.2s;"
                  />
                  
                  <!-- Hover Background Group Highlighter -->
                  <rect
                    :x="grp.xAssigned - 6"
                    y="30"
                    width="46"
                    height="140"
                    fill="rgba(48, 109, 41, 0.08)"
                    :opacity="hoveredBarIndex === idx ? 1 : 0"
                    style="pointer-events: none; transition: opacity 0.2s;"
                  />

                  <!-- X-Axis label -->
                  <text 
                    :x="grp.xCenter" 
                    y="192" 
                    fill="#306D29" 
                    font-size="9" 
                    text-anchor="middle"
                    :font-weight="hoveredBarIndex === idx ? 'bold' : 'normal'"
                  >
                    {{ grp.code }}
                  </text>
                </g>
              </svg>

              <!-- Absolute Tooltip Overlay -->
              <div v-if="hoveredBarIndex !== null" class="chart-tooltip bar-tooltip">
                <span class="tooltip-title">{{ barChartGroups[hoveredBarIndex].name }}</span>
                <div class="tooltip-row">
                  <span class="bullet" style="background-color: #E7E1B1"></span>
                  <span class="lbl">Assigned Stops:</span>
                  <strong class="val">{{ barChartGroups[hoveredBarIndex].assigned }}</strong>
                </div>
                <div class="tooltip-row">
                  <span class="bullet" style="background-color: #306D29"></span>
                  <span class="lbl">Completed:</span>
                  <strong class="val">{{ barChartGroups[hoveredBarIndex].completed }}</strong>
                </div>
                <div class="tooltip-row">
                  <span class="bullet" style="background-color: #b91c1c"></span>
                  <span class="lbl">Exceptions:</span>
                  <strong class="val">{{ barChartGroups[hoveredBarIndex].exceptions }}</strong>
                </div>
                <div class="tooltip-footer">
                  Completion Efficiency: 
                  <span style="color: #15803d">{{ barChartGroups[hoveredBarIndex].efficiency }}%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- SLA Insights & Actionable Suggestions Panel -->
        <section class="suggestions-section">
          <div class="dashboard-card suggestions-card">
            <div class="suggestions-header">
              <div class="title-with-badge">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="suggestions-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 21m0 0l-.813-5.096L3 15.187m6 .717L15 15.187m-5.465-4.757L12 3m0 0l2.465 7.43m-2.465-7.43L6 9.43m6-6.43L18 9.43" />
                </svg>
                <h3>SLA Insights & Actionable Suggestions</h3>
              </div>
              <span class="live-status-pill">RECOMMENDATIONS ACTIVE</span>
            </div>
            
            <div class="suggestions-grid">
              <div v-for="(item, idx) in suggestions" :key="idx" class="suggestion-item-box" :class="item.type">
                <div class="item-header">
                  <div class="item-title-group">
                    <span class="status-dot"></span>
                    <h4>{{ item.title }}</h4>
                  </div>
                  <span class="item-badge">{{ item.type.toUpperCase() }}</span>
                </div>
                <p class="item-text">{{ item.text }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Executive Summary Cards -->
        <section class="executive-summary-section">
          <div class="dashboard-card summary-card">
            <h3>Operations Digest & Roster Overview</h3>
            <p>
              The executive terminal has logged <strong>{{ timeframeStats.stops }} deliveries</strong> with an average completion rate of <strong>{{ Math.round(timeframeStats.completed / timeframeStats.stops * 100) }}%</strong> across active runs. 
              <strong>{{ timeframeStats.sla }}</strong> of all resolved stops met full operational SLA metrics. There are currently <strong>{{ timeframeStats.exceptions }} priority exceptions</strong> 
              requiring dispatcher attention or supervisor adjustment.
            </p>
            <div class="digest-actions">
              <button @click="currentView = 'drivers'" class="btn-card-link">
                View Full Performance Table
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
              </button>
              <button @click="currentView = 'alerts'" class="btn-card-link text-warning">
                Review Operations Alerts ({{ unacknowledgedCount }} unresolved)
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
              </button>
            </div>
          </div>
        </section>
      </div>

      <!-- VIEW 2: DETAILED DRIVER ROSTER -->
      <div v-else-if="currentView === 'drivers'" class="drivers-view-content">
        <div class="dashboard-card table-card">
          <div class="card-header-with-filters">
            <div class="table-title">
              <h3>Active Driver Rosters & SLA Performance</h3>
              <p>Review real-time completion workloads and compliance details.</p>
            </div>
            
            <div class="table-filters">
              <div class="search-input-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="search-svg">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                </svg>
                <input 
                  type="text" 
                  v-model="searchQuery" 
                  placeholder="Search by ID, name, route..."
                  class="filter-search"
                />
              </div>

              <select v-model="statusFilter" class="filter-select">
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON BREAK">On Break</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <!-- Roster Grid/Table -->
          <div class="table-responsive">
            <table class="executive-table">
              <thead>
                <tr>
                  <th>Driver Details</th>
                  <th>Assigned Route</th>
                  <th class="text-center">Assigned Stops</th>
                  <th class="text-center">Completed</th>
                  <th class="text-center">Pending</th>
                  <th class="text-center">Exceptions</th>
                  <th class="text-center">SLA Met</th>
                  <th>Roster Status</th>
                  <th>Direct Contact</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in filteredDrivers" :key="d.id" class="table-row">
                  <td class="driver-profile-cell">
                    <div class="table-avatar">
                      <span>{{ d.name.slice(0, 2).toUpperCase() }}</span>
                    </div>
                    <div>
                      <div class="d-name">{{ d.name }}</div>
                      <div class="d-id">{{ d.id }}</div>
                    </div>
                  </td>
                  <td>
                    <span class="route-badge">{{ d.route }}</span>
                  </td>
                  <td class="text-center font-bold text-slate-100">{{ d.assigned }}</td>
                  <td class="text-center text-success font-bold">{{ d.completed }}</td>
                  <td class="text-center text-warning">{{ d.pending }}</td>
                  <td class="text-center text-danger font-bold">{{ d.exceptions }}</td>
                  <td class="text-center">
                    <span class="sla-pill" :class="getSlaClass(d)">
                      {{ getSlaRate(d) }}
                    </span>
                  </td>
                  <td>
                    <span class="status-indicator" :class="d.status.toLowerCase().replace(' ', '-')">
                      {{ d.status }}
                    </span>
                  </td>
                  <td class="phone-cell">
                    <span class="phone-number">{{ d.phone }}</span>
                  </td>
                </tr>
                <tr v-if="filteredDrivers.length === 0">
                  <td colspan="9" class="no-records-cell">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="empty-icon">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    <span>No drivers match the current filters.</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- VIEW 3: OPERATIONS ALERTS -->
      <div v-else-if="currentView === 'alerts'" class="alerts-view-content">
        <div class="dashboard-card alert-panel-card">
          <div class="alert-panel-header">
            <div>
              <h3>Real-Time Operations Incident Feed</h3>
              <p>Acknowledge and track critical dispatcher warnings and SLA exceptions.</p>
            </div>
            <button 
              v-if="unacknowledgedCount > 0" 
              @click="acknowledgeAllAlerts" 
              class="btn-acknowledge-all"
            >
              Acknowledge All ({{ unacknowledgedCount }})
            </button>
          </div>

          <div class="alerts-list">
            <div 
              v-for="alert in alerts" 
              :key="alert.id" 
              class="alert-item"
              :class="[alert.type, alert.status.toLowerCase()]"
            >
              <div class="alert-marker"></div>
              
              <div class="alert-body">
                <div class="alert-meta">
                  <span class="alert-tag" :class="alert.type">{{ alert.type.toUpperCase() }}</span>
                  <span class="alert-time">{{ alert.timestamp }}</span>
                  <span class="alert-target">• {{ alert.driver }}</span>
                </div>
                <p class="alert-message">{{ alert.message }}</p>
              </div>

              <div class="alert-actions">
                <span v-if="alert.status === 'Acknowledged'" class="status-ack">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  Acknowledged
                </span>
                <button 
                  v-else 
                  @click="acknowledgeAlert(alert.id)" 
                  class="btn-ack"
                >
                  Mark Acknowledged
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* GENERAL THEMING: Premium Green/Cream Theme */
.manager-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  background-color: #FBF5DD;
  color: #2c3323;
  font-family: 'Outfit', 'Inter', system-ui, sans-serif;
  box-sizing: border-box;
}

/* Print Specific Banner (Hidden on Screen) */
.print-banner {
  display: none;
}

/* SIDEBAR STYLING */
.manager-sidebar {
  width: 260px;
  background-color: #0D530E; /* Dark Green */
  border-right: 1px solid #E7E1B1;
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
  background-color: #E7E1B1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0D530E;
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
  color: #FBF5DD;
}

.brand-subtitle {
  font-size: 9px;
  letter-spacing: 0.5px;
  color: #E7E1B1;
  font-weight: 700;
}

/* Manager Identity Profile card */
.manager-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: rgba(48, 109, 41, 0.3); /* Medium Green Alpha */
  border: 1px solid rgba(231, 225, 177, 0.2);
  border-radius: 12px;
  margin-bottom: 28px;
}

.identity-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #E7E1B1;
  color: #0D530E;
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

.mgr-name {
  margin: 0;
  font-size: 13.5px;
  font-weight: 700;
  color: #FBF5DD;
}

.mgr-badge {
  font-size: 10.5px;
  color: #E7E1B1;
  font-family: monospace;
}

.mgr-role {
  font-size: 10px;
  color: #E7E1B1;
  font-weight: 600;
  text-transform: uppercase;
}

/* Sidebar Nav Navigation */
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
  color: #E7E1B1;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  transition: all 0.2s;
}

.nav-btn:hover {
  background-color: rgba(231, 225, 177, 0.1);
  color: #FBF5DD;
}

.nav-btn.active {
  background-color: rgba(255, 255, 255, 0.1);
  color: #FBF5DD;
  border-left: 3px solid #E7E1B1;
  padding-left: 11px;
}

.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.alerts-nav-btn {
  position: relative;
}

.badge-count {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background-color: #b91c1c;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 20px;
}

/* Sidebar Footer */
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
  color: #E7E1B1;
  font-weight: 700;
  letter-spacing: 0.5px;
  opacity: 0.8;
}

.hub-value {
  font-size: 11.5px;
  color: #FBF5DD;
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

/* MAIN CONTENT WORKSPACE */
.manager-main {
  flex: 1;
  margin-left: 260px; /* offset sidebar */
  padding: 40px;
  box-sizing: border-box;
}

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  border-bottom: 1px solid #E7E1B1;
  padding-bottom: 20px;
}

.header-titles h1 {
  font-size: 28px;
  font-weight: 800;
  color: #0D530E;
  margin: 0 0 6px 0;
  letter-spacing: -0.5px;
}

.header-titles p {
  color: #306D29;
  font-size: 14px;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn-action {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.btn-print {
  background-color: #ffffff;
  color: #0D530E;
  border: 1px solid #E7E1B1;
}

.btn-print:hover {
  background-color: #E7E1B1;
  border-color: #306D29;
}

.btn-csv {
  background-color: #306D29;
  color: #FBF5DD;
  border: none;
}

.btn-csv:hover:not(:disabled) {
  background-color: #0D530E;
}

.btn-csv:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

/* Toast export feedback */
.toast-success {
  background-color: rgba(21, 128, 61, 0.1);
  border: 1px solid rgba(21, 128, 61, 0.2);
  color: #15803d;
  padding: 12px 18px;
  border-radius: 8px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  animation: slideIn 0.3s ease-out;
}

.toast-icon {
  width: 20px;
  height: 20px;
}

@keyframes slideIn {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Timeframe Selector tabs */
.timeframe-selector-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  background-color: rgba(231, 225, 177, 0.25);
  border: 1px solid #E7E1B1;
  padding: 10px 16px;
  border-radius: 12px;
}

.timeframe-buttons {
  display: flex;
  gap: 8px;
}

.timeframe-btn {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid #E7E1B1;
  background-color: #ffffff;
  color: #0D530E;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.timeframe-btn:hover {
  background-color: #E7E1B1;
}

.timeframe-btn.active {
  background-color: #306D29;
  color: #FBF5DD;
  border-color: #306D29;
}

.timeframe-meta {
  font-size: 12px;
  color: #306D29;
  font-weight: 500;
}

/* KPI Scorecard Grid layout */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.kpi-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #E7E1B1;
  border-top: 3.5px solid var(--kpi-border, #306D29);
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px -6px rgba(13, 83, 14, 0.15);
}

.kpi-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.kpi-label {
  font-size: 12.5px;
  font-weight: 700;
  color: #306D29;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kpi-icon-wrapper {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kpi-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-value {
  font-size: 26px;
  font-weight: 800;
  color: #0D530E;
  line-height: 1;
}

.kpi-desc {
  font-size: 12px;
  color: #7a826e;
}

/* CHARTS SECTION */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.chart-card {
  background-color: #ffffff;
  border: 1px solid #E7E1B1;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.chart-header {
  margin-bottom: 20px;
}

.chart-header h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 700;
  color: #0D530E;
}

.chart-header p {
  margin: 0;
  font-size: 12px;
  color: #7a826e;
}

.chart-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

/* SVG Donut Layout */
.donut-layout {
  flex-direction: row;
  justify-content: space-around;
  gap: 16px;
}

.donut-svg-wrapper {
  position: relative;
  width: 150px;
  height: 150px;
  flex-shrink: 0;
}

.donut-chart-svg {
  width: 100%;
  height: 100%;
}

.donut-slice {
  cursor: pointer;
  transition: stroke-width 0.2s, filter 0.2s;
}

.donut-slice:hover {
  filter: drop-shadow(0 0 4px currentColor);
}

.donut-text-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  pointer-events: none;
  text-align: center;
}

.donut-text-label {
  font-size: 9.5px;
  color: #7a826e;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.donut-text-value {
  font-size: 17px;
  font-weight: 800;
  color: #0D530E;
  margin: 1px 0;
}

.donut-text-percent {
  font-size: 11px;
  color: #306D29;
  font-weight: 600;
}

.donut-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 6px;
  background-color: rgba(48, 109, 41, 0.05);
  border: 1px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
}

.legend-item:hover {
  background-color: rgba(48, 109, 41, 0.1);
  border-color: #E7E1B1;
}

.legend-item.dimmed {
  opacity: 0.4;
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-label {
  font-size: 12px;
  font-weight: 600;
  color: #0D530E;
}

.legend-count {
  font-size: 11.5px;
  color: #7a826e;
  text-align: right;
}

.legend-percent {
  font-size: 11.5px;
  color: #306D29;
  font-weight: 700;
  text-align: right;
  min-width: 42px;
}

/* Line Chart & Bar Chart layout */
.line-chart-container, .bar-chart-container {
  width: 100%;
  height: auto;
  display: block;
}

.line-chart-svg, .bar-chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

/* Absolute Chart Tooltips */
.chart-tooltip {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: #ffffff;
  border: 1px solid #E7E1B1;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 11.5px;
  box-shadow: 0 4px 12px rgba(13, 83, 14, 0.1);
  pointer-events: none;
  min-width: 150px;
  animation: fadeIn 0.15s ease-out;
  z-index: 10;
}

.tooltip-title {
  display: block;
  font-weight: 700;
  color: #0D530E;
  margin-bottom: 6px;
  border-bottom: 1px solid #E7E1B1;
  padding-bottom: 4px;
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  color: #7a826e;
}

.tooltip-row .bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.tooltip-row .lbl {
  flex: 1;
}

.tooltip-row .val {
  color: #0D530E;
}

.tooltip-footer {
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px solid #E7E1B1;
  font-size: 10px;
  font-weight: 600;
  color: #7a826e;
  display: flex;
  justify-content: space-between;
}

/* Suggestions Section Styling */
.suggestions-section {
  margin-bottom: 32px;
}

.suggestions-card {
  background-color: #0D530E; /* Dark Green background for Suggestions widget */
  border: 1px solid #E7E1B1;
  color: #FBF5DD;
  padding: 24px;
}

.suggestions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(231, 225, 177, 0.25);
  padding-bottom: 14px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-with-badge h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
}

.suggestions-icon {
  width: 22px;
  height: 22px;
  color: #E7E1B1;
}

.live-status-pill {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  background-color: rgba(231, 225, 177, 0.15);
  color: #E7E1B1;
  padding: 4px 8px;
  border-radius: 6px;
}

.suggestions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.suggestion-item-box {
  background-color: rgba(48, 109, 41, 0.4);
  border: 1px solid rgba(231, 225, 177, 0.15);
  border-radius: 10px;
  padding: 16px;
  transition: transform 0.2s;
}

.suggestion-item-box:hover {
  transform: translateY(-2px);
}

.suggestion-item-box.warning {
  border-left: 4px solid #eab308;
}

.suggestion-item-box.danger {
  border-left: 4px solid #b91c1c;
}

.suggestion-item-box.success {
  border-left: 4px solid #15803d;
}

.suggestion-item-box.info {
  border-left: 4px solid #0284c7;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #E7E1B1;
}

.warning .status-dot { background-color: #eab308; }
.danger .status-dot { background-color: #b91c1c; }
.success .status-dot { background-color: #15803d; }
.info .status-dot { background-color: #0284c7; }

.item-title-group h4 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 700;
  color: #ffffff;
}

.item-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.05);
}

.warning .item-badge { color: #fef08a; }
.danger .item-badge { color: #fca5a5; }
.success .item-badge { color: #86efac; }
.info .item-badge { color: #bae6fd; }

.item-text {
  margin: 0;
  font-size: 12.5px;
  color: #E7E1B1;
  line-height: 1.5;
}

/* Executive summary panel */
.executive-summary-section {
  width: 100%;
}

.dashboard-card {
  background-color: #ffffff;
  border: 1px solid #E7E1B1;
  border-radius: 12px;
  padding: 24px;
}

.summary-card h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 700;
  color: #0D530E;
}

.summary-card p {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: #2c3323;
  line-height: 1.6;
}

.digest-actions {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.btn-card-link {
  background: none;
  border: none;
  color: #306D29;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  transition: color 0.2s;
}

.btn-card-link:hover {
  color: #0D530E;
  text-decoration: underline;
}

.btn-card-link.text-warning {
  color: #b45309;
}

.btn-card-link.text-warning:hover {
  color: #78350f;
}

/* ROSTER TABLE STYLING */
.table-card {
  display: flex;
  flex-direction: column;
}

.card-header-with-filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
  border-bottom: 1px solid #E7E1B1;
  padding-bottom: 16px;
}

.table-title h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  color: #0D530E;
}

.table-title p {
  margin: 0;
  font-size: 12.5px;
  color: #7a826e;
}

.table-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-svg {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: #7a826e;
}

.filter-search {
  padding: 8px 12px 8px 36px;
  border-radius: 8px;
  border: 1.5px solid #E7E1B1;
  background-color: #ffffff;
  color: #0D530E;
  font-size: 13.5px;
  outline: none;
  transition: all 0.2s;
  min-width: 220px;
}

.filter-search:focus {
  border-color: #306D29;
  box-shadow: 0 0 0 3px rgba(48, 109, 41, 0.15);
}

.filter-select {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1.5px solid #E7E1B1;
  background-color: #ffffff;
  color: #0D530E;
  font-size: 13.5px;
  outline: none;
  cursor: pointer;
  min-width: 140px;
}

.filter-select:focus {
  border-color: #306D29;
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
}

.executive-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13.5px;
}

.executive-table th {
  padding: 14px 16px;
  color: #306D29;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 11.5px;
  border-bottom: 1.5px solid #E7E1B1;
}

.table-row {
  border-bottom: 1px solid rgba(231, 225, 177, 0.4);
  transition: background-color 0.2s;
}

.table-row:hover {
  background-color: rgba(231, 225, 177, 0.15);
}

.executive-table td {
  padding: 14px 16px;
  vertical-align: middle;
}

.driver-profile-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #E7E1B1;
  color: #0D530E;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 11.5px;
  border: 1.5px solid rgba(48, 109, 41, 0.3);
}

.d-name {
  font-weight: 600;
  color: #0D530E;
}

.d-id {
  font-size: 11px;
  color: #7a826e;
  font-family: monospace;
}

.route-badge {
  background-color: rgba(231, 225, 177, 0.3);
  border: 1px solid rgba(48, 109, 41, 0.15);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-family: monospace;
  color: #0D530E;
}

.sla-pill {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  display: inline-block;
  text-align: center;
  min-width: 44px;
}

.sla-excellent {
  background-color: rgba(21, 128, 61, 0.1);
  color: #15803d;
}

.sla-warning {
  background-color: rgba(180, 83, 9, 0.1);
  color: #b45309;
}

.sla-danger {
  background-color: rgba(185, 28, 28, 0.1);
  color: #b91c1c;
}

.status-indicator {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 20px;
  display: inline-block;
  text-transform: uppercase;
}

.status-indicator.active {
  background-color: rgba(48, 109, 41, 0.1);
  color: #306D29;
}

.status-indicator.completed {
  background-color: rgba(21, 128, 61, 0.1);
  color: #15803d;
}

.status-indicator.on-break {
  background-color: rgba(180, 83, 9, 0.1);
  color: #b45309;
}

.status-indicator.inactive {
  background-color: rgba(122, 130, 110, 0.1);
  color: #7a826e;
}

.phone-number {
  color: #7a826e;
  font-size: 12px;
}

.no-records-cell {
  text-align: center;
  padding: 48px !important;
  color: #7a826e;
  font-size: 14px;
}

.empty-icon {
  width: 36px;
  height: 36px;
  color: #E7E1B1;
  margin: 0 auto 12px auto;
  display: block;
}

/* ALERTS FEED VIEW */
.alert-panel-card {
  display: flex;
  flex-direction: column;
}

.alert-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #E7E1B1;
  padding-bottom: 18px;
  margin-bottom: 20px;
}

.alert-panel-header h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  color: #0D530E;
}

.alert-panel-header p {
  margin: 0;
  font-size: 12.5px;
  color: #7a826e;
}

.btn-acknowledge-all {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #E7E1B1;
  background-color: #ffffff;
  color: #0D530E;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-acknowledge-all:hover {
  background-color: #E7E1B1;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-radius: 10px;
  background-color: #ffffff;
  border: 1px solid #E7E1B1;
  position: relative;
  overflow: hidden;
  transition: opacity 0.3s, background-color 0.2s;
}

.alert-item.acknowledged {
  opacity: 0.55;
}

.alert-marker {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4.5px;
  background-color: #7a826e;
}

.alert-item.exception .alert-marker { background-color: #b91c1c; }
.alert-item.warning .alert-marker { background-color: #b45309; }
.alert-item.success .alert-marker { background-color: #15803d; }
.alert-item.info .alert-marker { background-color: #0284c7; }

.alert-body {
  flex: 1;
  padding-right: 20px;
}

.alert-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.alert-tag {
  font-size: 9px;
  font-weight: 800;
  padding: 1.5px 5px;
  border-radius: 4px;
}

.alert-tag.exception { background-color: rgba(185, 28, 28, 0.15); color: #b91c1c; }
.alert-tag.warning { background-color: rgba(180, 83, 9, 0.15); color: #b45309; }
.alert-tag.success { background-color: rgba(21, 128, 61, 0.15); color: #15803d; }
.alert-tag.info { background-color: rgba(2, 132, 199, 0.15); color: #0284c7; }

.alert-time {
  font-size: 11px;
  color: #7a826e;
  font-family: monospace;
}

.alert-target {
  font-size: 12px;
  color: #0D530E;
  font-weight: 600;
}

.alert-message {
  margin: 0;
  font-size: 13.5px;
  color: #2c3323;
  line-height: 1.5;
}

.status-ack {
  font-size: 12.5px;
  font-weight: 600;
  color: #7a826e;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-ack {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #E7E1B1;
  background-color: #ffffff;
  color: #0D530E;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-ack:hover {
  background-color: #E7E1B1;
}

.spinner-small, .spinner-small::after {
  border-radius: 50%;
  width: 12px;
  height: 12px;
}
.spinner-small {
  margin-right: 4px;
  display: inline-block;
  border-top: 1.5px solid rgba(255, 255, 255, 0.2);
  border-right: 1.5px solid rgba(255, 255, 255, 0.2);
  border-bottom: 1.5px solid rgba(255, 255, 255, 0.2);
  border-left: 1.5px solid #ffffff;
  transform: translateZ(0);
  animation: spinner-rot 0.8s infinite linear;
}

@keyframes spinner-rot {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* RESPONSIVE DESIGN ADJUSTMENTS */
@media (max-width: 1024px) {
  .manager-sidebar {
    width: 200px;
    padding: 16px 10px;
  }
  .manager-main {
    margin-left: 200px;
    padding: 24px;
  }
  .charts-grid {
    grid-template-columns: 1fr;
  }
  .donut-layout {
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }
}

@media (max-width: 768px) {
  .manager-container {
    flex-direction: column;
  }
  .manager-sidebar {
    position: relative;
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #E7E1B1;
    height: auto;
    padding: 16px;
  }
  .manager-main {
    margin-left: 0;
    padding: 16px;
  }
  .main-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  .header-actions {
    width: 100%;
    justify-content: flex-start;
  }
  .kpi-grid {
    grid-template-columns: 1fr 1fr;
  }
}

/* EXECUTIVE PDF PRINT FORMATTING STYLES */
@media print {
  body {
    background-color: #ffffff !important;
    color: #000000 !important;
  }

  .manager-container {
    background-color: #ffffff !important;
    display: block !important;
  }

  /* Hide sidebar and header action controls */
  .manager-sidebar, 
  .header-actions,
  .toast-success,
  .table-filters,
  .btn-acknowledge-all,
  .btn-ack,
  .btn-card-link,
  .sidebar-nav,
  .sidebar-footer {
    display: none !important;
  }

  .manager-main {
    margin-left: 0 !important;
    padding: 0 !important;
    background-color: #ffffff !important;
  }

  .print-banner {
    display: block !important;
    text-align: center;
    margin-bottom: 24px;
    color: #0D530E !important;
  }

  .print-banner h2 {
    font-size: 20px;
    font-weight: 800;
    margin: 0 0 6px 0;
    color: #0D530E !important;
  }

  .print-meta {
    font-size: 11px;
    color: #7a826e !important;
    margin: 0;
  }

  .main-header h1 {
    font-size: 20px !important;
    color: #0D530E !important;
  }

  .main-header p {
    color: #306D29 !important;
  }

  /* Card layouts for print */
  .kpi-card, .chart-card, .dashboard-card {
    background-color: #ffffff !important;
    border: 1px solid #E7E1B1 !important;
    box-shadow: none !important;
    color: #000000 !important;
    page-break-inside: avoid;
  }

  .kpi-card {
    border-top: 3px solid #0D530E !important;
  }

  .kpi-value, .kpi-label, .kpi-desc {
    color: #0D530E !important;
  }

  .chart-header h3, .chart-header p {
    color: #0D530E !important;
  }

  .charts-grid {
    grid-template-columns: 1fr 1fr !important; /* side by side print */
  }

  .donut-chart-svg circle {
    stroke-width: 14 !important;
  }

  .donut-text-value {
    color: #000000 !important;
  }

  .donut-text-label, .donut-text-percent {
    color: #306D29 !important;
  }

  .legend-label, .legend-count {
    color: #000000 !important;
  }

  /* Line chart print colors */
  .line-chart-svg text, .bar-chart-svg text {
    fill: #306D29 !important;
  }

  .line-chart-svg line {
    stroke: #E7E1B1 !important;
  }

  /* Tables print format */
  .executive-table th {
    color: #000000 !important;
    border-bottom: 1.5px solid #000000 !important;
  }

  .table-row {
    border-bottom: 1px solid #E7E1B1 !important;
  }

  .d-name, .phone-number {
    color: #000000 !important;
  }

  .d-id {
    color: #7a826e !important;
  }

  .route-badge {
    background-color: #f1f5f9 !important;
    color: #000000 !important;
    border: 1px solid #cbd5e1 !important;
  }

  /* Alerts list printing */
  .alert-item {
    background-color: #ffffff !important;
    border: 1px solid #E7E1B1 !important;
    color: #000000 !important;
    page-break-inside: avoid;
  }

  .alert-message {
    color: #2c3323 !important;
  }

  .alert-target, .alert-time {
    color: #7a826e !important;
  }

  .workload-card {
    page-break-before: always;
  }
}
</style>
