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
    <h2 class="text-xl font-semibold text-neutral-50 mb-6">Settings</h2>

    <!-- Current user -->
    <div class="mb-6">
      <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 px-1">Account</h3>
      <div class="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-neutral-200">{{ user?.email }}</p>
            <p class="text-xs text-neutral-500 mt-0.5">Signed in</p>
          </div>
          <button
            @click="handleLogout"
            class="px-4 py-2 text-sm font-medium text-red-400 border border-neutral-700 rounded-xl hover:bg-red-500/10 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>

    <!-- Email allowlist -->
    <div>
      <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 px-1">Email Allowlist</h3>
      <p class="text-xs text-neutral-500 mb-3 px-1">Only these email addresses can sign in.</p>

      <div v-if="loading" class="text-neutral-400 text-sm py-8 text-center">Loading...</div>

      <div v-else>
        <!-- Add email form -->
        <form @submit.prevent="addEmail" class="flex gap-2 mb-3">
          <input
            v-model="newEmail"
            type="email"
            placeholder="user@example.com"
            class="flex-1 px-4 py-2.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30"
          />
          <button
            type="submit"
            :disabled="saving"
            class="px-5 py-2.5 text-sm font-medium bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </form>

        <p v-if="error" class="text-xs text-red-400 mb-2 px-1">{{ error }}</p>

        <!-- Email list -->
        <div class="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div
            v-for="(email, index) in allowedEmails"
            :key="email"
            :class="[
              'flex items-center justify-between px-4 py-3',
              index < allowedEmails.length - 1 ? 'border-b border-neutral-800' : ''
            ]"
          >
            <span class="text-sm text-neutral-200">{{ email }}</span>
            <button
              @click="removeEmail(email)"
              :disabled="saving"
              class="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
            >
              Remove
            </button>
          </div>
          <p v-if="allowedEmails.length === 0" class="text-sm text-neutral-500 py-4 text-center">
            No emails in allowlist. Anyone with a Google account can sign in.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
