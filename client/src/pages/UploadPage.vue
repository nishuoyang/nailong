<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { getCategories } from '@/api/images'
import { uploadImage } from '@/api/upload'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiButton from '@/components/ui/UiButton.vue'

/** 与 server/src/upload/upload.service.ts 的 MAX_BATCH_IMAGES 保持一致 */
const MAX_BATCH = 9
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024

interface QueuedFile {
  key: string
  file: File
  previewUrl: string
}

const route = useRoute()
const toast = useToast()

const isOther = ref(route.query.section === 'other')
const queue = ref<QueuedFile[]>([])
const activeKey = ref('')
const dragging = ref(false)
const uploading = ref(false)
const progress = ref(0)
const done = ref(false)
const submittedCount = ref(0)
const fileInput = ref<HTMLInputElement | null>(null)

const form = reactive({
  title: '',
  description: '',
  categoryIds: [] as string[],
  tags: [] as string[],
  tagInput: '',
})

const { data: categories } = useQuery({
  queryKey: ['categories'],
  queryFn: () => getCategories().then((r) => r.data.data),
  staleTime: 10 * 60_000,
})

// 当前预览的那一张；队列空了就是 null
const active = computed(
  () => queue.value.find((item) => item.key === activeKey.value) ?? queue.value[0] ?? null,
)
const activeIndex = computed(() =>
  active.value ? queue.value.findIndex((item) => item.key === active.value!.key) : -1,
)
const totalSize = computed(() => queue.value.reduce((sum, item) => sum + item.file.size, 0))

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function addFiles(list: FileList | File[] | null | undefined) {
  if (!list) return
  const incoming = Array.from(list)
  let added = 0

  for (const file of incoming) {
    if (queue.value.length >= MAX_BATCH) {
      toast.warning(`一次最多 ${MAX_BATCH} 张，多出来的可以下次再投`)
      break
    }
    if (!ACCEPTED.includes(file.type)) {
      toast.error(`「${file.name}」格式不支持，只收 JPEG、PNG、WebP`)
      continue
    }
    if (file.size > MAX_SIZE) {
      toast.error(`「${file.name}」超过 10MB`)
      continue
    }
    const key = fileKey(file)
    // 同一张图重复拖进来时直接跳过，避免同一批里出现两个一样的文件
    if (queue.value.some((item) => item.key === key)) continue

    queue.value.push({ key, file, previewUrl: URL.createObjectURL(file) })
    added += 1
  }

  if (queue.value.length && (!activeKey.value || !queue.value.some((i) => i.key === activeKey.value))) {
    activeKey.value = queue.value[0].key
  }
  // 标题只在第一次自动填，之后不覆盖用户改过的内容
  if (added && !form.title.trim()) {
    form.title = queue.value[0].file.name.replace(/\.[^.]+$/, '').slice(0, 60)
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false
  addFiles(event.dataTransfer?.files)
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles(input.files)
  input.value = ''
}

function removeAt(key: string) {
  const index = queue.value.findIndex((item) => item.key === key)
  if (index < 0) return
  URL.revokeObjectURL(queue.value[index].previewUrl)
  queue.value.splice(index, 1)

  if (activeKey.value === key) {
    activeKey.value = queue.value[Math.min(index, queue.value.length - 1)]?.key ?? ''
  }
}

/** 把选中的这张挪到最前面——列表里展示的就是第一张（封面）。 */
function setCover(key: string) {
  const index = queue.value.findIndex((item) => item.key === key)
  if (index <= 0) return
  const [item] = queue.value.splice(index, 1)
  queue.value.unshift(item)
  toast.success('已设为封面')
}

// ── 预览翻页 ──
// 队列里有多张时，除了点缩略图，也可以用左右按钮/方向键在预览区切换。
const canPrevPreview = computed(() => activeIndex.value > 0)
const canNextPreview = computed(
  () => activeIndex.value >= 0 && activeIndex.value < queue.value.length - 1,
)

function stepActive(delta: number) {
  const next = activeIndex.value + delta
  if (activeIndex.value < 0 || next < 0 || next >= queue.value.length) return
  activeKey.value = queue.value[next].key
}

/**
 * 方向键切换预览。
 * 表单里有输入框（标题/描述/标签），在输入框内按左右键是移动光标，必须让位；
 * 正在上传或已进入成功页时不响应。
 */
function onKeyNav(event: KeyboardEvent) {
  if (done.value || uploading.value) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  if (queue.value.length < 2) return
  const target = event.target as HTMLElement | null
  const tag = target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
  event.preventDefault()
  stepActive(event.key === 'ArrowLeft' ? -1 : 1)
}

onMounted(() => window.addEventListener('keydown', onKeyNav))

function toggleCategory(id: string) {
  const index = form.categoryIds.indexOf(id)
  if (index >= 0) form.categoryIds.splice(index, 1)
  else if (form.categoryIds.length < 3) form.categoryIds.push(id)
  else toast.warning('最多选择 3 个分类')
}

function addTag() {
  const raw = form.tagInput.trim().replace(/^#/, '')
  if (!raw) return
  if (form.tags.length >= 6) {
    toast.warning('最多 6 个标签')
    return
  }
  if (!form.tags.includes(raw)) form.tags.push(raw.slice(0, 20))
  form.tagInput = ''
}

function removeTag(tag: string) {
  form.tags = form.tags.filter((item) => item !== tag)
}

function onTagKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
    event.preventDefault()
    addTag()
  } else if (event.key === 'Backspace' && !form.tagInput && form.tags.length) {
    form.tags.pop()
  }
}

