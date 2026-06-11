<script setup lang="ts">
import SessionManager from './components/common/SessionManager.vue'
</script>

<template>
  <main>
    <!-- Vue Router handles the active views (Login, SignUp, Dashboard) -->
    <router-view />
    
    <!-- Global floating session control console -->
    <SessionManager />
  </main>
</template>

<style>
/* Global resets or overrides if needed */
main {
  width: 100%;
  min-height: 100vh;
}
</style>
