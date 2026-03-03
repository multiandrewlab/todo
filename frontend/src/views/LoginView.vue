<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';

const route = useRoute();
const error = computed(() => route.query.error as string | undefined);
</script>

<template>
  <div class="flex items-center justify-center h-screen bg-neutral-950">
    <div class="text-center">
      <h1 class="text-3xl font-semibold text-neutral-50 mb-3">Muscat</h1>
      <p class="text-neutral-400 mb-8">Personal Task OS</p>

      <div v-if="error === 'unauthorized'" class="mb-4 text-red-400 text-sm">
        Your account is not authorized. Contact the administrator.
      </div>

      <a
        href="/api/v1/auth/login"
        class="inline-block px-8 py-3 bg-white text-neutral-900 font-medium rounded-xl hover:bg-neutral-100 transition-colors shadow-sm"
      >
        Sign in with Google
      </a>
    </div>
  </div>
</template>
