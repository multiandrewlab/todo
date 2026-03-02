import { ref } from 'vue';
import { api } from '../api/client';

interface AuthUser {
  id: string;
  email: string;
}

const user = ref<AuthUser | null>(null);
const loading = ref(true);
const checked = ref(false);

export function useAuth() {
  async function checkAuth(): Promise<boolean> {
    if (checked.value) return !!user.value;

    try {
      user.value = await api.get<AuthUser>('/auth/me');
      return true;
    } catch {
      user.value = null;
      return false;
    } finally {
      loading.value = false;
      checked.value = true;
    }
  }

  function login() {
    window.location.href = '/api/v1/auth/login';
  }

  async function logout() {
    await api.post('/auth/logout');
    user.value = null;
    checked.value = false;
    window.location.href = '/login';
  }

  return { user, loading, checkAuth, login, logout };
}
