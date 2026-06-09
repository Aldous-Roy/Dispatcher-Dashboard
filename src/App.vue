<script setup lang="ts">
import { ref } from 'vue'
import SignUp from './components/SignUp.vue'
import Login from './components/Login.vue'
import Dashboard from './components/Dashboard.vue'

const currentView = ref<'login' | 'signup' | 'dashboard'>('login')
const sessionUser = ref('')
const sessionHub = ref('')

const handleLoginSuccess = (payload: { username: string; hub: string }) => {
  sessionUser.value = payload.username
  sessionHub.value = payload.hub
  currentView.value = 'dashboard'
}

const handleSignUpSuccess = (payload: { username: string; hub: string }) => {
  sessionUser.value = payload.username
  sessionHub.value = payload.hub
  currentView.value = 'dashboard'
}

const handleLogout = () => {
  sessionUser.value = ''
  sessionHub.value = ''
  currentView.value = 'login'
}
</script>

<template>
  <main>
    <Login 
      v-if="currentView === 'login'" 
      @switch-view="currentView = 'signup'" 
      @login-success="handleLoginSuccess"
    />
    <SignUp 
      v-else-if="currentView === 'signup'" 
      @switch-view="currentView = 'login'" 
      @signup-success="handleSignUpSuccess"
    />
    <Dashboard 
      v-else-if="currentView === 'dashboard'" 
      :username="sessionUser" 
      :hub="sessionHub"
      @logout="handleLogout"
    />
  </main>
</template>

