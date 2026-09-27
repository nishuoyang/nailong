/**
 * 梗文案库 · 表情包工坊的「灵魂」
 *
 * 设计原则：
 * 1. 每一条都是「上句 + 下句」的成对结构 —— 表情包最经典的两行式排版天生适配。
 * 2. 按情绪分组，用户可以按心情选，也可以掷骰子随机。
 * 3. 全部文案为原创/通用网络口语，不涉及具体真人与敏感话题，适合公开展示的站点氛围。
 * 4. `lore` 组绑定站内已有的「奶龙 / 奶蛙」文化梗（见 /story 专题页），让工具和站点内容互相呼应。
 */
import type { MemeAspect, MemeTemplate } from '@/utils/memeCanvas'

export type MemeMood = 'abstract' | 'midnight' | 'work' | 'food' | 'social' | 'lore' | 'cute'

export interface MemeCopy {
  top: string
  bottom: string
  mood: MemeMood
}

export const MOODS: Array<{ key: MemeMood; label: string; emoji: string }> = [
  { key: 'abstract', label: '抽象', emoji: '🌀' },
  { key: 'midnight', label: '深夜', emoji: '🌙' },
  { key: 'work', label: '摸鱼', emoji: '🐟' },
  { key: 'food', label: '干饭', emoji: '🍜' },
  { key: 'social', label: '社死', emoji: '🫠' },
  { key: 'lore', label: '奶龙梗', emoji: '🐉' },
  { key: 'cute', label: '可爱', emoji: '✨' },
]

