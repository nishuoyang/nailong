<script setup lang="ts">
import { ref } from 'vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useToast } from '@/composables/useToast'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const toast = useToast()
const feedback = ref({ subject: '', message: '' })

function close() {
  emit('update:modelValue', false)
  feedback.value = { subject: '', message: '' }
}

function submitFeedback() {
  if (!feedback.value.message.trim()) {
    toast.warning('先写点内容再发送吧')
    return
  }
  const subject = encodeURIComponent(`[奶龙反馈] ${feedback.value.subject || '站点建议'}`)
  const body = encodeURIComponent(feedback.value.message)
  window.open(`mailto:nishuoyang2023@163.com?subject=${subject}&body=${body}`, '_blank')
  toast.success('已打开邮件客户端')
  close()
}
</script>

<template>
  <UiModal :model-value="modelValue" title="意见反馈" width="520px" @update:model-value="emit('update:modelValue', $event)">
    <p class="mb-5 text-sm leading-relaxed text-muted">
      遇到问题、想要新功能，或者只是想夸夸奶龙，都可以写在这里。会直接发到站长的邮箱。
    </p>
    <label class="mb-1.5 block text-xs font-medium text-ink-2">主题</label>
    <input v-model="feedback.subject" class="n-input mb-4" placeholder="一句话概括" maxlength="100" />
    <label class="mb-1.5 block text-xs font-medium text-ink-2">内容</label>
    <textarea
      v-model="feedback.message"
      rows="5"
      maxlength="2000"
      class="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-ink"
      placeholder="请描述你的想法…"
    />
    <div class="mt-5 flex justify-end gap-2">
      <UiButton variant="ghost" @click="close">取消</UiButton>
      <UiButton variant="primary" @click="submitFeedback">发送反馈</UiButton>
    </div>
  </UiModal>
</template>
