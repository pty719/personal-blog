<script setup>
import { onMounted, ref } from 'vue'
import { apiGet } from '../lib/publicApi'
import SectionHeader from '../components/editorial/SectionHeader.vue'
import StateBlock from '../components/editorial/StateBlock.vue'

const friends = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    friends.value = await apiGet('/api/friends')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section>
    <SectionHeader title="友链列表" />

    <StateBlock
      v-if="loading || error || friends.length === 0"
      :state="loading ? 'loading' : error ? 'error' : 'empty'"
      :message="error || '暂无友链'"
    />

    <ul v-else class="list-none mt-2">
      <li v-for="friend in friends" :key="friend.id" class="border-b border-foreground/10">
        <a
          :href="friend.url"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-4 md:gap-6 py-5 group"
        >
          <img
            v-if="friend.avatar"
            :src="friend.avatar"
            loading="lazy"
            decoding="async"
            class="w-10 h-10 object-cover border border-foreground/10 shrink-0"
            :alt="friend.name + ' 的头像'"
          />
          <span
            v-else
            class="w-10 h-10 shrink-0 border border-foreground/20 flex items-center justify-center font-serif text-lg"
            aria-hidden="true"
          >
            {{ friend.name[0] }}
          </span>
          <span class="min-w-0">
            <span class="block font-serif text-lg leading-7 group-hover:underline decoration-foreground/40 underline-offset-4">
              {{ friend.name }}
            </span>
            <span v-if="friend.description" class="block font-sans text-sm text-foreground/70 mt-0.5 truncate">
              {{ friend.description }}
            </span>
          </span>
          <span v-if="!friend.is_active" class="ml-auto shrink-0 font-sans text-xs tracking-[0.1em] text-foreground/70">
            可能失效
          </span>
        </a>
      </li>
    </ul>
  </section>
</template>
