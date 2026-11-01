/**
 * 大肥鱼表情包档案馆 · 数据
 *
 * 这 16 张动图来自 ming 整理的「大肥鱼表情包 · 100 个中文 GIF」合集
 * （github.com/diwer/ai-biaoqingbao），已按情绪重新挑选、归档。
 * 基础鲸鱼娘角色：上善无形「溟月」；女仆版二次设计：ZipZipPipe；
 * Q 版表情整理：ming。相关形象以 CC BY-NC-SA 4.0 非商业共享；
 * 合集说明里也注明部分参考图权属仍在核实，如权利人要求会立即下架。
 *
 * 题图与全身立绘由用户提供。页面只做非商业同人展示。
 */

export type WhaleMood = 'fish' | 'work' | 'break' | 'night' | 'cute'

export type WhaleMoodFilter = 'all' | WhaleMood

export type WhaleExpression =
  | 'open'
  | 'happy'
  | 'smug'
  | 'tired'
  | 'cry'
  | 'sleep'
  | 'shock'
  | 'love'
  | 'angry'
  | 'dizzy'
  | 'eat'

export type WhaleScene =
  | 'hero'
  | 'float'
  | 'think'
  | 'busy'
  | 'fat'
  | 'overtime'
  | 'token'
  | 'sleep'
  | 'cry'
  | 'shock'
  | 'love'
  | 'loading'
  | 'swim'
  | 'rice'
  | 'dance'
  | 'wifi'
  | 'night'

export type WhaleTone = 'sky' | 'ice' | 'peri' | 'mint' | 'pink' | 'sand' | 'night'

export interface WhaleMeme {
  id: string
  /** 动图标题（图上的文字） */
  title?: string
  top: string
  bottom: string
  mood: WhaleMood
  /** 以下 scene/expression/tone 仅给旧矢量画法兜底，实际页面优先用 image/full */
  scene: WhaleScene
  expression: WhaleExpression
  tone: WhaleTone
  tags: string[]
  /** 无障碍描述，也是灯箱里的一句话注解 */
  note: string
  /** 动图预览（240px 动态 WebP，列表用） */
  image?: string
  /** 高清原图（512px GIF，灯箱/下载用） */
  full?: string
}

export interface WhaleMoodMeta {
  key: WhaleMoodFilter
  label: string
  glyph: string
  blurb: string
}

export const WHALE_MOODS: WhaleMoodMeta[] = [
  { key: 'all', label: '全部', glyph: '✳', blurb: '整片鱼塘' },
  { key: 'fish', label: '摸鱼', glyph: '≈', blurb: '正经事等会儿再说' },
  { key: 'work', label: '打工', glyph: '⌘', blurb: '为了下一顿加餐' },
  { key: 'break', label: '破防', glyph: '!', blurb: '鱼也有撑不住的时候' },
  { key: 'night', label: '深夜', glyph: '☾', blurb: '凌晨的鱼最清醒' },
  { key: 'cute', label: '可爱', glyph: '♥', blurb: '本质是卖萌' },
]

