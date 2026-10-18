<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { createCollection, updateCollection, type CollectionSummary } from '@/api/social'
import { useToast } from '@/composables/useToast'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'

const props = defineProps<{ modelValue: boolean; collection?: CollectionSummary | null }>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', collection: CollectionSummary): void
}>()

const queryClient = useQueryClient()
const toast = useToast()
const saving = ref(false)
const form = reactive({ name: '', description: '', isPublic: true })

watch(
  () => [props.modelValue, props.collection],
  () => {
    if (!props.modelValue) return
    form.name = props.collection?.name ?? ''
    form.description = props.collection?.description ?? ''
    form.isPublic = props.collection?.isPublic ?? true
  },
  { immediate: true },
)

function close() {
  emit('update:modelValue', false)
}

async function save() {
  const name = form.name.trim()
  if (!name) {
    toast.warning('给收藏夹起个名字')
    return
  }
  if (name.length > 40) {
    toast.warning('名称最多 40 个字')
    return
  }
  saving.value = true
  try {
    const payload = {
      name,
      description: form.description.trim() || undefined,
      isPublic: form.isPublic,
    }
    const res = props.collection
      ? await updateCollection(props.collection.id, payload)
      : await createCollection(payload)
    await queryClient.invalidateQueries({ queryKey: ['collections'] })
    await queryClient.invalidateQueries({ queryKey: ['my-collections'] })
    toast.success(props.collection ? '收藏夹已更新' : '收藏夹已创建')
    emit('saved', res.data.data)
    close()
  } catch (err: any) {
    toast.error(err.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    :title="collection ? '编辑收藏夹' : '新建收藏夹'"
    width="480px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <label class="mb-1.5 block text-xs font-medium text-ink-2">名称</label>
    <input v-model="form.name" class="n-input mb-4" maxlength="40" placeholder="比如：奶龙表情包、深夜灵感…" />

    <label class="mb-1.5 block text-xs font-medium text-ink-2">简介（可选）</label>
    <textarea
      v-model="form.description"
      rows="3"
      maxlength="200"
      class="mb-4 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-ink"
      placeholder="这个收藏夹收些什么？"
    />

    <label class="flex cursor-pointer items-center justify-between rounded-2xl border border-line bg-paper/50 px-4 py-3">
      <span>
        <span class="block text-sm font-medium text-ink">公开收藏夹</span>
        <span class="mt-0.5 block text-[11px] text-muted">公开后会出现在收藏夹广场和你的主页</span>
      </span>
      <button
        type="button"
        role="switch"
        :aria-checked="form.isPublic"
        class="relative h-6 w-11 rounded-full transition"
        :class="form.isPublic ? 'bg-jade' : 'bg-line-strong'"
        @click="form.isPublic = !form.isPublic"
      >
        <span class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" :class="form.isPublic ? 'left-[22px]' : 'left-0.5'" />
      </button>
    </label>

    <div class="mt-6 flex justify-end gap-2">
      <UiButton variant="ghost" @click="close">取消</UiButton>
      <UiButton variant="primary" :loading="saving" @click="save">{{ collection ? '保存修改' : '创建' }}</UiButton>
    </div>
  </UiModal>
</template>