export const MEME_COPIES: MemeCopy[] = [
  // ── 抽象 ──
  { top: '我很好', bottom: '只是精神状态进化成了奶蛙', mood: 'abstract' },
  { top: '别人在进步', bottom: '我在进化', mood: 'abstract' },
  { top: '情绪非常稳定', bottom: '稳定地不太正常', mood: 'abstract' },
  { top: '我不懒', bottom: '我只是在节能模式', mood: 'abstract' },
  { top: '打开电脑', bottom: '关掉电脑，一天过去了', mood: 'abstract' },
  { top: '道理我都懂', bottom: '但我不听', mood: 'abstract' },
  { top: '不要安慰我', bottom: '我已经开始捧腹大笑了', mood: 'abstract' },
  { top: '我思考了一下', bottom: '决定不思考了', mood: 'abstract' },
  { top: '今天状态很好', bottom: '好到有点不真实', mood: 'abstract' },
  { top: '我这种人', bottom: '属于稀有物种', mood: 'abstract' },
  { top: '你说的对', bottom: '但我选择快乐', mood: 'abstract' },
  { top: '世界很复杂', bottom: '我决定先笑一会', mood: 'abstract' },

  // ── 深夜 ──
  { top: '再刷五分钟', bottom: '天亮了', mood: 'midnight' },
  { top: '晚安', bottom: '凌晨三点的我：再看一个就睡', mood: 'midnight' },
  { top: '今天一定早睡', bottom: '（这句话昨天也说过了）', mood: 'midnight' },
  { top: '深夜的我', bottom: '比白天的我清醒一万倍', mood: 'midnight' },
  { top: '手机只剩下 3%', bottom: '我和它一起硬撑', mood: 'midnight' },
  { top: '凌晨两点', bottom: '突然想起十年前的尴尬事', mood: 'midnight' },
  { top: '该睡了', bottom: '可是这个视频只有十分钟', mood: 'midnight' },
  { top: '熬夜有害健康', bottom: '但我喜欢有害的东西', mood: 'midnight' },

  // ── 摸鱼 / 工作 ──
  { top: '正在努力工作', bottom: '（努力找机会摸鱼）', mood: 'work' },
  { top: '收到', bottom: '（已读，不打算回）', mood: 'work' },
  { top: '需求很简单', bottom: '改一下就好了', mood: 'work' },
  { top: '这个周五上线', bottom: '下个周五再说', mood: 'work' },
  { top: '我在开会', bottom: '其实在发呆', mood: 'work' },
  { top: '周一的我', bottom: '和周五的我，不是同一个人', mood: 'work' },
  { top: '上班如上坟', bottom: '下班如重生', mood: 'work' },
  { top: '我的效率很高', bottom: '高峰期在下午五点五十九', mood: 'work' },
  { top: '这个我熟', bottom: '（其实完全不会）', mood: 'work' },
  { top: '先这样吧', bottom: '能跑就行', mood: 'work' },

  // ── 干饭 ──
  { top: '减肥从明天开始', bottom: '明天的我：先吃饱才有力气减', mood: 'food' },
  { top: '就吃一口', bottom: '一口之后：这盘还有救吗', mood: 'food' },
  { top: '我不饿', bottom: '只是嘴巴有点寂寞', mood: 'food' },
  { top: '夜宵是罪恶的', bottom: '但罪恶很香', mood: 'food' },
  { top: '今天吃清淡点', bottom: '（点了三份肉）', mood: 'food' },
  { top: '干饭人', bottom: '干饭魂，干饭都是人上人', mood: 'food' },
  { top: '我控制得住', bottom: '（手里的筷子不听使唤）', mood: 'food' },
  { top: '这顿我请', bottom: '下顿你请，上顿也算你的', mood: 'food' },

  // ── 社死 ──
  { top: '我以为我很正常', bottom: '直到我看见了聊天记录', mood: 'social' },
  { top: '人群中我最靓', bottom: '（衣服穿反了）', mood: 'social' },
  { top: '刚刚那个是我吗', bottom: '我希望不是', mood: 'social' },
  { top: '我在群里发了什么', bottom: '撤回还来得及吗', mood: 'social' },
  { top: '打招呼最怕', bottom: '对方没认出我', mood: 'social' },
  { top: '我社恐', bottom: '但你叫我吃饭我立刻就到', mood: 'social' },
  { top: '礼貌的笑容', bottom: '背后是崩溃的内心', mood: 'social' },
  { top: '刚才那句是玩笑', bottom: '请当我没说过', mood: 'social' },

  // ── 奶龙梗（与站内 /story 专题呼应）──
  { top: '这是奶龙', bottom: '这是奶蛙，别搞混了', mood: 'lore' },
  { top: '我只是路过', bottom: '顺手捧腹大笑了一下', mood: 'lore' },
  { top: '卡痰音已加载', bottom: '正在播放：BABY DON\u2019T CRY', mood: 'lore' },
  { top: '官方说它很可爱', bottom: '我们把它变成了抽象神', mood: 'lore' },
  { top: '失传媒体', bottom: '其实一直躺在我手机里', mood: 'lore' },
  { top: '名画二创', bottom: '《蒙娜丽莎》看了都沉默', mood: 'lore' },
  { top: '奶龙的粉丝', bottom: '其实是奶蛙的卧底', mood: 'lore' },
  { top: '传说级笑声', bottom: '听过的人都会变声', mood: 'lore' },
  { top: '一图三连', bottom: '收藏、转发、做成表情包', mood: 'lore' },
  { top: '考古学家', bottom: '正在考证这张图的出处', mood: 'lore' },

  // ── 可爱 ──
  { top: '我超凶的', bottom: '凶起来连自己都怕', mood: 'cute' },
  { top: '今天也很想你', bottom: '（只是想你的图库）', mood: 'cute' },
  { top: '你好呀', bottom: '我今天也很可爱', mood: 'cute' },
  { top: '抱抱', bottom: '不抱也行，看着也行', mood: 'cute' },
  { top: '我不生气', bottom: '我只是需要一杯奶茶', mood: 'cute' },
  { top: '小小一只', bottom: '但是脾气很大', mood: 'cute' },
  { top: '被自己可爱到', bottom: '这句话我每天说三次', mood: 'cute' },
  { top: '摸摸头', bottom: '今天也辛苦啦', mood: 'cute' },
]

/** 贴纸库：按主题分组，兼顾情绪表达与站内文化 */
export const STICKER_GROUPS: Array<{ label: string; items: string[] }> = [
  { label: '情绪', items: ['😂', '🤣', '😭', '🥹', '🫠', '😵', '🤡', '😎', '🥲', '😤', '🫡', '😇'] },
  { label: '奶龙', items: ['🐉', '🐸', '🍼', '🥛', '💨', '🎬', '📸', '🔍', '🧪', '📜', '👑', '🌀'] },
  { label: '加强', items: ['🔥', '💥', '✨', '❗', '❓', '💯', '⚡', '🎉', '💀', '👀', '🫧', '🌈'] },
  { label: '日常', items: ['🍜', '🍚', '🧋', '☕', '🛌', '💤', '📉', '📈', '🧠', '💧', '🌙', '🍰'] },
]

export const ALL_STICKERS: string[] = STICKER_GROUPS.flatMap((g) => g.items)

/** 按情绪挑一条；mood 省略时全库随机 */
export function randomCopy(mood?: MemeMood): MemeCopy {
  const pool = mood ? MEME_COPIES.filter((c) => c.mood === mood) : MEME_COPIES
  const list = pool.length > 0 ? pool : MEME_COPIES
  return list[Math.floor(Math.random() * list.length)]
}

