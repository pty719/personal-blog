<script setup>
import SourceChip from './SourceChip.vue'

defineProps({
  project: { type: Object, required: true },
})
</script>

<template>
  <article class="py-7 border-b border-foreground/10">
    <div class="flex items-baseline justify-between gap-4">
      <h3 class="font-serif text-xl md:text-2xl font-normal">{{ project.name }}</h3>
      <span v-if="project.stars > 0" class="font-sans text-xs tracking-[0.1em] text-foreground/60 shrink-0">
        ⭐ {{ project.stars }}
      </span>
    </div>

    <p v-if="project.description" class="font-sans text-base leading-7 text-foreground/80 mt-2 max-w-3xl">
      {{ project.description }}
    </p>

    <div v-if="project.tech_tags" class="flex flex-wrap gap-2 mt-4">
      <SourceChip v-for="tag in project.tech_tags.split(',')" :key="tag" :label="tag.trim()" />
    </div>

    <div class="flex flex-wrap gap-6 mt-4">
      <a
        v-if="project.repo"
        :href="project.repo"
        target="_blank"
        rel="noopener noreferrer"
        class="font-sans text-sm tracking-[0.1em] border-b border-foreground/30 hover:border-foreground pb-0.5 transition-colors"
      >
        GitHub 仓库 ➡
      </a>
      <a
        v-if="project.url"
        :href="project.url"
        target="_blank"
        rel="noopener noreferrer"
        class="font-sans text-sm tracking-[0.1em] border-b border-foreground/30 hover:border-foreground pb-0.5 transition-colors"
      >
        在线预览 ➡
      </a>
    </div>
  </article>
</template>
