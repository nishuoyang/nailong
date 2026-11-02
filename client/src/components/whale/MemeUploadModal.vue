<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { deleteMeme, getMyMemes, uploadMeme } from '@/api/memes'
import { WHALE_MOODS, type WhaleMood } from '@/data/whaleMemes'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { timeAgo } from '@/utils/format'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'

const props = defineProps<{
  modelValue: boolean
  /** 打开时默认展示的页签 */
  initialTab?: 'upload' | 'mine'
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'uploaded'): void
}>()

const toast = useToast()
const authStore = useAuthStore()
const queryClient = useQueryClient()

const tab = ref<'upload' | 'mine'>(props.initialTab ?? 'upload')
watch(
  () => props.modelValue,
  (open) => {
    if (open) tab.value = props.initialTab ?? 'upload'
  },
)

// ────────────────────────────── 投喂表单 ──────────────────────────────

const MOOD_OPTIONS = WHALE_MOODS.filter((m) => m.key !== 'all') as Array<{
  key: WhaleMood
  label: string
  glyph: string
}>

const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const dragging = ref(false)
const uploading = ref(false)
const progress = ref(0)
const done = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const form = reactive({
  title: '',
  mood: 'fish' as WhaleMood,
  tags: [] as string[],
  tagInput: '',
  note: '',
})

function revokePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
}

