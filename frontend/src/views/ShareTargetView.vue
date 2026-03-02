<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  const { title, text, url } = route.query;
  const params = new URLSearchParams();
  if (title || text) params.set('title', String(title || text || ''));
  if (url) params.set('url', String(url));

  try {
    await fetch(`/api/v1/share-target?${params}`, { credentials: 'include' });
  } catch (e) {
    console.error('Share target failed:', e);
  }

  router.push('/');
});
</script>

<template>
  <div class="flex items-center justify-center h-screen bg-gray-950">
    <div class="text-center">
      <div class="w-8 h-8 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
      <p class="text-gray-400">Adding to inbox...</p>
    </div>
  </div>
</template>
