<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';

const route = useRoute();
const error = computed(() => route.query.error as string | undefined);
</script>

<template>
  <div class="flex items-center justify-center h-screen bg-gray-950">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-white mb-8">Muscat</h1>
      <p class="text-gray-400 mb-6">Personal Task OS</p>

      <div v-if="error === 'unauthorized'" class="mb-4 text-red-400 text-sm">
        Your account is not authorized. Contact the administrator.
      </div>

      <a
        href="/api/v1/auth/login"
        class="inline-block px-6 py-3 bg-white text-gray-900 font-medium rounded-lg hover:bg-gray-100 transition-colors"
      >
        Sign in with Google
      </a>
    </div>
  </div>
</template>