async function submit() {
  if (!queue.value.length) {
    toast.warning('先选几张图')
    return
  }
  if (!form.title.trim()) {
    toast.warning('给这组图起个标题')
    return
  }
  uploading.value = true
  progress.value = 0
  try {
    const data = new FormData()
    // 同名多值：后端把它们收成同一批次
    for (const item of queue.value) data.append('files', item.file)
    data.append('title', form.title.trim())
    if (form.description.trim()) data.append('description', form.description.trim())
    if (form.categoryIds.length) data.append('categoryIds', JSON.stringify(form.categoryIds))
    if (form.tags.length) data.append('tags', form.tags.join(','))
    if (isOther.value) data.append('section', 'other')

    const res = await uploadImage(data, (percent) => (progress.value = percent))
    progress.value = 100
    submittedCount.value = res.data.data?.count ?? queue.value.length
    done.value = true
    toast.success('已提交，等待审核')
  } catch (err: any) {
    toast.error(err.response?.data?.message || '上传失败，请稍后再试')
  } finally {
    uploading.value = false
  }
}

function clearQueue() {
  for (const item of queue.value) URL.revokeObjectURL(item.previewUrl)
  queue.value = []
  activeKey.value = ''
}

function reset() {
  done.value = false
  progress.value = 0
  submittedCount.value = 0
  clearQueue()
  form.title = ''
  form.description = ''
  form.categoryIds = []
  form.tags = []
  form.tagInput = ''
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyNav)
  clearQueue()
})
</script>

