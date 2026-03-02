import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/_share',
      name: 'share',
      component: () => import('../views/ShareTargetView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('../components/AppLayout.vue'),
      children: [
        { path: '', name: 'inbox', component: () => import('../views/InboxView.vue') },
        { path: 'active', name: 'active', component: () => import('../views/ActiveView.vue') },
        { path: 'archived', name: 'archived', component: () => import('../views/ArchivedView.vue') },
        { path: 'settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public) return;

  const { checkAuth } = useAuth();
  const isAuthed = await checkAuth();

  if (!isAuthed) {
    return { name: 'login' };
  }
});

export default router;