function acceptFile(next: File | null | undefined) {
  if (!next) return
  // 与后端限制对齐：GIF/PNG/WebP、≤5MB（后端还会验边长与每日配额）
  if (!['image/gif', 'image/png', 'image/webp'].includes(next.type)) {
    toast.error('只支持 GIF、PNG、WebP')
    return
  }
  if (next.size > 5 * 1024 * 1024) {
    toast.error('文件不能超过 5MB')
    return
  }
  revokePreview()
  file.value = next
  previewUrl.value = URL.createObjectURL(next)
  if (!form.title) {
    form.title = next.name.replace(/\.[^.]+$/, '').slice(0, 50)
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false
  acceptFile(event.dataTransfer?.files?.[0])
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  acceptFile(input.files?.[0])
  input.value = ''
}

function removeFile() {
  revokePreview()
  file.value = null
}

function addTag() {
  const tag = form.tagInput.trim().replace(/^#+/, '')
  if (!tag) return
  if (form.tags.length >= 5) {
    toast.warning('最多 5 个标签')
    return
  }
  if (!form.tags.includes(tag)) form.tags.push(tag)
  form.tagInput = ''
}

function removeTag(tag: string) {
  form.tags = form.tags.filter((t) => t !== tag)
}

const canSubmit = computed(() => Boolean(file.value && form.title.trim()) && !uploading.value)

async function submit() {
  if (!canSubmit.value) return
  uploading.value = true
  progress.value = 0
  try {
    const data = new FormData()
    data.append('file', file.value!)
    data.append('title', form.title.trim())
    data.append('mood', form.mood)
    if (form.tags.length) data.append('tags', form.tags.join(','))
    if (form.note.trim()) data.append('note', form.note.trim())

    await uploadMeme(data, (percent) => (progress.value = percent))
    progress.value = 100
    done.value = true
    toast.success('投喂成功，等管理员过目就能进鱼塘')
    queryClient.invalidateQueries({ queryKey: ['my-memes'] })
    emit('uploaded')
  } catch (err: any) {
    toast.error(err.response?.data?.message || '投喂失败了，稍后再试')
  } finally {
    uploading.value = false
  }
}

function reset() {
  done.value = false
  progress.value = 0
  removeFile()
  form.title = ''
  form.mood = 'fish'
  form.tags = []
  form.tagInput = ''
  form.note = ''
}

onBeforeUnmount(revokePreview)

// ────────────────────────────── 我的投喂 ──────────────────────────────

const statusMeta: Record<string, { label: string; cls: string }> = {
  pending: { label: '审核中', cls: 'bg-[#ffd84d]/20 text-[#8a6a00] border-[#ffd84d]/50' },
  approved: { label: '已上架', cls: 'bg-jade/15 text-jade border-jade/40' },
  rejected: { label: '未通过', cls: 'bg-accent/10 text-accent border-accent/40' },
  offline: { label: '已下架', cls: 'bg-ink/10 text-ink-2 border-ink/25' },
}

const {
  data: mine,
  isLoading: mineLoading,
} = useQuery({
  queryKey: ['my-memes'],
  queryFn: () => getMyMemes().then((r) => r.data.data),
  enabled: computed(() => props.modelValue && tab.value === 'mine' && authStore.isLoggedIn),
})

const removeMutation = useMutation({
  mutationFn: (id: string) => deleteMeme(id),
  onSuccess: () => {
    toast.success('已撤回')
    queryClient.invalidateQueries({ queryKey: ['my-memes'] })
    queryClient.invalidateQueries({ queryKey: ['whale-memes'] })
    emit('uploaded')
  },
  onError: () => toast.error('撤回失败了，稍后再试'),
})

function badgeOf(status: string) {
  return statusMeta[status] ?? { label: status, cls: 'bg-ink/10 text-ink-2 border-ink/25' }
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    title="投喂表情包"
    width="640px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #subtitle>
      <p class="mt-1 text-xs text-muted">GIF / PNG / WebP · ≤ 5MB · 每人每日 20 张 · 审核通过后进鱼塘</p>
    </template>

    <!-- 页签 -->
    <div class="mb-5 flex gap-1 rounded-full border border-line bg-surface-2 p-1">
      <button
        class="flex-1 rounded-full px-4 py-2 text-xs font-medium transition"
        :class="tab === 'upload' ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'"
        type="button"
        @click="tab = 'upload'"
      >
        <AppIcon name="upload" :size="13" class="mr-1 inline align-[-2px]" /> 投喂新的
      </button>
      <button
        class="flex-1 rounded-full px-4 py-2 text-xs font-medium transition"
        :class="tab === 'mine' ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'"
        type="button"
        @click="tab = 'mine'"
      >
        <AppIcon name="list" :size="13" class="mr-1 inline align-[-2px]" /> 我的投喂
        <template v-if="mine?.length">（{{ mine.length }}）</template>
      </button>
    </div>

    <!-- ══════════ 投喂新的 ══════════ -->
    <template v-if="tab === 'upload'">
      <!-- 成功态 -->
      <div v-if="done" class="py-6 text-center">
        <div class="mx-auto mb-5 grid h-20 w-20 animate-pop place-items-center rounded-[26px] border-[1.5px] border-ink bg-jade text-paper shadow-[5px_5px_0_0_var(--ink)]">
          <AppIcon name="check" :size="34" :stroke-width="1.8" />
        </div>
        <p class="font-display text-2xl text-ink">收到了，等审核。</p>
        <p class="mt-2 text-sm text-ink-2">管理员通过后它就会游进鱼塘。你可以在「我的投喂」里看进度。</p>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <UiButton variant="primary" @click="tab = 'mine'">看我的投喂</UiButton>
          <UiButton variant="outline" @click="reset">再喂一张</UiButton>
        </div>
      </div>

      <template v-else>
        <!-- 拖拽/预览 -->
        <div
          v-if="!file"
          class="relative flex min-h-[180px] flex-col items-center justify-center rounded-[22px] border-[1.5px] border-dashed border-line-strong bg-surface px-5 text-center transition"
          :class="dragging ? '!border-accent bg-accent/5' : 'hover:border-ink/50'"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <div class="grid h-14 w-14 place-items-center rounded-[18px] border border-line bg-paper text-ink-2">
            <AppIcon name="upload" :size="22" />
          </div>
          <p class="mt-3 font-display text-xl text-ink">把表情包拖进来</p>
          <p class="mt-1 text-xs text-muted">或者点下面按钮选一张（GIF / PNG / WebP，≤ 5MB）</p>
          <UiButton variant="primary" size="sm" class="mt-4" @click="fileInput?.click()">
            <AppIcon name="image" :size="14" /> 选择文件
          </UiButton>
          <input ref="fileInput" type="file" accept="image/gif,image/png,image/webp" class="hidden" @change="onPick" />
        </div>

        <div v-else class="overflow-hidden rounded-[22px] border border-line bg-surface">
          <div class="relative grid min-h-[200px] place-items-center bg-[#1a1611] p-3">
            <img v-if="previewUrl" :src="previewUrl" alt="预览" class="max-h-[36vh] max-w-full rounded-xl object-contain" />
            <button
              class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm transition hover:bg-accent"
              aria-label="移除文件"
              @click="removeFile"
            >
              <AppIcon name="close" :size="15" />
            </button>
          </div>
          <div class="flex items-center justify-between gap-3 px-4 py-2.5">
            <p class="min-w-0 truncate text-xs text-ink-2">{{ file.name }}</p>
            <p class="shrink-0 font-mono text-[9px] text-muted">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</p>
          </div>
        </div>

        <!-- 表单 -->
        <div class="mt-4 space-y-4">
          <div>
            <label class="mb-1.5 block text-xs font-medium text-ink-2">标题 <span class="text-accent">*</span></label>
            <input v-model="form.title" class="n-input !rounded-2xl !py-2.5" maxlength="50" placeholder="图上的梗 / 一句话说明" />
            <div class="mt-1 text-right font-mono text-[9px] text-muted">{{ form.title.length }} / 50</div>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-medium text-ink-2">捞进哪个情绪鱼塘</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="mood in MOOD_OPTIONS"
                :key="mood.key"
                type="button"
                class="rounded-full border px-3 py-1.5 text-xs transition"
                :class="
                  form.mood === mood.key
                    ? 'border-ink bg-ink text-paper'
                    : 'border-line bg-surface text-ink-2 hover:border-ink/50 hover:text-ink'
                "
                @click="form.mood = mood.key"
              >
                <span class="mr-1">{{ mood.glyph }}</span>{{ mood.label }}
              </button>
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-medium text-ink-2">标签（可选，最多 5 个）</label>
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                v-for="tag in form.tags"
                :key="tag"
                class="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-ink-2"
              >
                #{{ tag }}
                <button type="button" aria-label="移除标签" @click="removeTag(tag)">
                  <AppIcon name="close" :size="11" />
                </button>
              </span>
              <input
                v-model="form.tagInput"
                class="n-input !w-auto !rounded-full !py-1.5 !text-xs"
                maxlength="16"
                placeholder="输入后回车"
                @keydown.enter.prevent="addTag"
                @keydown.,="addTag"
              />
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-medium text-ink-2">备注（可选）</label>
            <textarea
              v-model="form.note"
              rows="2"
              maxlength="200"
              class="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-ink"
              placeholder="出处、想用在什么场景……"
            />
            <div class="mt-1 text-right font-mono text-[9px] text-muted">{{ form.note.length }} / 200</div>
          </div>

          <div v-if="uploading" class="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div class="h-full rounded-full bg-ink transition-all" :style="{ width: `${progress}%` }" />
          </div>

          <UiButton variant="primary" block :disabled="!canSubmit" :loading="uploading" @click="submit">
            {{ uploading ? `正在投喂 ${progress}%` : '投喂进鱼塘' }}
          </UiButton>
        </div>
      </template>
    </template>

    <!-- ══════════ 我的投喂 ══════════ -->
    <template v-else>
      <p v-if="mineLoading" class="py-8 text-center text-sm text-muted">正在捞你的投喂记录……</p>
      <p v-else-if="!mine?.length" class="py-8 text-center text-sm text-muted">
        还没投喂过。切到左边的页签，喂第一张吧。
      </p>
      <ul v-else class="space-y-2.5">
        <li
          v-for="item in mine"
          :key="item.id"
          class="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5"
        >
          <img
            :src="item.url"
            :alt="item.title"
            class="h-14 w-14 shrink-0 rounded-xl border border-line bg-white object-contain"
            loading="lazy"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-ink">{{ item.title }}</p>
            <p class="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
              <span class="rounded-full border px-2 py-0.5" :class="badgeOf(item.status).cls">
                {{ badgeOf(item.status).label }}
              </span>
              <span class="font-mono">{{ timeAgo(item.createdAt) }}</span>
            </p>
          </div>
          <button
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-2 transition hover:border-accent hover:text-accent"
            aria-label="撤回这条投喂"
            :disabled="removeMutation.isPending.value"
            @click="removeMutation.mutate(item.id)"
          >
            <AppIcon name="trash" :size="14" />
          </button>
        </li>
      </ul>
    </template>
  </UiModal>
</template>
