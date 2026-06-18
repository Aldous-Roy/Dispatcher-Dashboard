import { ref, onUnmounted } from 'vue'
import { Client } from '@stomp/stompjs'

export function useWebsocket() {
  const client = ref<Client | null>(null)
  const connected = ref(false)
  const activeSubscription = ref<any>(null)
  const lastLocation = ref<{ latitude: number; longitude: number; timestamp?: string } | null>(null)
  const locationLog = ref<{ latitude: number; longitude: number; timestamp: string }[]>([])

  const getWsUrl = () => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
    if (apiBase.startsWith('http')) {
      const baseClean = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
      return baseClean.replace(/^http/, 'ws') + '/ws';
    }
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/ws`;
  }

  const connect = () => {
    if (client.value) return

    const wsUrl = getWsUrl()
    console.log(`[WebSocket] Connecting to STOMP broker at: ${wsUrl}`)

    let token = ''
    const sessionStr = localStorage.getItem('auth_session')
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr)
        if (session && session.token) {
          token = session.token
        }
      } catch (e) {
        console.error('[WebSocket] Failed to parse auth session:', e)
      }
    }

    const stompClient = new Client({
      brokerURL: wsUrl,
      connectHeaders: {
        Authorization: token ? `Bearer ${token}` : ''
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        connected.value = true
        console.log('[WebSocket] STOMP connected successfully')
      },
      onDisconnect: () => {
        connected.value = false
        console.warn('[WebSocket] STOMP disconnected')
      },
      onStompError: (frame) => {
        console.error('[WebSocket] STOMP error frame:', frame.headers['message'], frame.body)
      }
    })

    stompClient.activate()
    client.value = stompClient
  }

  const activeAlertSubscription = ref<any>(null)

  const disconnect = () => {
    unsubscribe()
    unsubscribeAlerts()
    if (client.value) {
      client.value.deactivate()
      client.value = null
      connected.value = false
      console.log('[WebSocket] STOMP connection closed')
    }
  }

  const subscribeToDriver = (driverId: string, onUpdate?: (loc: any) => void) => {
    unsubscribe()

    if (!client.value || !connected.value) {
      console.warn('[WebSocket] STOMP not connected. Postponing subscription.')
      setTimeout(() => {
        if (connected.value) {
          subscribeToDriver(driverId, onUpdate)
        }
      }, 1000)
      return
    }

    const topic = `/topic/locations/${driverId}`
    console.log(`[WebSocket] Subscribing to: ${topic}`)

    activeSubscription.value = client.value.subscribe(topic, (message) => {
      try {
        const payload = JSON.parse(message.body)
        console.log('[WebSocket] Received location payload:', payload)
        
        const loc = {
          latitude: payload.latitude,
          longitude: payload.longitude,
          timestamp: payload.timestamp || new Date().toISOString()
        }
        
        lastLocation.value = loc
        locationLog.value.unshift(loc)
        if (locationLog.value.length > 50) {
          locationLog.value.pop()
        }

        if (onUpdate) {
          onUpdate(loc)
        }
      } catch (err) {
        console.error('[WebSocket] Failed to parse message body:', err)
      }
    })
  }

  const unsubscribe = () => {
    if (activeSubscription.value) {
      console.log('[WebSocket] Unsubscribing from active topic')
      activeSubscription.value.unsubscribe()
      activeSubscription.value = null
    }
  }

  const subscribeToHighPriorityAlerts = (onAlert: (payload: any) => void) => {
    unsubscribeAlerts()

    if (!client.value || !connected.value) {
      console.warn('[WebSocket] STOMP not connected. Postponing alert subscription.')
      setTimeout(() => {
        if (connected.value) {
          subscribeToHighPriorityAlerts(onAlert)
        }
      }, 1000)
      return
    }

    const topic = '/topic/alerts/high-priority-fails'
    console.log(`[WebSocket] Subscribing to alert topic: ${topic}`)

    activeAlertSubscription.value = client.value.subscribe(topic, (message) => {
      try {
        const payload = JSON.parse(message.body)
        console.log('[WebSocket] Received alert payload:', payload)
        onAlert(payload)
      } catch (err) {
        console.error('[WebSocket] Failed to parse alert message body:', err)
      }
    })
  }

  const unsubscribeAlerts = () => {
    if (activeAlertSubscription.value) {
      console.log('[WebSocket] Unsubscribing from alert topic')
      activeAlertSubscription.value.unsubscribe()
      activeAlertSubscription.value = null
    }
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    connected,
    lastLocation,
    locationLog,
    connect,
    disconnect,
    subscribeToDriver,
    unsubscribe,
    subscribeToHighPriorityAlerts,
    unsubscribeAlerts
  }
}
