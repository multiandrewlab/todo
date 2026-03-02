import { createRouter, createWebHistory } from 'vue-router';

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

export default router;
