<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  addImageToCollection,
  createCollection,
  getMyCollections,
  removeImageFromCollection,
  type CollectionSummary,
} from '@/api/social'
import { useToast } from '@/composables/useToast'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = defineProps<{ modelValue: boolean; imageId: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const toast = useToast()
const loading = ref(false)
const busyId = ref<string | null>(null)
const collections = ref<CollectionSummary[]>([])
const creating = ref(false)
const newName = ref('')

async function load() {
  loading.value = true
  try {
    const res = await getMyCollections(props.imageId)
    collections.value = res.data.data
  } catch (err: any) {
    toast.error(err.response?.data?.message || '加载收藏夹失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      newName.value = ''
      void load()
    }
  },
)

async function toggle(collection: CollectionSummary) {
  if (busyId.value) return
  busyId.value = collection.id
  try {
    if (collection.containsImage) {
      const res = await removeImageFromCollection(collection.id, props.imageId)
      collection.containsImage = false
      collection.itemCount = res.data.data.itemCount
      toast.success('已从收藏夹移除')
    } else {
      const res = await addImageToCollection(collection.id, props.imageId)
      collection.containsImage = true
      collection.itemCount = res.data.data.itemCount
      toast.success('已加入收藏夹')
    }
  } catch (err: any) {
    toast.error(err.response?.data?.message || '操作失败')
  } finally {
    busyId.value = null
  }
}

async function createAndAdd() {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  try {
    const res = await createCollection({ name, isPublic: true })
    const created = res.data.data
    const added = await addImageToCollection(created.id, props.imageId)
    collections.value.unshift({ ...created, itemCount: added.data.data.itemCount, containsImage: true })
    newName.value = ''
    toast.success('收藏夹已创建并加入')
  } catch (err: any) {
    toast.error(err.response?.data?.message || '创建失败')
  } finally {
    creating.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <UiModal :model-value="modelValue" title="收藏到收藏夹" width="480px" @update:model-value="close">
    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="n-skeleton h-16 rounded-2xl" />
    </div>

    <div v-else class="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
      <button
        v-for="collection in collections"
        :key="collection.id"
        class="flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition"
        :class="collection.containsImage ? 'border-jade/50 bg-jade/5' : 'border-line hover:border-ink/40'"
        :disabled="busyId === collection.id"
        @click="toggle(collection)"
      >
        <span class="grid h-11 w-11 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-xl bg-surface-2">
          <template v-for="n in 4" :key="n">
            <img
              v-if="collection.previews[n - 1]"
              :src="collection.previews[n - 1].thumbnailSmUrl || collection.previews[n - 1].thumbnailUrl || ''"
              alt=""
              class="h-full w-full object-cover"
            />
            <span v-else class="bg-paper-deep" />
          </template>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium text-ink">{{ collection.name }}</span>
          <span class="mt-0.5 block font-mono text-[9px] text-muted">{{ collection.itemCount }} 张 · {{ collection.isPublic ? '公开' : '私密' }}</span>
        </span>
        <span
          class="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
          :class="collection.containsImage ? 'border-jade bg-jade text-white' : 'border-line text-muted'"
        >
          <AppIcon :name="collection.containsImage ? 'check' : 'plus'" :size="13" />
        </span>
      </button>

      <p v-if="collections.length === 0" class="py-6 text-center text-sm text-muted">
        还没有收藏夹。在下面新建一个，顺手把这张图放进去。
      </p>
    </div>

    <div class="mt-4 flex gap-2 border-t border-line pt-4">
      <input v-model="newName" class="n-input !py-2.5" maxlength="40" placeholder="新收藏夹名称" @keyup.enter="createAndAdd" />
      <UiButton variant="primary" size="sm" :loading="creating" @click="createAndAdd">新建并加入</UiButton>
    </div>
  </UiModal>
</template>