export function randomSticker(): string {
  return ALL_STICKERS[Math.floor(Math.random() * ALL_STICKERS.length)]
}

/** 「给我灵感」用的一句话标语，随机展示在工具栏，给用户一点情绪价值 */
export const HINTS: string[] = [
  '秘诀：字越少，越像真的',
  '经典两行式：上面抛梗，下面接住',
  '试试把文字拖到脸上，效果立刻不一样',
  '贴纸别超过三个，克制才高级',
  '滤镜选「胶片」，谁用谁知道',
  '字号拉到最大，梗的分量就上来了',
  '左边图库点一下就能换底图，别客气',
  '按 1~7 直接换版式，Ctrl+S 直接下载',
]

/**
 * 梗图配方 —— 「一键出片」
 *
 * 和「随机灵感」的区别：这里是**人工调好的成品配方**，版式、比例、滤镜、文案、
 * 贴纸位置都是配好的，点一下就是一张可以直接发出去的图。
 * 这也是这个工具最讨喜的地方：用户不需要先学会怎么排版，先出片，再改。
 */
export interface MemeRecipe {
  id: string
  name: string
  emoji: string
  /** 一句话说明这张图会成为什么样子 */
  desc: string
  template: MemeTemplate
  aspect: MemeAspect
  /** 滤镜预设 key，见 utils/memeCanvas.ts 的 FILTER_PRESETS */
  filter: string
  texts: Partial<Record<'top' | 'bottom' | 'free', string>>
  stickers?: Array<{ emoji: string; x: number; y: number; size: number }>
}

export const MEME_RECIPES: MemeRecipe[] = [
  {
    id: 'abstract-god',
    name: '抽象成神',
    emoji: '🌀',
    desc: '大字报 + 一句话糊满画面，音量拉满',
    template: 'poster',
    aspect: '4:5',
    filter: 'punch',
    texts: { free: '我已抽象', bottom: '不要试图理解我' },
    stickers: [{ emoji: '🌀', x: 0.82, y: 0.22, size: 150 }],
  },
  {
    id: 'laugh',
    name: '捧腹大笑',
    emoji: '😂',
    desc: '拍立得相纸 + 落款，像一张洗出来的照片',
    template: 'polaroid',
    aspect: '4:5',
    filter: 'film',
    texts: { bottom: '笑到打鸣' },
    stickers: [{ emoji: '😂', x: 0.78, y: 0.66, size: 170 }],
  },
  {
    id: 'midnight',
    name: '深夜 emo',
    emoji: '🌙',
    desc: '黑白金句卡，凌晨三点的味道',
    template: 'quote',
    aspect: '4:5',
    filter: 'mono',
    texts: { free: '凌晨三点的我：\n再看一个就睡', bottom: '—— 每一个熬夜的人' },
  },
  {
    id: 'slack',
    name: '摸鱼现场',
    emoji: '🐟',
    desc: '一来一回两个气泡，像一段真的聊天记录',
    template: 'chat',
    aspect: '4:5',
    filter: 'none',
    texts: { top: '在忙吗？', bottom: '在忙（在摸鱼）' },
  },
  {
    id: 'eat',
    name: '干饭宣言',
    emoji: '🍜',
    desc: '左上标签 + 底部大字，立场非常明确',
    template: 'tag',
    aspect: '1:1',
    filter: 'warm',
    texts: { top: '干饭人', bottom: '先吃饱才有力气减肥' },
    stickers: [{ emoji: '🍜', x: 0.8, y: 0.24, size: 150 }],
  },
  {
    id: 'lostmedia',
    name: '失传媒体',
    emoji: '🔍',
    desc: '高反差金句卡，一本正经地考据',
    template: 'quote',
    aspect: '16:9',
    filter: 'punch',
    texts: { free: '失传媒体：\n其实一直躺在我手机里', bottom: '—— 考古学家本人' },
  },
  {
    id: 'cute',
    name: '被自己可爱到',
    emoji: '✨',
    desc: '底部字幕条，轻轻一句旁白',
    template: 'caption',
    aspect: '4:5',
    filter: 'vivid',
    texts: { bottom: '今天也很可爱' },
    stickers: [{ emoji: '✨', x: 0.2, y: 0.2, size: 130 }],
  },
  {
    id: 'classic-two',
    name: '经典两行',
    emoji: '🅰️',
    desc: '最原教旨的梗图：上面抛梗，下面接住',
    template: 'classic',
    aspect: 'auto',
    filter: 'none',
    texts: { top: '我很好', bottom: '只是精神状态进化成了奶蛙' },
  },
]

