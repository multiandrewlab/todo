<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '../composables/useAuth';
import { api } from '../api/client';

const { user, logout } = useAuth();

const allowedEmails = ref<string[]>([]);
const newEmail = ref('');
const loading = ref(true);
const saving = ref(false);
const error = ref('');

onMounted(async () => {
  try {
    const settings = await api.get<{ settings: { setting_name: string; setting_value: string }[] }>('/settings');
    const allowlist = settings.settings.find(s => s.setting_name === 'email_allowlist');
    if (allowlist) {
      allowedEmails.value = JSON.parse(allowlist.setting_value);
    }
  } catch (e: any) {
    console.error('Failed to load settings:', e);
  } finally {
    loading.value = false;
  }
});

async function addEmail() {
  const email = newEmail.value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    error.value = 'Please enter a valid email address.';
    return;
  }
  if (allowedEmails.value.includes(email)) {
    error.value = 'Email already in allowlist.';
    return;
  }
  error.value = '';
  allowedEmails.value.push(email);
  newEmail.value = '';
  await saveAllowlist();
}

async function removeEmail(email: string) {
  allowedEmails.value = allowedEmails.value.filter(e => e !== email);
  await saveAllowlist();
}

async function saveAllowlist() {
  saving.value = true;
  try {
    await api.put('/settings/email_allowlist', {
      value: JSON.stringify(allowedEmails.value),
    });
  } catch (e: any) {
    error.value = 'Failed to save allowlist.';
    console.error('Save failed:', e);
  } finally {
    saving.value = false;
  }
}

async function handleLogout() {
  await logout();
}
</script>

<template>
  <div>
    <h2 class="text-xl font-semibold mb-6">Settings</h2>

    <!-- Current user -->
    <div class="mb-8">
      <h3 class="text-sm font-medium text-gray-300 mb-2">Account</h3>
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-200">{{ user?.email }}</p>
            <p class="text-xs text-gray-500 mt-0.5">Signed in</p>
          </div>
          <button
            @click="handleLogout"
            class="px-3 py-1.5 text-sm text-red-400 border border-red-800 rounded hover:bg-red-900/30 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>

    <!-- Email allowlist -->
    <div>
      <h3 class="text-sm font-medium text-gray-300 mb-2">Email Allowlist</h3>
      <p class="text-xs text-gray-500 mb-3">Only these email addresses can sign in.</p>

      <div v-if="loading" class="text-gray-400 text-sm py-4">Loading...</div>

      <div v-else>
        <!-- Add email form -->
        <form @submit.prevent="addEmail" class="flex gap-2 mb-3">
          <input
            v-model="newEmail"
            type="email"
            placeholder="user@example.com"
            class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 outline-none"
          />
          <button
            type="submit"
            :disabled="saving"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </form>

        <p v-if="error" class="text-xs text-red-400 mb-2">{{ error }}</p>

        <!-- Email list -->
        <div class="space-y-1">
          <div
            v-for="email in allowedEmails"
            :key="email"
            class="flex items-center justify-between bg-gray-900 border border-gray-800 rounded px-3 py-2"
          >
            <span class="text-sm text-gray-300">{{ email }}</span>
            <button
              @click="removeEmail(email)"
              :disabled="saving"
              class="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
          <p v-if="allowedEmails.length === 0" class="text-sm text-gray-500 py-2">
            No emails in allowlist. Anyone with a Google account can sign in.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
