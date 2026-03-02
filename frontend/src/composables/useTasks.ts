import { ref } from 'vue';
import { api } from '../api/client';
import type { Task, Tag, TaskWithRelations } from '@muscat/shared';

export function useTasks() {
  const tasks = ref<(Task & { tags?: Tag[] })[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchTasks(params: {
    status?: string;
    search?: string;
    include_archived?: boolean;
  } = {}) {
    loading.value = true;
    error.value = null;
    try {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.search) query.set('search', params.search);
      if (params.include_archived) query.set('include_archived', 'true');

      const data = await api.get<{ tasks: (Task & { tags?: Tag[] })[] }>(
        `/tasks?${query.toString()}`
      );
      tasks.value = data.tasks;
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function getTask(id: string): Promise<TaskWithRelations> {
    return api.get<TaskWithRelations>(`/tasks/${id}`);
  }

  async function archiveTask(id: string) {
    await api.post(`/tasks/${id}/archive`);
  }

  async function updateTask(id: string, data: any) {
    return api.put(`/tasks/${id}`, data);
  }

  async function createTask(data: any) {
    return api.post('/tasks', data);
  }

  return { tasks, loading, error, fetchTasks, getTask, archiveTask, updateTask, createTask };
}