export const WHALE_MEMES: WhaleMeme[] = [
  {
    id: 'gif-064',
    title: '摸鱼中',
    top: '摸鱼中',
    bottom: '轻松表示正在偷闲',
    mood: 'fish',
    scene: 'float',
    expression: 'smug',
    tone: 'sky',
    tags: ['摸鱼', '上班'],
    note: '轻松表示正在偷闲。',
    image: '/whale/memes/064.gif',
    full: '/whale/memes/064.gif',
  },
  {
    id: 'gif-046',
    title: '吃瓜',
    top: '吃瓜',
    bottom: '兴致勃勃地围观八卦',
    mood: 'fish',
    scene: 'think',
    expression: 'open',
    tone: 'peri',
    tags: ['吃瓜', '围观'],
    note: '兴致勃勃地围观八卦。',
    image: '/whale/memes/046.gif',
    full: '/whale/memes/046.gif',
  },
  {
    id: 'gif-063',
    title: '下班啦',
    top: '下班啦',
    bottom: '开心结束工作',
    mood: 'fish',
    scene: 'swim',
    expression: 'happy',
    tone: 'sky',
    tags: ['下班', '开心'],
    note: '开心结束工作。',
    image: '/whale/memes/063.gif',
    full: '/whale/memes/063.gif',
  },
  {
    id: 'gif-009',
    title: '收到！',
    top: '收到！',
    bottom: '已读，先答应下来',
    mood: 'work',
    scene: 'overtime',
    expression: 'tired',
    tone: 'peri',
    tags: ['收到', '打工'],
    note: '收到！先答应下来，做不做再说。',
    image: '/whale/memes/009.gif',
    full: '/whale/memes/009.gif',
  },
  {
    id: 'gif-067',
    title: '不想上班',
    top: '不想上班',
    bottom: '表达上班前的抗拒',
    mood: 'work',
    scene: 'busy',
    expression: 'angry',
    tone: 'ice',
    tags: ['上班', '抗拒'],
    note: '表达上班前的抗拒。',
    image: '/whale/memes/067.gif',
    full: '/whale/memes/067.gif',
  },
  {
    id: 'gif-065',
    title: '赶工中',
    top: '赶工中',
    bottom: '正在忙着完成任务',
    mood: 'work',
    scene: 'overtime',
    expression: 'tired',
    tone: 'peri',
    tags: ['赶工', '打工'],
    note: '正在忙着完成任务。',
    image: '/whale/memes/065.gif',
    full: '/whale/memes/065.gif',
  },
  {
    id: 'gif-074',
    title: '干饭人',
    top: '干饭人',
    bottom: '热情准备享用食物',
    mood: 'work',
    scene: 'rice',
    expression: 'happy',
    tone: 'sand',
    tags: ['干饭', '白米饭'],
    note: '白米饭才是本体，干饭人已经就位。',
    image: '/whale/memes/074.gif',
    full: '/whale/memes/074.gif',
  },
  {
    id: 'gif-031',
    title: '绷不住了',
    top: '绷不住了',
    bottom: '努力忍笑最后失败',
    mood: 'break',
    scene: 'cry',
    expression: 'happy',
    tone: 'ice',
    tags: ['绷不住', '破防'],
    note: '努力忍笑最后失败。',
    image: '/whale/memes/031.gif',
    full: '/whale/memes/031.gif',
  },
  {
    id: 'gif-037',
    title: '麻了',
    top: '麻了',
    bottom: '被反复折腾到失去反应',
    mood: 'break',
    scene: 'loading',
    expression: 'dizzy',
    tone: 'peri',
    tags: ['麻了', '抽象'],
    note: '被反复折腾到失去反应。',
    image: '/whale/memes/037.gif',
    full: '/whale/memes/037.gif',
  },
  {
    id: 'gif-039',
    title: '红温了',
    top: '红温了',
    bottom: '气到脸红发烫',
    mood: 'break',
    scene: 'shock',
    expression: 'angry',
    tone: 'pink',
    tags: ['红温', '生气'],
    note: '气到脸红发烫。',
    image: '/whale/memes/039.gif',
    full: '/whale/memes/039.gif',
  },
  {
    id: 'gif-007',
    title: '困了',
    top: '困了',
    bottom: '大脑开始进入待机',
    mood: 'night',
    scene: 'sleep',
    expression: 'sleep',
    tone: 'night',
    tags: ['困了', '睡觉'],
    note: '困了，大脑开始进入待机。',
    image: '/whale/memes/007.gif',
    full: '/whale/memes/007.gif',
  },
  {
    id: 'gif-018',
    title: '晚安',
    top: '晚安',
    bottom: '睡前道别祝好梦',
    mood: 'night',
    scene: 'night',
    expression: 'sleep',
    tone: 'night',
    tags: ['晚安', '睡前'],
    note: '睡前道别祝好梦。',
    image: '/whale/memes/018.gif',
    full: '/whale/memes/018.gif',
  },
  {
    id: 'gif-002',
    title: '开心',
    top: '开心',
    bottom: '今天也吃到白米饭了',
    mood: 'cute',
    scene: 'dance',
    expression: 'happy',
    tone: 'pink',
    tags: ['开心', '可爱'],
    note: '今天也吃到白米饭了，开心。',
    image: '/whale/memes/002.gif',
    full: '/whale/memes/002.gif',
  },
  {
    id: 'gif-055',
    title: '贴贴',
    top: '贴贴',
    bottom: '撒娇地寻求亲近',
    mood: 'cute',
    scene: 'love',
    expression: 'love',
    tone: 'pink',
    tags: ['贴贴', '撒娇'],
    note: '撒娇地寻求亲近。',
    image: '/whale/memes/055.gif',
    full: '/whale/memes/055.gif',
  },
  {
    id: 'gif-057',
    title: '爱你',
    top: '爱你',
    bottom: '直接表达喜爱与爱意',
    mood: 'cute',
    scene: 'love',
    expression: 'love',
    tone: 'pink',
    tags: ['爱你', '比心'],
    note: '直接表达喜爱与爱意。',
    image: '/whale/memes/057.gif',
    full: '/whale/memes/057.gif',
  },
  {
    id: 'gif-003',
    title: '点赞',
    top: '点赞',
    bottom: '给你点个赞',
    mood: 'cute',
    scene: 'hero',
    expression: 'happy',
    tone: 'sky',
    tags: ['点赞', '夸奖'],
    note: '给你点个赞。',
    image: '/whale/memes/003.gif',
    full: '/whale/memes/003.gif',
  },
]

