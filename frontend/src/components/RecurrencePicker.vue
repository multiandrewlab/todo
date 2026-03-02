<script setup lang="ts">
import { ref, watch } from 'vue';
import type { RecurrenceRule } from '@muscat/shared';

const props = defineProps<{ modelValue: RecurrenceRule | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: RecurrenceRule | null] }>();

const enabled = ref(!!props.modelValue);
const frequency = ref<RecurrenceRule['frequency']>(props.modelValue?.frequency || 'daily');
const interval = ref(props.modelValue?.interval || 1);
const daysOfWeek = ref<number[]>(props.modelValue?.daysOfWeek || []);
const dayOfMonth = ref(props.modelValue?.dayOfMonth || 1);
const weekOfMonth = ref(props.modelValue?.weekOfMonth || 1);
const monthlyMode = ref<'dayOfMonth' | 'weekOfMonth'>(
  props.modelValue?.weekOfMonth ? 'weekOfMonth' : 'dayOfMonth'
);
const monthOfYear = ref(props.modelValue?.monthOfYear || 1);

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function emitRule() {
  if (!enabled.value) {
    emit('update:modelValue', null);
    return;
  }

  const rule: RecurrenceRule = { frequency: frequency.value, interval: interval.value };

  if (frequency.value === 'weekly' && daysOfWeek.value.length > 0) {
    rule.daysOfWeek = [...daysOfWeek.value].sort();
  }

  if (frequency.value === 'monthly') {
    if (monthlyMode.value === 'dayOfMonth') {
      rule.dayOfMonth = dayOfMonth.value;
    } else {
      rule.weekOfMonth = weekOfMonth.value;
      rule.daysOfWeek = daysOfWeek.value.length ? [...daysOfWeek.value] : [1];
    }
  }

  if (frequency.value === 'yearly') {
    rule.monthOfYear = monthOfYear.value;
    rule.dayOfMonth = dayOfMonth.value;
  }

  emit('update:modelValue', rule);
}

watch([enabled, frequency, interval, daysOfWeek, dayOfMonth, weekOfMonth, monthlyMode, monthOfYear], emitRule, { deep: true });
</script>

<template>
  <div>
    <label class="flex items-center gap-2 text-sm text-gray-300 mb-2">
      <input type="checkbox" v-model="enabled" class="rounded" />
      Repeat
    </label>

    <div v-if="enabled" class="space-y-2 pl-6">
      <!-- Frequency -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-400">Every</span>
        <input
          v-model.number="interval"
          type="number"
          min="1"
          class="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200"
        />
        <select
          v-model="frequency"
          class="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200"
        >
          <option value="daily">day(s)</option>
          <option value="weekly">week(s)</option>
          <option value="monthly">month(s)</option>
          <option value="yearly">year(s)</option>
        </select>
      </div>

      <!-- Weekly: day of week checkboxes -->
      <div v-if="frequency === 'weekly'" class="flex gap-1">
        <button
          v-for="(name, i) in dayNames"
          :key="i"
          type="button"
          :class="[
            'w-8 h-8 rounded text-xs font-medium transition-colors',
            daysOfWeek.includes(i) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          ]"
          @click="daysOfWeek.includes(i) ? daysOfWeek.splice(daysOfWeek.indexOf(i), 1) : daysOfWeek.push(i)"
        >
          {{ name }}
        </button>
      </div>

      <!-- Monthly -->
      <div v-if="frequency === 'monthly'" class="space-y-2">
        <div class="flex gap-4">
          <label class="flex items-center gap-1 text-sm text-gray-400">
            <input type="radio" v-model="monthlyMode" value="dayOfMonth" />
            On day
          </label>
          <label class="flex items-center gap-1 text-sm text-gray-400">
            <input type="radio" v-model="monthlyMode" value="weekOfMonth" />
            On the
          </label>
        </div>

        <div v-if="monthlyMode === 'dayOfMonth'">
          <input
            v-model.number="dayOfMonth"
            type="number"
            min="1"
            max="31"
            class="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200"
          />
        </div>

        <div v-else class="flex items-center gap-2">
          <select v-model.number="weekOfMonth" class="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200">
            <option :value="1">1st</option>
            <option :value="2">2nd</option>
            <option :value="3">3rd</option>
            <option :value="4">4th</option>
            <option :value="5">5th</option>
          </select>
          <select v-model.number="daysOfWeek[0]" class="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200">
            <option v-for="(name, i) in dayNames" :key="i" :value="i">{{ name }}</option>
          </select>
        </div>
      </div>

      <!-- Yearly -->
      <div v-if="frequency === 'yearly'" class="flex items-center gap-2">
        <span class="text-sm text-gray-400">In</span>
        <select v-model.number="monthOfYear" class="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200">
          <option v-for="(name, i) in monthNames" :key="i" :value="i + 1">{{ name }}</option>
        </select>
        <span class="text-sm text-gray-400">on day</span>
        <input
          v-model.number="dayOfMonth"
          type="number"
          min="1"
          max="31"
          class="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200"
        />
      </div>
    </div>
  </div>
</template>
