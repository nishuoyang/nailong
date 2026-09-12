<script setup lang="ts">
import { ref } from 'vue'

// 意见反馈弹窗（待办 #4 懒加载，2026-09-12）
//
// 从 AppLayout.vue 抽出：AppLayout 是每个页面都常驻的布局组件，内联弹窗会让
// el-dialog/el-form/el-form-item/el-input/el-button 全部进入首屏 eager 图。
// 独立成块 + defineAsyncComponent 后，这五个组件只在用户点开「📧」时才下载。
// 本组件通过 v-model 与父组件共享开关状态，自己的表单状态不外泄。
defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const feedback = ref({ subject: '', message: '' })

function close() {
  emit('update:modelValue', false)
  feedback.value = { subject: '', message: '' }
}

function submitFeedback() {
  const subject = encodeURIComponent(`[奶龙反馈] ${feedback.value.subject}`)
  const body = encodeURIComponent(feedback.value.message)
  window.open(`mailto:nishuoyang2023@163.com?subject=${subject}&body=${body}`, '_blank')
  close()
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="意见反馈"
    width="480px"
    @update:model-value="close"
  >
    <el-form label-position="top">
      <el-form-item label="主题">
        <el-input v-model="feedback.subject" placeholder="请输入反馈主题" maxlength="100" />
      </el-form-item>
      <el-form-item label="内容">
        <el-input
          v-model="feedback.message"
          type="textarea"
          :rows="5"
          placeholder="请描述您的意见或建议..."
          maxlength="2000"
          show-word-limit
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" @click="submitFeedback">发送反馈</el-button>
    </template>
  </el-dialog>
</template>