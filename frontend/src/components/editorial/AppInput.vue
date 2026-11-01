<script setup>
defineProps({
  id: { type: String, required: true },
  label: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: undefined },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="mb-5">
    <label v-if="label" :for="id" class="field-label">{{ label }}</label>
    <input
      :id="id"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? id + '-error' : undefined"
      class="input-editorial"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <p v-if="error" :id="id + '-error'" class="mt-2 font-sans text-xs font-medium text-foreground" role="alert">
      {{ error }}
    </p>
  </div>
</template>
