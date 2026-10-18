<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { getCategories } from '@/api/images'
import { uploadImage } from '@/api/upload'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiButton from '@/components/ui/UiButton.vue'

const route = useRoute()
const toast = useToast()

const isOther = ref(route.query.section === 'other')
const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const dragging = ref(false)
const uploading = ref(false)
const progress = ref(0)
const done = ref(false)
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

function revokePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
}

function acceptFile(next: File | null | undefined) {
  if (!next) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
    toast.error('只支持 JPEG、PNG、WebP')
    return
  }
  if (next.size > 10 * 1024 * 1024) {
    toast.error('文件不能超过 10MB')
    return
  }
  revokePreview()
  file.value = next
  previewUrl.value = URL.createObjectURL(next)
  if (!form.title) {
    form.title = next.name.replace(/\.[^.]+$/, '').slice(0, 60)
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
  if (!file.value) {
    toast.warning('先选一张图')
    return
  }
  if (!form.title.trim()) {
    toast.warning('给图片起个标题')
    return
  }
  uploading.value = true
  progress.value = 0
  try {
    const data = new FormData()
    data.append('file', file.value)
    data.append('title', form.title.trim())
    if (form.description.trim()) data.append('description', form.description.trim())
    if (form.categoryIds.length) data.append('categoryIds', JSON.stringify(form.categoryIds))
    if (form.tags.length) data.append('tags', form.tags.join(','))
    if (isOther.value) data.append('section', 'other')

    await uploadImage(data, (percent) => (progress.value = percent))
    progress.value = 100
    done.value = true
    toast.success('上传成功，等待审核')
  } catch (err: any) {
    toast.error(err.response?.data?.message || '上传失败，请稍后再试')
  } finally {
    uploading.value = false
  }
}

function reset() {
  done.value = false
  progress.value = 0
  removeFile()
  form.title = ''
  form.description = ''
  form.categoryIds = []
  form.tags = []
  form.tagInput = ''
}

onBeforeUnmount(revokePreview)
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
        管理员会尽快看一眼。通过之后，它会出现在发现页和你的主页里。
        你可以在「我的作品」里看到审核状态。
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-2">
        <RouterLink to="/profile" class="n-btn n-btn-primary no-underline">看我的作品</RouterLink>
        <button class="n-btn n-btn-outline" @click="reset">再传一张</button>
        <RouterLink :to="{ name: 'studio' }" class="n-btn n-btn-ghost no-underline">
          <AppIcon name="sparkles" :size="14" /> 去做表情包
        </RouterLink>
      </div>
    </div>

    <template v-else>
      <div class="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="eyebrow mb-2">Submit an image</p>
          <h1 class="display text-[44px] leading-none text-ink sm:text-[54px]">投一张图</h1>
          <p class="mt-3 max-w-lg text-sm leading-relaxed text-ink-2">
            好图不该只躺在相册里。上传后需要管理员审核，通过后就会公开。
          </p>
        </div>
        <div class="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
          <AppIcon name="shield" :size="13" class="text-jade" /> JPEG · PNG · WebP / ≤ 10MB
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <!-- dropzone / preview -->
        <div class="lg:sticky lg:top-28">
          <div
            v-if="!file"
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
            <p class="relative mt-2 text-sm text-muted">或者点下面的按钮选一张</p>
            <button class="n-btn n-btn-primary relative mt-6" @click="fileInput?.click()">
              <AppIcon name="image" :size="15" /> 选择图片
            </button>
            <p class="relative mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">One image at a time · max 10MB</p>
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onPick" />
          </div>

          <div v-else class="overflow-hidden rounded-[28px] border border-line bg-surface">
            <div class="relative grid min-h-[300px] place-items-center bg-[#1a1611] p-4 sm:min-h-[420px]">
              <img v-if="previewUrl" :src="previewUrl" alt="预览" class="max-h-[52vh] max-w-full rounded-xl object-contain" />
              <button class="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm transition hover:bg-accent" aria-label="移除图片" @click="removeFile">
                <AppIcon name="close" :size="16" />
              </button>
            </div>
            <div class="flex items-center justify-between gap-3 px-4 py-3">
              <p class="min-w-0 truncate text-xs text-ink-2">{{ file.name }}</p>
              <p class="shrink-0 font-mono text-[9px] text-muted">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</p>
            </div>
          </div>
        </div>

        <!-- form -->
        <div class="rounded-[28px] border border-line bg-surface p-5 sm:p-6">
          <label class="mb-1.5 block text-xs font-medium text-ink-2">标题 <span class="text-accent">*</span></label>
          <input v-model="form.title" class="n-input !rounded-2xl !py-3" maxlength="255" placeholder="给这张图起个名字" />
          <div class="mt-1 text-right font-mono text-[9px] text-muted">{{ form.title.length }} / 255</div>

          <label class="mb-1.5 mt-4 block text-xs font-medium text-ink-2">描述（可选）</label>
          <textarea
            v-model="form.description"
            rows="3"
            maxlength="500"
            class="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-ink"
            placeholder="这张图有什么故事？"
          />
          <div class="mt-1 text-right font-mono text-[9px] text-muted">{{ form.description.length }} / 500</div>

          <div class="mt-5">
            <p class="mb-2 text-xs font-medium text-ink-2">分类（最多 3 个）</p>
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
            <p class="mb-2 text-xs font-medium text-ink-2">标签（最多 6 个，回车添加）</p>
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
              <span>上传中…</span><span>{{ progress }}%</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-line">
              <div class="h-full rounded-full bg-accent transition-all duration-300" :style="{ width: progress + '%' }" />
            </div>
          </div>

          <UiButton variant="primary" size="lg" block :loading="uploading" class="mt-6" @click="submit">
            <AppIcon v-if="!uploading" name="upload" :size="16" />
            {{ uploading ? '正在上传' : '提交审核' }}
          </UiButton>
          <p class="mt-3 text-center text-[10px] leading-relaxed text-muted">
            提交即表示你拥有这张图的发布权。审核通过后公开显示。
          </p>
        </div>
      </div>
    </template>
  </div>
</template>