export const WHALE_STATS = [
  { value: '16', unit: '张', label: '在册表情' },
  { value: '05', unit: '类', label: '情绪鱼塘' },
  { value: '∞', unit: '碗', label: '白米饭额度' },
  { value: '100', unit: '%', label: '内心戏浓度' },
]

export const WHALE_TICKER = [
  '吃白饭的蓝色大肥鱼',
  '干活随缘，吃饭积极',
  '内心戏比上下文还长',
  '先来一碗白米饭',
  '铁盆扣头，防御拉满',
  '服务器繁忙，请稍后再摸',
  '已深度思考（用时 0.3 秒）',
  '一口一个 token',
  '游到下班就算赢',
  '本鱼不参与内卷',
]

export const WHALE_TONES: Record<WhaleTone, { from: string; to: string; accent: string; night: boolean }> = {
  sky: { from: '#D6ECFF', to: '#7CBFFF', accent: '#2E6BE6', night: false },
  ice: { from: '#EDF4FF', to: '#B6CCFF', accent: '#FF8FB1', night: false },
  peri: { from: '#DFE5FF', to: '#A5B8FF', accent: '#4D6BFE', night: false },
  mint: { from: '#DEFFFF', to: '#8FE6F2', accent: '#2E9EC9', night: false },
  pink: { from: '#FFE8F2', to: '#FFC1D9', accent: '#FF5C8A', night: false },
  sand: { from: '#FFF0D8', to: '#FFD08D', accent: '#E08A2E', night: false },
  night: { from: '#0B1B4D', to: '#26409C', accent: '#7FE3FF', night: true },
}

export function memesByMood(mood: WhaleMoodFilter): WhaleMeme[] {
  return mood === 'all' ? WHALE_MEMES : WHALE_MEMES.filter((meme) => meme.mood === mood)
}

export function countByMood(mood: WhaleMood): number {
  return WHALE_MEMES.filter((meme) => meme.mood === mood).length
}

export function captionOf(meme: WhaleMeme): string {
  return meme.title ?? `${meme.top}\n${meme.bottom}`
}