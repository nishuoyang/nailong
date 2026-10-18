<script setup lang="ts">
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()
</script>

<template>
  <UiModal :model-value="modelValue" title="用户协议" width="600px" @update:model-value="emit('update:modelValue', $event)">
    <div class="max-h-[58vh] space-y-3 overflow-y-auto pr-1 text-sm leading-relaxed text-ink-2">
      <p>欢迎使用奶龙宇宙（以下简称“本站”）。继续使用即表示你已阅读并同意以下条款。</p>
      <p><strong class="text-ink">一、服务说明</strong><br />本站提供图片浏览、上传、下载、点赞、评论、收藏与表情包制作服务。用户上传内容须遵守国家法律法规，不得上传违法、侵权、暴力、色情或其他不当内容。</p>
      <p><strong class="text-ink">二、用户行为</strong><br />1. 用户对自己上传的内容承担全部责任；2. 禁止上传侵犯他人知识产权、肖像权、隐私权的内容；3. 禁止利用本站进行违法活动或危害平台安全的行为；4. 评论区请保持友善，管理员有权删除不当内容。</p>
      <p><strong class="text-ink">三、内容审核</strong><br />用户上传的图片与个人简介需经管理员审核后方可公开展示。管理员有权拒绝、下架或删除不符合规范的内容，无需事先通知。</p>
      <p><strong class="text-ink">四、知识产权</strong><br />用户保留其上传内容的著作权，并授予本站非独占的展示与分发许可。未经作者许可，其他用户不得将站内内容用于商业用途。</p>
      <p><strong class="text-ink">五、隐私</strong><br />本站不会向第三方出售或分享你的个人信息。评论、收藏夹等功能的公开范围由你自行选择。</p>
      <p><strong class="text-ink">六、免责</strong><br />本站不对用户上传内容的合法性、真实性负责。因用户违反本协议造成的后果，由用户自行承担。本站有权随时修改本协议并公示。</p>
    </div>
    <div class="mt-5 flex justify-end">
      <UiButton variant="primary" @click="emit('update:modelValue', false)">我知道了</UiButton>
    </div>
  </UiModal>
</template>