<template>
  <div class="n-container py-10 sm:py-14">
    <!-- success -->
    <div v-if="done" class="mx-auto max-w-xl text-center">
      <div class="mx-auto mb-7 grid h-24 w-24 animate-pop place-items-center rounded-[32px] border-[1.5px] border-ink bg-jade text-paper shadow-[6px_6px_0_0_var(--ink)]">
        <AppIcon name="check" :size="42" :stroke-width="1.8" />
      </div>
      <p class="eyebrow mb-3">Submitted</p>
      <h1 class="display text-[46px] leading-none text-ink">收到了，等审核。</h1>
      <p class="mt-4 text-sm leading-relaxed text-ink-2">
        <template v-if="submittedCount > 1">
          {{ submittedCount }} 张图会作为同一组投稿一起出现：列表里只占一张卡，
          点进去可以左右翻看。管理员看过后就会公开。
        </template>
        <template v-else>
          管理员会尽快看一眼。通过之后，它会出现在发现页和你的主页里。
        </template>
        你可以在「我的作品」里看到审核状态。
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-2">
        <RouterLink to="/profile" class="n-btn n-btn-primary no-underline">看我的作品</RouterLink>
        <button class="n-btn n-btn-outline" @click="reset">再投一组</button>
        <RouterLink :to="{ name: 'studio' }" class="n-btn n-btn-ghost no-underline">
          <AppIcon name="sparkles" :size="14" /> 去做表情包
        </RouterLink>
      </div>
    </div>

    <template v-else>
      <div class="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="eyebrow mb-2">Submit images</p>
          <h1 class="display text-[44px] leading-none text-ink sm:text-[54px]">投一组图</h1>
          <p class="mt-3 max-w-lg text-sm leading-relaxed text-ink-2">
            一次可以放好几张，它们算同一份投稿——列表里只出现一张，详情页左右翻看。
            第一张是封面。上传后需要管理员审核。
          </p>
        </div>
        <div class="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
          <AppIcon name="shield" :size="13" class="text-jade" /> JPEG · PNG · WebP / 单张 ≤ 10MB / 一次 ≤ 9 张
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <!-- dropzone / preview -->
        <div class="lg:sticky lg:top-28">
          <!-- 空队列：大拖拽区 -->
          <div
            v-if="!queue.length"
            class="group relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-[28px] border-[1.5px] border-dashed border-line-strong bg-surface px-6 text-center transition"
            :class="dragging ? '!border-accent bg-accent/5' : 'hover:border-ink/50 hover:bg-surface-2'"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
          >
            <div class="pointer-events-none absolute inset-0 dot-field opacity-20" />
            <div class="relative grid h-20 w-20 place-items-center rounded-[26px] border border-line bg-paper text-ink-2 transition group-hover:-rotate-6 group-hover:border-ink">
              <AppIcon name="upload" :size="30" />
            </div>
            <p class="relative mt-5 font-display text-3xl text-ink">把图拖进来</p>
            <p class="relative mt-2 text-sm text-muted">可以一次选好几张，也可以分几次拖进同一组</p>
            <button class="n-btn n-btn-primary relative mt-6" @click="fileInput?.click()">
              <AppIcon name="image" :size="15" /> 选择图片
            </button>
            <p class="relative mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Up to 9 images · 10MB each</p>
          </div>

          <!-- 有队列：当前预览 + 缩略图条 -->
          <div v-else class="overflow-hidden rounded-[28px] border border-line bg-surface">
            <div
              class="relative flex min-h-[300px] flex-col items-center justify-center bg-[#1a1611] p-4 sm:min-h-[420px]"
              :class="dragging ? 'ring-2 ring-inset ring-accent' : ''"
              @dragover.prevent="dragging = true"
              @dragleave.prevent="dragging = false"
              @drop.prevent="onDrop"
            >
              <img
                v-if="active"
                :src="active.previewUrl"
                alt="预览"
                class="max-h-[52vh] max-w-full rounded-xl object-contain"
              />

              <button
                v-if="active"
                class="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm transition hover:bg-accent"
                aria-label="移除这张图片"
                @click="removeAt(active.key)"
              >
                <AppIcon name="close" :size="16" />
              </button>

              <button
                v-if="active && activeIndex > 0"
                class="absolute left-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/25 bg-black/40 px-3 text-[11px] text-white backdrop-blur-sm transition hover:bg-butter hover:text-[#181510]"
                @click="setCover(active.key)"
              >
                <AppIcon name="star" :size="12" /> 设为封面
              </button>

              <span
                v-if="queue.length > 1"
                class="absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 font-mono text-[9px] text-white/80 backdrop-blur-sm"
              >
                {{ activeIndex + 1 }} / {{ queue.length }}
              </span>

              <!-- 左右翻页：图片两侧，和详情页保持一致的操作方式 -->
              <template v-if="queue.length > 1">
                <button
                  class="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-sm transition hover:bg-white hover:text-[#181510] disabled:cursor-not-allowed disabled:opacity-25"
                  :disabled="!canPrevPreview"
                  aria-label="上一张"
                  @click="stepActive(-1)"
                >
                  <AppIcon name="chevron-left" :size="18" />
                </button>
                <button
                  class="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-sm transition hover:bg-white hover:text-[#181510] disabled:cursor-not-allowed disabled:opacity-25"
                  :disabled="!canNextPreview"
                  aria-label="下一张"
                  @click="stepActive(1)"
                >
                  <AppIcon name="chevron-right" :size="18" />
                </button>
              </template>

              <button
                v-if="queue.length < MAX_BATCH"
                class="absolute bottom-3 left-3 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/25 bg-black/40 px-3 text-[11px] text-white backdrop-blur-sm transition hover:bg-white hover:text-[#181510]"
                @click="fileInput?.click()"
              >
                <AppIcon name="plus" :size="12" /> 再加一张
              </button>
            </div>

            <!-- 缩略图条 -->
            <div class="flex items-center gap-2 overflow-x-auto border-b border-line px-3 py-3 no-scrollbar">
              <button
                v-for="(item, index) in queue"
                :key="item.key"
                class="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition"
                :class="item.key === active?.key ? 'border-ink' : 'border-transparent hover:border-line-strong'"
                :aria-label="`预览第 ${index + 1} 张`"
                @click="activeKey = item.key"
              >
                <img :src="item.previewUrl" alt="" class="h-full w-full object-cover" />
                <span
                  v-if="index === 0"
                  class="absolute left-1 top-1 rounded-full bg-butter px-1.5 py-0.5 font-mono text-[8px] font-semibold text-[#181510]"
                >封面</span>
                <span
                  class="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100"
                  @click.stop="removeAt(item.key)"
                >
                  <AppIcon name="trash" :size="14" />
                </span>
              </button>

              <button
                v-if="queue.length < MAX_BATCH"
                class="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-dashed border-line-strong text-muted transition hover:border-ink hover:text-ink"
                aria-label="继续添加图片"
                @click="fileInput?.click()"
              >
                <AppIcon name="plus" :size="18" />
              </button>
            </div>

            <div class="flex items-center justify-between gap-3 px-4 py-3">
              <p class="min-w-0 truncate text-xs text-ink-2">{{ active?.file.name }}</p>
              <p class="shrink-0 font-mono text-[9px] text-muted">
                共 {{ queue.length }} 张 · {{ (totalSize / 1024 / 1024).toFixed(2) }} MB
              </p>
            </div>
          </div>

          <p class="mt-3 px-1 text-[11px] leading-relaxed text-muted">
            第一张会作为列表里的封面；点缩略图右上角的叉可以移除，或选中后点「设为封面」换一张。
            多张时可以用图片两侧的箭头、键盘 ← / → 切换预览。
          </p>
        </div>

        <!-- form -->
        <div class="rounded-[28px] border border-line bg-surface p-5 sm:p-6">
          <label class="mb-1.5 block text-xs font-medium text-ink-2">标题 <span class="text-accent">*</span></label>
          <input v-model="form.title" class="n-input !rounded-2xl !py-3" maxlength="255" placeholder="给这组图起个名字" />
          <div class="mt-1 text-right font-mono text-[9px] text-muted">{{ form.title.length }} / 255</div>

          <label class="mb-1.5 mt-4 block text-xs font-medium text-ink-2">描述（可选，整组共用）</label>
          <textarea
            v-model="form.description"
            rows="3"
            maxlength="500"
            class="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-ink"
            placeholder="这组图有什么故事？"
          />
          <div class="mt-1 text-right font-mono text-[9px] text-muted">{{ form.description.length }} / 500</div>

          <div class="mt-5">
            <p class="mb-2 text-xs font-medium text-ink-2">分类（最多 3 个，整组共用）</p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="cat in categories"
                :key="cat.id"
                type="button"
                class="n-chip !h-7 !text-[11px]"
                :class="{ 'is-active': form.categoryIds.includes(cat.id) }"
                @click="toggleCategory(cat.id)"
              >
                {{ cat.name }}
              </button>
              <span v-if="!categories?.length" class="text-[11px] text-muted">暂时没有分类，管理员可以在后台添加。</span>
            </div>
          </div>

          <div class="mt-5">
            <p class="mb-2 text-xs font-medium text-ink-2">标签（最多 6 个，回车添加，整组共用）</p>
            <div class="flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-surface px-2 py-2">
              <span v-for="tag in form.tags" :key="tag" class="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] text-paper">
                #{{ tag }}
                <button type="button" class="text-paper/60 hover:text-paper" @click="removeTag(tag)"><AppIcon name="close" :size="10" /></button>
              </span>
              <input
                v-model="form.tagInput"
                class="min-w-[100px] flex-1 bg-transparent px-1 py-1 text-sm text-ink outline-none placeholder:text-muted"
                placeholder="输入后回车"
                maxlength="20"
                @keydown="onTagKeydown"
                @blur="addTag"
              />
            </div>
          </div>

          <div class="mt-5">
            <p class="mb-2 text-xs font-medium text-ink-2">投到哪个展厅</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="rounded-2xl border px-3 py-3 text-left transition"
                :class="!isOther ? 'border-ink bg-ink text-paper' : 'border-line text-ink-2 hover:border-ink/40'"
                @click="isOther = false"
              >
                <span class="flex items-center gap-1.5 text-sm font-semibold"><AppIcon name="sparkles" :size="14" /> 发现页</span>
                <span class="mt-1 block text-[10px] opacity-60">奶龙与相关主题</span>
              </button>
              <button
                type="button"
                class="rounded-2xl border px-3 py-3 text-left transition"
                :class="isOther ? 'border-ink bg-ink text-paper' : 'border-line text-ink-2 hover:border-ink/40'"
                @click="isOther = true"
              >
                <span class="flex items-center gap-1.5 text-sm font-semibold"><AppIcon name="globe" :size="14" /> 其他推荐</span>
                <span class="mt-1 block text-[10px] opacity-60">无关但好看的图</span>
              </button>
            </div>
          </div>

          <div v-if="uploading" class="mt-5">
            <div class="mb-1.5 flex justify-between font-mono text-[9px] text-muted">
              <span>上传中…{{ queue.length > 1 ? `（${queue.length} 张）` : '' }}</span><span>{{ progress }}%</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-line">
              <div class="h-full rounded-full bg-accent transition-all duration-300" :style="{ width: progress + '%' }" />
            </div>
          </div>

          <UiButton variant="primary" size="lg" block :loading="uploading" class="mt-6" @click="submit">
            <AppIcon v-if="!uploading" name="upload" :size="16" />
            {{ uploading ? '正在上传' : `提交审核${queue.length > 1 ? `（${queue.length} 张）` : ''}` }}
          </UiButton>
          <p class="mt-3 text-center text-[10px] leading-relaxed text-muted">
            提交即表示你拥有这些图的发布权。审核通过后整组一起公开。
          </p>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        class="hidden"
        @change="onPick"
      />
    </template>
  </div>
</template>
