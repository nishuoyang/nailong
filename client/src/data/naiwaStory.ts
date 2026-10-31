/**
 * 奶蛙史（又名：奶娃史）内容数据层。
 *
 * 原则：
 * 1. 每条事实都带 sources，正文用 [S1] / [V1] 形式回链；
 * 2. 证据等级分为 confirmed / reported / contested / myth，页面上显式标注；
 * 3. 不收录无法核实的“律师函细节”“创作者身份”等隐私信息；
 * 4. B 站数据通过公开 API 于 2026-10-31 核验，播放量会随时间变化。
 */

export type EvidenceLevel = 'confirmed' | 'reported' | 'contested' | 'myth'

export interface EvidenceMeta {
  label: string
  short: string
  tone: string
  hint: string
}

export const evidenceMeta: Record<EvidenceLevel, EvidenceMeta> = {
  confirmed: {
    label: '已确证',
    short: '确证',
    tone: 'border-jade/35 bg-jade/10 text-jade',
    hint: '有直接物证或多个独立来源交叉印证。',
  },
  reported: {
    label: '媒体报道',
    short: '报道',
    tone: 'border-sky/35 bg-sky/10 text-sky',
    hint: '来自可信媒体或当事人的公开叙述，但仍是单一线索。',
  },
  contested: {
    label: '仍有争议',
    short: '争议',
    tone: 'border-butter/50 bg-butter/15 text-ink-2',
    hint: '存在反例或互相矛盾的说法，本页保留不同解释。',
  },
  myth: {
    label: '已辟谣',
    short: '辟谣',
    tone: 'border-rose/40 bg-rose/10 text-rose',
    hint: '流传很广，但现有证据不支持，甚至直接相反。',
  },
}

export type SourceKind = 'media' | 'wiki' | 'video' | 'platform' | 'community'

export interface StorySource {
  id: string
  title: string
  publisher: string
  date: string
  url: string
  kind: SourceKind
  reliability: string
  note?: string
}

export const sourceKindLabel: Record<SourceKind, string> = {
  media: '媒体报道',
  wiki: '考据社区',
  video: '影像档案',
  platform: '平台页面',
  community: '社区文本',
}

export const sources: StorySource[] = [
  {
    id: 'S1',
    title: '奶龙（中国动画短片创作者）',
    publisher: '百度百科',
    date: '持续更新',
    url: 'https://wapbaike.baidu.com/item/%E5%A5%B6%E9%BE%99/64161212',
    kind: 'media',
    reliability: '百科条目，适合核对作品与时间，不宜作为唯一依据',
    note: '本页用它核对奶龙的出道时间、早期爆款、表情包与番剧节点。',
  },
  {
    id: 'S2',
    title: '“奶龙”出圈启示录：低龄 IP 的文旅变现密码',
    publisher: '澎湃新闻 · 骨朵网络影视',
    date: '2025-04-30',
    url: 'https://m.thepaper.cn/newsDetail_forward_30748412',
    kind: 'media',
    reliability: '行业媒体，数据来自公开报道与受访方',
    note: '3600 万全网粉丝、百亿播放、深圳/贵阳巨型气膜等数据出自此文。',
  },
  {
    id: 'S3',
    title: '奶蛙（来源确定的奶龙恶搞图片；2024 年）· 归档页',
    publisher: '失传媒体中文维基',
    date: '2026-08-22 归档',
    url: 'https://lostmedia.wikidot.com/deleted:naiwa',
    kind: 'wiki',
    reliability: '社区考据，已归档；保留最早一版结论',
    note: '归档页仍保留“来源已确认”的结论与 2024-12 首个传播节点。',
  },
  {
    id: 'S4',
    title: '奶蛙（部分确定来源的奶龙恶搞图片；2024 年）',
    publisher: '失传媒体中文维基',
    date: '2026-10-08 最后编辑',
    url: 'https://lostmedia.wikidot.com/naiwa-cx',
    kind: 'wiki',
    reliability: '社区考据，证据链最完整，但自标“待改进 / 来源缺失”',
    note: '本页的 2024-10-02、zNCvQDKfXy、2026-08-04 等关键节点主要依据此页；它也明确提醒“请勿打扰纲手【百豪】本人”。',
  },
  {
    id: 'S5',
    title: '人们找到了奶蛙的创造者，但故事却迎来最残酷的结局',
    publisher: '手谈姬 · 观察者网风闻（另见新浪新闻转载）',
    date: '2026-09-08',
    url: 'https://user.guancha.cn/main/content?id=1732088',
    kind: 'media',
    reliability: '自媒体深度稿，叙述性强，部分措辞为修辞',
    note: '“播放过亿”“终生不得与自己的造物相认”等句子出自此文，本页按“媒体报道”标注。',
  },
  {
    id: 'S6',
    title: '2026 第一猎奇梗“大笑奶龙”，让奶龙官方账号关闭了评论区',
    publisher: '3DM 游戏网 · 网易号',
    date: '2026-01-15',
    url: 'https://www.163.com/dy/article/KJA7J2UR0526D8LR.html',
    kind: 'media',
    reliability: '游戏媒体报道，含当事账号与截图线索',
    note: '季洪行、八级哥、老水牛变声器、官方回复与“十万点赞五条评论”均出自此文。',
  },
  {
    id: 'S7',
    title: '流动奶蛙，大学最好的招生简章',
    publisher: '3DM 游戏网 · 虎嗅转载',
    date: '2026-10-01',
    url: 'https://www.huxiu.com/article/4895021.html',
    kind: 'media',
    reliability: '游戏媒体观察稿，含学生投稿与平台截图',
    note: '“近百所高校”“立牌背面手写通知”“川农搬牛”对比出自此文。',
  },
  {
    id: 'S8',
    title: '没有版权的黄色奶蛙立牌，成了 2026 大学校园最火的打卡点',
    publisher: '游民星空 · 转载自微信公众号“小灰匣”',
    date: '2026-10-11',
    url: 'https://club.gamersky.com/activity/1604495',
    kind: 'media',
    reliability: '转载稿，观点明确，事实细节可与 S7 交叉',
    note: '“不属于任何人，也因此属于所有人”与形象描述出自此文。',
  },
  {
    id: 'S9',
    title: '比奶龙还“野”，表情包正式进入大奶蛙时代',
    publisher: '新周刊 · 搜狐',
    date: '2026-10-23',
    url: 'https://m.sohu.com/coo/zmtq/1091840471_100024718',
    kind: 'media',
    reliability: '杂志媒体文化观察',
    note: '高校立牌、港台/北美校园、“社交货币”判断出自此文。',
  },
  {
    id: 'S10',
    title: '继奶蛙、牛来后，这群神秘的黄色生物开始变得越发邪门',
    publisher: '4399 盒饭の日常',
    date: '2026-09-09',
    url: 'https://bbs.4399.cn/thread-tid-54096268',
    kind: 'community',
    reliability: '论坛精华帖，梗的整理，事实需二次核对',
    note: '“奶蛙之母”“蛙母退圈”“奶家军”等社区称呼的较早文本样本。',
  },
  {
    id: 'S11',
    title: '奶蛙和奶龙原来不是一回事？网友扒出两者细节，连 AI 都分不清了',
    publisher: '萌娘 ACG 研究所 · 网易号',
    date: '2026-10-03',
    url: 'https://www.163.com/dy/article/L8BKCIUS0515HUN4.html',
    kind: 'media',
    reliability: '自媒体，含“网友转述”的公司态度，未获官方确认',
    note: '“AI 生成结果里奶蛙出现得太多”属转述，本页标为传闻。',
  },
  {
    id: 'S12',
    title: '奶龙变成了奶蛙，我很想念它',
    publisher: '机核 GCORES · 用户投稿',
    date: '2026-07-13',
    url: 'https://www.gcores.com/articles/217077',
    kind: 'media',
    reliability: '用户投稿，文首自标“含 AI 生成内容”，观点性强',
    note: '“旧龙已死，而新蛙当立”“卡痰音大笑 + BABY DON’T CRY”“打字只会联想出奶娃”均出自此文。',
  },
  {
    id: 'S13',
    title: '奶蛙大笑表情包 · 微信小游戏',
    publisher: '腾讯应用宝',
    date: '2026-10-20 更新',
    url: 'https://sj.qq.com/appdetail/wx33f0a597ef4afe46',
    kind: 'platform',
    reliability: '平台页面，可确认“存在”与简介，不能确认版权归属',
    note: '页面无版权方信息，不能视为奶龙官方产品。',
  },
  {
    id: 'S14',
    title: '微博 #表情包# 超话讨论样本',
    publisher: '新浪新闻聚合',
    date: '2026-09 至 2026-10',
    url: 'https://sina.cn/news/detail/5355150857999877.html',
    kind: 'community',
    reliability: '舆论样本，只用于呈现“大家怎么讨论”，不作事实依据',
    note: '“创作者删号怕被告”“数据库被污染”等说法来自网友转述，本页明确标为未证实。',
  },
  {
    id: 'S15',
    title: '“黄色三幻神”爆火背后：一场由网友“赛博封神”的抽象 IP 狂欢',
    publisher: '原仓数据',
    date: '2026',
    url: 'https://www.yuancangip.com/indexNewsDetail/2460',
    kind: 'media',
    reliability: '产业观察稿，偏 IP 商业分析',
    note: '用于核对“三幻神”作为产业标签的用法。',
  },
  {
    id: 'S16',
    title: '近百所高校惊现“流动奶蛙”！大学生排队打卡的神秘招生简章火了',
    publisher: '360 快资讯',
    date: '2026-10',
    url: 'https://www.360kuai.com/9938bb69507f64c2c',
    kind: 'media',
    reliability: '聚合资讯，细节与 S7/S8 互证',
    note: '补充“社团招新—立牌—跨校扩散”的传播路径。',
  },
  {
    id: 'S17',
    title: '[奶娃归猴] 一般我是不想聊烂梗的，但是奶蛙之母这个梗是怎么做到又烂又好的',
    publisher: 'NGA 玩家社区',
    date: '2026',
    url: 'https://ngabbs.com/read.php?tid=47401662',
    kind: 'community',
    reliability: '论坛帖，仅作为“奶蛙之母”梗的文本样本',
    note: '帖子需要登录，本页只引用标题所反映的社区称呼，不引用其中未经证实的内容。',
  },
  {
    id: 'V1',
    title: '奶蛙这张图的由来我找到了',
    publisher: 'B 站 · UP 主 弹簧刀thd',
    date: '2026-08-02',
    url: 'https://www.bilibili.com/video/BV1iY3d67Edg/',
    kind: 'video',
    reliability: '二创溯源短片，11 秒，播放 5,923（2026-10-31 核验）',
    note: 'BV1iY3d67Edg。它本身不是证据，但记录了“全民考古”的节点。',
  },
  {
    id: 'V2',
    title: '09 年 dv 录制奶蛙捧腹大笑',
    publisher: 'B 站 · UP 主 藤原妹红鸡',
    date: '2026-08-12',
    url: 'https://www.bilibili.com/video/BV1HZgV6TETB/',
    kind: 'video',
    reliability: '二创，21 秒，播放 1,606（2026-10-31 核验）',
    note: 'BV1HZgV6TETB。“伪 DV 画质”是奶蛙二创的常见视觉语法。',
  },
  {
    id: 'V3',
    title: '【奶蛙】斜视 meme',
    publisher: 'B 站 · UP 主 是默陌墨喵',
    date: '2026-08-25',
    url: 'https://www.bilibili.com/video/BV1AxhK6BE54/',
    kind: 'video',
    reliability: '二创，19 秒，播放 1,166（2026-10-31 核验）',
    note: 'BV1AxhK6BE54。用“滑车神经麻痹”解释斜视，是奶蛙“万物皆可学术化”的代表。',
  },
  {
    id: 'V4',
    title: '十年擦边无人问，cos 奶龙天下知——互联网吊图合集 270',
    publisher: 'B 站 · UP 主 账号已注销',
    date: '2024-10-27',
    url: 'https://www.bilibili.com/video/BV1ajCDYjE1Y/',
    kind: 'video',
    reliability: '二创合集，67 秒，播放 208,423（2026-10-31 核验）',
    note: 'BV1ajCDYjE1Y。记录奶龙被“套皮化”的前夜，不是奶蛙本身。',
  },
  {
    id: 'V5',
    title: '奶龙大笑出处完整版',
    publisher: 'B 站 · UP 主 녹색멜로디',
    date: '2026-03-05',
    url: 'https://www.bilibili.com/video/BV1zCPCz2Enq/',
    kind: 'video',
    reliability: '出处合集，4 分 23 秒，播放 3,590,766（2026-10-31 核验）',
    note: 'BV1zCPCz2Enq。笑声音源与“大笑奶龙”的公共素材库。',
  },
  {
    id: 'V6',
    title: '《植龙大战僵奶》',
    publisher: 'B 站 · UP 主 暖气杀手aaaa',
    date: '2026-05-14',
    url: 'https://www.bilibili.com/video/BV1Zp5S6rEch/',
    kind: 'video',
    reliability: '二创，56 秒，播放 1,381,972（2026-10-31 核验）',
    note: 'BV1Zp5S6rEch。奶蛙进入“可套用叙事模板”阶段的标志。',
  },
  {
    id: 'V7',
    title: '最后的奶龙和最初的奶龙一样勇敢……',
    publisher: 'B 站 · UP 主 拿着AK的死神',
    date: '2026-07-02',
    url: 'https://www.bilibili.com/video/BV1WqTE6LEQ9/',
    kind: 'video',
    reliability: '抒情向二创，45 秒，播放 319,472（2026-10-31 核验）',
    note: 'BV1WqTE6LEQ9。奶蛙开始承载“旧神退场”的怀旧叙事。',
  },
  {
    id: 'V8',
    title: '奶蛙！哲学装甲形态',
    publisher: 'B 站 · UP 主 诺罗伊',
    date: '2026-10-26',
    url: 'https://www.bilibili.com/video/BV1nFnd6VEBF/',
    kind: 'video',
    reliability: '二创，93 秒，播放 10,129（2026-10-31 核验）',
    note: 'BV1nFnd6VEBF。奶蛙与更古老的抽象符号缝合，进入“抽象圣体”谱系。',
  },
]

export interface StoryEvent {
  id: string
  date: string
  sort: number
  year: number
  title: string
  lead: string
  body?: string
  sources: string[]
  level: EvidenceLevel
  key?: boolean
  chip?: string
  image?: string
  imageAlt?: string
  imageCaption?: string
}

/**
 * 时间线。排序用 sort（YYYYMMDD），展示用 date。
 * 2025 年两条无法精确到日的记录，用“2025 年内”并在正文说明。
 */
export const events: StoryEvent[] = [
  {
    id: 'e20200122',
    date: '2020-01-22',
    sort: 20200122,
    year: 2020,
    title: '奶龙在抖音发出第一条作品',
    lead: '一只黄色、圆头、短手短脚的幼龙，从这一天开始日更式地占领短视频信息流。',
    body:
      '奶龙由第七印象文化传媒（深圳）有限公司运营，定位 10 岁以下子供向；单集多在 1 分钟内，靠单元剧和网络热梗推进。它后来的一切抽象化，都建立在“足够黄、足够圆、足够无处不在”这三个前提上。',
    sources: ['S1', 'S2'],
    level: 'confirmed',
    key: true,
    chip: '前史',
  },
  {
    id: 'e202012',
    date: '2020-12',
    sort: 20201200,
    year: 2020,
    title: '《好大一只变色龙！》第一次爆款',
    lead: '单条获赞约 237 万，奶龙在抖音站稳脚跟。',
    body:
      '对一个新 IP 来说，这是一次“算法验证”：黄色圆脸 + 夸张反应 + 短平快节奏，能在儿童与家长之外继续穿透。此后奶龙的爆款开始按季度出现。',
    sources: ['S1'],
    level: 'confirmed',
  },
  {
    id: 'e202101',
    date: '2021-01',
    sort: 20210100,
    year: 2021,
    title: '《好大一条眼镜蛇！》再破纪录',
    lead: '获赞约 379.7 万，成为奶龙早期代表作之一。',
    body:
      '到这时，奶龙已经不只是“动画短剧”，而是小学生之间的社交货币。一个 IP 一旦进入课间十分钟，它的传播就不再依赖平台推荐。',
    sources: ['S1'],
    level: 'confirmed',
  },
  {
    id: 'e202110',
    date: '2021-10',
    sort: 20211000,
    year: 2021,
    title: '第一套官方微信表情包上线',
    lead: '奶龙从短视频走进聊天框。',
    body:
      '这一步很关键：表情包是“可被拆解、可被二次配音、可被任意配字”的载体。它把角色从完整叙事里解放出来，变成一块可以贴在任何语境上的黄色贴纸。',
    sources: ['S1'],
    level: 'confirmed',
  },
  {
    id: 'e202301',
    date: '2023-01',
    sort: 20230100,
    year: 2023,
    title: '第一季动画番剧推出',
    lead: '从 1 分钟段子升级为系列动画（百科作《奶龙搞怪大作战》）。',
    body:
      '官方开始给奶龙补“完整故事”。但互联网对它的使用方式，已经和官方设定分道扬镳：大家要的不是剧情，是一个可以无限复用的黄色表情。',
    sources: ['S1'],
    level: 'confirmed',
  },
  {
    id: 'e202401',
    date: '2024-01',
    sort: 20240100,
    year: 2024,
    title: '第二季《奶龙与小七之大战暴暴龙》上线',
    lead: 'IP 持续系列化，官方宇宙越铺越大。',
    body:
      '同年，奶龙开始密集联名：麦当劳、名创优品、泡泡玛特、《和平精英》《梦幻西游》。一个子供向 IP 的“无处不在”，也为后来的反感与解构埋下伏笔。',
    sources: ['S1', 'S2'],
    level: 'confirmed',
  },
  {
    id: 'e20241002',
    date: '2024-10-02',
    sort: 20241002,
    year: 2024,
    title: '星野智能体「奶龙」上线，奶蛙在背景图里诞生',
    lead: '用户「纲手[百豪]」在 AI 智能体 App「星野」创建了一个奶龙智能体（ID：zNCvQDKfXy），并用平台内置的图像模型生成背景图。模型把“龙”画成了“蛙”。',
    body:
      '这是目前证据链最完整、被失传媒体中文维基正式确认的源头。它提供的是“生成条件”，不是“设计稿”：一次低精度模型对提示词的误读，把奶龙圆润的身体、绿色的大眼睛和奶油色肚皮，重组成了一只梨形、无颈、凸眼的黄色生物。',
    sources: ['S3', 'S4', 'S5', 'S11'],
    level: 'confirmed',
    key: true,
    chip: '起源',
    image: '/story/naiwa.jpg',
    imageAlt: '奶蛙经典形象：黄色梨形身体、绿色环状眼睛、奶油色肚皮',
    imageCaption: '奶蛙经典形象。原始生成图已难以直接获取，此图为公开传播版本。',
  },
  {
    id: 'e20241027',
    date: '2024-10-27',
    sort: 20241027,
    year: 2024,
    title: '「十年擦边无人问，cos 奶龙天下知」',
    lead: 'B 站一条 67 秒的吊图合集，记录真人穿奶龙玩偶服出圈。',
    body:
      '这条视频不是奶蛙，但它是理解奶蛙的前置条件：当一只黄色生物可以被随意套皮、随意配字、随意嘲讽，下一只“野生的黄色生物”出现时，互联网不会惊讶。奶龙的形象开始脱离官方叙事，变成“任何人都能套上的皮”。',
    sources: ['V4'],
    level: 'confirmed',
    chip: '前史',
    image: '/story/nailong-cos.jpg',
    imageAlt: 'cos 奶龙的二创视频画面',
    imageCaption: '「cos 奶龙」合集画面（图源：B 站二创视频封面）。',
  },
  {
    id: 'e202412',
    date: '2024-12',
    sort: 20241200,
    year: 2024,
    title: '第一条可查证的奶蛙传播',
    lead: '抖音博主「欢迎大家恐龙世界」（现已设为私密账号）上传带「星野」字样的奶蛙视频。',
    body:
      '这是目前可查证的最早传播节点。它证明奶蛙在 2024 年底已经离开星野，进入短视频平台；但此时的它只是小范围猎奇素材，还没有形成“梗”。失传媒体维基也提到，当时更出圈的是“我是奶龙”，不是奶蛙。',
    sources: ['S3', 'S4'],
    level: 'reported',
    chip: '潜伏',
  },
  {
    id: 'e20250307',
    date: '2025-03-07',
    sort: 20250307,
    year: 2025,
    title: '「季洪行 × 奶龙」误认开始',
    lead: '有网友把奶蛙和抖音博主「季洪行」的视频做 AI 融合，奶蛙因此长期被误认为“季洪行与奶龙 AI 融合的产物”。',
    body:
      '这个误认让奶蛙在很长时间里“有了一个假父亲”。直到 2026 年 8 月星野智能体被找到，才被纠正。今天仍有人把季洪行称作“奶蛙之父”——本页明确标注：不是。季洪行是“大笑奶龙”的中之人，与奶蛙的生成链无关。',
    sources: ['S4', 'S6'],
    level: 'myth',
    key: true,
    chip: '误认',
  },
  {
    id: 'e2025comment',
    date: '2025 年内',
    sort: 20250600,
    year: 2025,
    title: '纲手[百豪] 为“自己的奶龙被看见”而高兴',
    lead: '在 2025 年的一条评论里，TA 还在为这个 AI 奶龙形象被更多人知道而开心。',
    body:
      '手谈姬的报道把这条评论与 2026 年的结局并置：当时 TA 不知道，自己随手生成的背景图会成为 2026 年传播最广的中文互联网迷因之一。具体日期与完整上下文未公开，本页只能标为“2025 年内 / 媒体报道”。',
    sources: ['S5'],
    level: 'reported',
    key: true,
    chip: '人物',
  },
  {
    id: 'e2025daxiao',
    date: '2025 年内',
    sort: 20250700,
    year: 2025,
    title: '平行线：「大笑奶龙」成形',
    lead: '季洪行的武打视频被 AI 换成奶龙，配上《无畏契约》博主「八级哥」经「老水牛变声器」处理的笑声。',
    body:
      '这是“大笑奶龙”，不是奶蛙。两者经常被混为一谈：它们共享黄色、捧腹、魔性笑声，但来源、形象、时间线都不同。把这条线单独列出，是为了避免“奶蛙 = 大笑奶龙”的二次误认。',
    sources: ['S6'],
    level: 'reported',
    key: true,
    chip: '平行线',
  },
  {
    id: 'e20260115',
    date: '2026-01-15',
    sort: 20260115,
    year: 2026,
    title: '「大笑奶龙」成为 2026 开年第一猎奇梗',
    lead: '官方回复“请勿发布丑化、恶搞奶龙的非官方表情包”，反而被网友理解成“官方承认这是奶龙”，热度再次膨胀；奶龙官方随后关闭评论区。',
    body:
      '3DM 的报道把这一现象称为“2026 第一个赤石热潮”，并记录了“十万点赞、五条评论”的奇观。奶蛙与大笑奶龙在这一阶段互相借势：一个提供“蛙形”，一个提供“笑声”。',
    sources: ['S6'],
    level: 'confirmed',
    key: true,
    chip: '爆发',
  },
  {
    id: 'e20260305',
    date: '2026-03-05',
    sort: 20260305,
    year: 2026,
    title: '《奶龙大笑出处完整版》3,590,766 播放',
    lead: 'B 站 UP 主「녹색멜로디」把笑声音源、季洪行素材、二创版本整理成 4 分 23 秒的“出处合集”。',
    body:
      '这条视频的播放量说明：到 2026 年 3 月，奶龙/奶蛙的笑声已经成为一个需要“考古”的公共素材库。观众不再问“这是谁”，而是问“这个笑声从哪来”。',
    sources: ['V5'],
    level: 'confirmed',
    chip: '爆发',
  },
  {
    id: 'e20260514',
    date: '2026-05-14',
    sort: 20260514,
    year: 2026,
    title: '《植龙大战僵奶》1,381,972 播放',
    lead: '奶蛙进入“万物皆可缝合”的阶段：植物大战僵尸的框架 + 奶龙/奶蛙的角色。',
    body:
      '这是二创从“单个形象”走向“可套用的叙事模板”的标志。此后的奶蛙视频不再需要解释它是谁，观众看到黄色梨形身体就知道“要笑了”。',
    sources: ['V6'],
    level: 'confirmed',
    key: true,
    chip: '爆发',
  },
  {
    id: 'e20260702',
    date: '2026-07-02',
    sort: 20260702,
    year: 2026,
    title: '《最后的奶龙和最初的奶龙一样勇敢……》',
    lead: '一条 45 秒的抒情向二创，把奶龙与奶蛙的关系写成“旧神与新神”的交接。',
    body:
      '319,472 播放。奶蛙此时已经不只是搞笑素材，开始承载“怀旧 / 悼念 / 神话化”的情绪。一个迷因能让人笑不稀奇，能让人“想念”才说明它进入了文化层。',
    sources: ['V7'],
    level: 'confirmed',
    chip: '爆发',
  },
  {
    id: 'e20260713',
    date: '2026-07-13',
    sort: 20260713,
    year: 2026,
    title: '机核长文《奶龙变成了奶蛙，我很想念它》',
    lead: '“旧龙已死，而新蛙当立。”文章把奶蛙放进《创造亚当》《梅杜萨之筏》《拿破蛙》等名画二创里。',
    body:
      '该文为用户投稿，且文首标注含 AI 生成内容；它的价值不在于事实考据，而在于记录了 2026 年 7 月中文互联网对奶蛙的“审美化”接受。文中还留下一个细节：作者输入“奶蛙”时，输入法总是先联想“奶娃”。',
    sources: ['S12'],
    level: 'reported',
    chip: '文化',
  },
  {
    id: 'e20260802',
    date: '2026-08-02',
    sort: 20260802,
    year: 2026,
    title: 'B 站溯源视频《奶蛙这张图的由来我找到了》',
    lead: 'UP 主「弹簧刀thd」发布 11 秒的溯源短片，尝试回答“这张图到底从哪来”。',
    body:
      '5,923 播放、178 条评论。播放不高，但它是“全民考古”的标志：奶蛙已经火到让人反过来追问出处。',
    sources: ['V1'],
    level: 'confirmed',
    chip: '考据',
  },
  {
    id: 'e20260804',
    date: '2026-08-04',
    sort: 20260804,
    year: 2026,
    title: '星野智能体被找到，来源正式确认',
    lead: 'B 站用户「雾蚀心忘症」在星野 App 中找到符合奶蛙形象的智能体，并把截图发在评论区。',
    body:
      '失传媒体中文维基据此把来源状态改为“来源确定”：用户「纲手[百豪]」、创建日期 2024-10-02、智能体 ID zNCvQDKfXy。此时智能体已无法搜索/分享，评论区关闭。',
    sources: ['S4'],
    level: 'confirmed',
    key: true,
    chip: '考据',
  },
  {
    id: 'e20260808',
    date: '2026-08-08',
    sort: 20260808,
    year: 2026,
    title: '一条更早的视频，与“换源”理论',
    lead: '考据群发现一条 2024-08-23 的 B 站视频里出现过奶蛙，但右下角 AI 水印与星野不同、发布时间更早。',
    body:
      '主流解释是“后期换源”：视频发布后被替换了画面。这个反例没有被完全排除，所以严格说，奶蛙的“第一张图”仍有 1% 的悬念。本页保留这个悬念，不把它写成铁案。',
    sources: ['S4'],
    level: 'contested',
    key: true,
    chip: '争议',
  },
  {
    id: 'e20260908',
    date: '2026-09-08',
    sort: 20260908,
    year: 2026,
    title: '手谈姬：找到了造物主，但故事迎来最残酷的结局',
    lead: '“奶蛙的形象全网传播，播放过亿……但他的创作者，却终生不得与自己的造物相认。”',
    body:
      '报道把法律风险、官方态度、创作者隐身三件事串起来。需要强调：这是媒体叙述，不是官方声明；“终生”是修辞，不是法律事实。可确认的是：相关智能体已不可访问；报道称原作者似乎不希望被找到。',
    sources: ['S5'],
    level: 'reported',
    key: true,
    chip: '人物',
  },
  {
    id: 'e20260909',
    date: '2026-09-09',
    sort: 20260909,
    year: 2026,
    title: '「奶蛙之母」成为梗',
    lead: '4399 的文章把「纲手[百豪]」称作“奶蛙之母”，并写到“间接导致蛙母退圈”。',
    body:
      '随后社区出现“生母弃我，胞兄厌我，世人笑我”的伤感小作文，把奶蛙写成被母亲遗弃、被兄长嫌弃的悲剧角色。这是二创的第二次转义：从“AI 事故”变成“家庭伦理剧”。',
    sources: ['S10', 'S17'],
    level: 'reported',
    key: true,
    chip: '造物主',
  },
  {
    id: 'e20260920',
    date: '2026-09 下旬',
    sort: 20260920,
    year: 2026,
    title: '中国矿业大学：两块立牌开启“流动奶蛙”',
    lead: '据学生帖文，中国矿业大学两个社团在招新时摆出奶蛙立牌；有人在立牌背面手写“流动奶龙”，鼓励把它搬到校园各处。',
    body:
      '手写通知后来升级为打印版，又加上“请勿放置于教学区域、宿舍楼内部、消防通道”的安全提示。一个社团招新道具，变成了跨校接力。',
    sources: ['S7', 'S8', 'S16'],
    level: 'reported',
    key: true,
    chip: '线下',
  },
  {
    id: 'e20261001',
    date: '2026-10-01',
    sort: 20261001,
    year: 2026,
    title: '近百所高校出现奶蛙立牌',
    lead: '3DM / 虎嗅统计：奶蛙立牌已现身国内近百所高校，且数字还在增长。',
    body:
      '出现地点包括宿舍阳台、军训操场、绿化带、图书馆外。学生给它戴迷彩帽、披透明雨衣；“寻找奶蛙—拍照—发帖—再搬运”形成线上线下循环。',
    sources: ['S7'],
    level: 'reported',
    key: true,
    chip: '线下',
  },
  {
    id: 'e20261011',
    date: '2026-10-11',
    sort: 20261011,
    year: 2026,
    title: '游民星空：没有版权的立牌，成了最火打卡点',
    lead: '“正因为奶蛙没有官方设定，没有版权归属，所以它不属于任何人，也因此属于所有人。”',
    body:
      '文章把奶蛙与皮卡丘、小黄人、海绵宝宝、奶龙放在同一条“黄色传播力”谱系里，同时指出：立牌是学生自制的，严格说存在版权与安全风险。',
    sources: ['S8'],
    level: 'reported',
    chip: '线下',
  },
  {
    id: 'e20261020',
    date: '2026-10-20',
    sort: 20261020,
    year: 2026,
    title: '微信小游戏「奶蛙大笑表情包」出现在应用宝',
    lead: '一个以奶蛙大笑为核心机制的小游戏出现在腾讯应用宝，简介写着“点一下就狂笑”；页面显示 2026-10-20 更新。',
    body:
      '这标志着奶蛙从“二创素材”进入“平台化小游戏”阶段。注意：它并非奶龙官方产品，页面上也没有版权方信息。',
    sources: ['S13'],
    level: 'confirmed',
    chip: '商业化',
  },
  {
    id: 'e20261023',
    date: '2026-10-23',
    sort: 20261023,
    year: 2026,
    title: '新周刊：「表情包正式进入大奶蛙时代」',
    lead: '奶蛙成为“当代大学生最时髦的社交货币”，立牌出现在中国港台乃至北美高校。',
    body:
      '新周刊把它解释为“解构文化”的又一次胜利：一个通过解构真实 IP 而衍生出的虚构之物，正在成为线上线下真实存在的流行文化。',
    sources: ['S9'],
    level: 'reported',
    key: true,
    chip: '出圈',
  },
  {
    id: 'e20261026',
    date: '2026-10-26',
    sort: 20261026,
    year: 2026,
    title: '《奶蛙！哲学装甲形态》',
    lead: 'B 站 UP 主「诺罗伊」把奶蛙与“香蕉君”等抽象符号缝合，做出 93 秒的“哲学装甲”短片。',
    body:
      '10,129 播放。奶蛙开始被纳入“抽象圣体”的谱系，与更古老的互联网符号并列——这是迷因生命周期的后段：它不再需要起源，只需要被引用。',
    sources: ['V8'],
    level: 'confirmed',
    chip: '文化',
  },
]

export const eventYears = Array.from(new Set(events.map((e) => e.year))).sort((a, b) => a - b)

export interface FamilyNode {
  id: string
  name: string
  role: string
  meta: string
  body: string
  sources: string[]
  tone: 'butter' | 'jade' | 'sky' | 'rose' | 'ink'
  dashed?: boolean
  stamp?: string
}

export const familyNodes: FamilyNode[] = [
  {
    id: 'gangshou',
    name: '纲手[百豪]',
    role: '奶蛙之母 · 生成者',
    meta: '星野 App 用户 · 2024-10-02 创建智能体',
    body:
      '目前能确认的是：TA 是星野用户，不是奶龙官方，也没有以作者身份公开出现过。网名看起来取自《火影忍者》的纲手与“百豪之印”——这也是网友判断 TA 是火影爱好者的线索。2024 年 10 月 2 日，TA 为名为“奶龙”的智能体（ID：zNCvQDKfXy）生成了一张背景图。就是这张图，在 2026 年变成了全网传播的奶蛙。网友把 TA 叫作“奶蛙之母”“蛙母”；但严格说，TA 是按下生成键的人，真正动笔的是模型。',
    sources: ['S3', 'S4', 'S5'],
    tone: 'butter',
    stamp: '母',
  },
  {
    id: 'nailong',
    name: '奶龙',
    role: '母本 · 梗内“胞兄”',
    meta: '第七印象 · 2020-01-22 出道',
    body:
      '奶蛙的每一根线条都来自奶龙：黄色身体、绿色大眼睛、奶油色肚皮、圆润轮廓。AI 没有凭空造一只蛙，它只是把“龙”的部件重新排列。在网友的家庭叙事里，奶龙是奶蛙的“胞兄”——一个还在营业、还在维护自己形象的正主。',
    sources: ['S1', 'S2'],
    tone: 'jade',
  },
  {
    id: 'xingye',
    name: '星野 AI',
    role: '助产士 · 误差来源',
    meta: 'AI 智能体平台 · 低精度图像模型',
    body:
      '奶蛙不是被“设计”出来的，是被“生成”出来的。低精度模型对提示词的理解偏差，把圆头、大眼、胖肚子重组成梨形、无颈、凸眼的形态。失传媒体维基也提醒：智能体已无法访问，无法百分百确认是星野直接生成，还是其他 AI 生成后上传；但“星野智能体背景图”是目前证据最强的解释。',
    sources: ['S4', 'S5', 'S11'],
    tone: 'sky',
  },
  {
    id: 'naiwa',
    name: '奶蛙',
    role: '本人 · AI 亚种',
    meta: '2024-10-02 · 无官方版权',
    body:
      '黄色梨形身体、奶油色肚皮、浅绿色环状眼白、居中的小黑瞳、一条细小的嘴线、深橄榄色的手脚。它没有台词、没有设定、没有官方周边，核心动作只有一个：捧腹大笑。正因为没有版权归属，它不属于任何人，也因此属于所有人。',
    sources: ['S4', 'S8'],
    tone: 'butter',
    stamp: '蛙',
  },
  {
    id: 'universe',
    name: '奶蛙宇宙',
    role: '后代 · 全体网友',
    meta: '2026 · 名画 / 表情包 / 立牌 / 三幻神',
    body:
      '名画二创（《创造亚当》《梅杜萨之筏》《拿破蛙》）、表情包、鬼畜视频、校园立牌、微信小游戏、与牛来/美团袋鼠并列的“黄色三幻神”……奶蛙的后代不是角色，是一整套可复用的语法：黄色、捧腹、荒诞、结尾必须一起笑。',
    sources: ['S7', 'S8', 'S9', 'S12'],
    tone: 'rose',
  },
  {
    id: 'jihongxing',
    name: '季洪行',
    role: '被误认的“假父亲”',
    meta: '抖音博主 · 2025-03-07 误认开始',
    body:
      '季洪行是“大笑奶龙”的中之人：他的武打视频被 AI 换成奶龙，再配上八级哥的笑声。他和奶蛙的生成链没有关系。2025 年 3 月 7 日的 AI 融合，让奶蛙被误认为“季洪行 × 奶龙”的产物；2026 年 8 月星野智能体被找到后，这个说法已被证伪。',
    sources: ['S4', 'S6'],
    tone: 'ink',
    dashed: true,
    stamp: '误认',
  },
]

export interface GlossaryEntry {
  term: string
  alias?: string
  category: '人物' | '形象' | '梗' | '平台' | '事件'
  short: string
  detail: string
  sources: string[]
}

export const glossary: GlossaryEntry[] = [
  {
    term: '奶龙',
    alias: 'Nailong',
    category: '形象',
    short: '2020 年出道的黄色幼龙，奶蛙的“母本”与梗内“胞兄”。',
    detail:
      '第七印象文化传媒（深圳）有限公司旗下 IP，定位 10 岁以下子供向，靠 1 分钟单元剧、网络热梗和海量联名成为国民级形象。它先被小学生喜欢，再被成年人反感并解构，最后官方接住流量自嘲，完成“黑红也是红”的循环。',
    sources: ['S1', 'S2'],
  },
  {
    term: '奶蛙',
    alias: '奶娃 / 大奶蛙 / Naiwa',
    category: '形象',
    short: '2024-10-02 由星野用户「纲手[百豪]」的 AI 生成图意外诞生的黄色蛙形生物。',
    detail:
      '不是官方角色，没有版权归属。核心视觉是黄色梨形身体、奶油色肚皮、浅绿色环状眼白、小黑瞳、深橄榄色手脚；核心动作是捧腹大笑。网友也常写作“奶娃”，机核作者甚至说输入法“总是只能联想打字奶娃”。',
    sources: ['S4', 'S12'],
  },
  {
    term: '奶蛙之母 / 蛙母',
    alias: '奶娃之母',
    category: '人物',
    short: '网友对「纲手[百豪]」的称呼，带一点神话化，也带一点残忍。',
    detail:
      '这个称呼把一次 AI 生成事故写成了“生育”：创作者是母亲，奶龙是胞兄，奶蛙是被遗弃的孩子。它很适合做二创，但也容易把真人推到聚光灯下。失传媒体维基专门提示：请勿过度关注或骚扰原作者。',
    sources: ['S4', 'S10', 'S17'],
  },
  {
    term: '纲手[百豪]',
    alias: '百豪纲手',
    category: '人物',
    short: '星野 App 用户，奶蛙的生成者；网名取自《火影忍者》。',
    detail:
      '2024-10-02 创建奶龙智能体（ID：zNCvQDKfXy），并用平台 AI 生成背景图。2025 年曾为“自己的奶龙被看见”而高兴；2026 年被找到后，智能体不可搜索/分享、评论关闭。维基编者提醒避免打扰。本页不收录任何可定位到真人的信息。',
    sources: ['S4', 'S5'],
  },
  {
    term: '星野',
    alias: 'Xingye',
    category: '平台',
    short: 'AI 智能体社交 App，奶蛙的“出生地”。',
    detail:
      '用户可以在其中创建角色智能体、写人设、生成头像/背景并对话。奶蛙原本只是“奶龙”智能体的一张背景图。平台后来对大量智能体做过下架整改，这也是奶蛙长期无法溯源的原因之一。',
    sources: ['S4', 'S5'],
  },
  {
    term: '大笑奶龙',
    alias: '大笑奶龙 / 唐龙',
    category: '梗',
    short: '季洪行的视频被 AI 换成奶龙，再配上八级哥笑声的 2026 开年猎奇梗。',
    detail:
      '它和奶蛙是两个东西：大笑奶龙是“人变龙”，奶蛙是“龙变蛙”。两者在 2026 年初互相借势，共享黄色、捧腹、魔性笑声的语法。把两者分开，是理解这段历史的关键。',
    sources: ['S6'],
  },
  {
    term: '季洪行',
    alias: '用实力证明自己',
    category: '人物',
    short: '抖音博主，“大笑奶龙”的中之人；不是奶蛙的父亲。',
    detail:
      '因“武打动作”短视频涨粉，被网友与奶龙做 AI 融合。2025-03-07 的融合让奶蛙被误认成“季洪行 × 奶龙”的产物，但这个说法在 2026-08 已被证伪。',
    sources: ['S4', 'S6'],
  },
  {
    term: '八级哥',
    alias: '老水牛变声器',
    category: '人物',
    short: '《无畏契约》博主，奶蛙/大笑奶龙的“笑声本声”。',
    detail:
      '他在解说视频里用“老水牛变声器”调音，并在开头配一段莫名其妙的大笑。笑声被单独截出，成为国产新一代“私人笑声”，也是奶蛙视频结尾“全员捧腹”的声源。',
    sources: ['S6'],
  },
  {
    term: '不知火舞语音',
    alias: '变调语音',
    category: '梗',
    short: '奶蛙二创常用的变调女声素材，与八级哥笑声并置。',
    detail:
      '手谈姬的报道提到，奶蛙视频常与“变调版不知火舞语音”搭配。它和笑声一起构成“先荒诞、后爆笑”的听觉钩子。具体出处版本繁多，本页不指定单一源文件。',
    sources: ['S5'],
  },
  {
    term: '黄色三幻神',
    alias: '奶蛙 / 牛来 / 美团袋鼠',
    category: '梗',
    short: '2026 年被网友并列的三只黄色抽象生物。',
    detail:
      '奶蛙、牛来（暑期档动画电影《牛来》）、美团袋鼠（骑手默认头像“肥嘟嘟袋鼠”）并称。它们并非同一作品，却都以黄色软萌外观 + 魔性言论/笑声称霸抽象宇宙。',
    sources: ['S10', 'S15'],
  },
  {
    term: '流动奶龙 / 流动奶蛙',
    alias: '奶蛙立牌',
    category: '事件',
    short: '高校里被学生搬来搬去的奶蛙立牌，背面写着“请把我搬到别处”。',
    detail:
      '2026 年 9 月起从中国矿业大学社团招新扩散到全国近百所高校。手写通知后来升级为打印版，并加上消防通道等安全提示。它把线上梗变成线下接力，再反哺线上。',
    sources: ['S7', 'S8', 'S9'],
  },
  {
    term: '奶家军 / 奶家人',
    alias: '奶蛙信徒',
    category: '梗',
    short: '社区对奶蛙二创者/爱好者的自称。',
    detail:
      '随着“黄色三幻神”叙事成型，社区把奶蛙、牛来、袋鼠的粉丝统称为“奶家人”。它更像一个玩笑式的部落标签，没有组织形态。',
    sources: ['S10'],
  },
  {
    term: '抽象',
    alias: '抽象文化',
    category: '梗',
    short: '本页的“抽象”指：用荒诞、低成本、去意义化的方式重新剪辑现实。',
    detail:
      '奶蛙是抽象文化的典型产物：没有完整故事、没有明确作者、没有严肃表达，靠一个表情和一个笑声完成传播。它不是“看不懂”，而是“不需要看懂”。',
    sources: ['S5', 'S8'],
  },
  {
    term: '唐',
    alias: '唐氏 / 糖',
    category: '梗',
    short: '互联网贬义梗，常被用来形容“荒诞到像另一个物种”的内容。',
    detail:
      '这个词带有对特定群体的冒犯性，本页只在解释语境时出现，不鼓励使用。奶蛙相关讨论里，它常与“猎奇”“绷不住”一起出现。',
    sources: ['S6'],
  },
  {
    term: '绷不住',
    alias: '绷 / 难绷',
    category: '梗',
    short: '“忍不住笑”或“忍不住崩溃”的双关，是奶蛙内容的核心反应。',
    detail:
      '奶蛙的凝视、斜视、捧腹大笑，都在制造“你明知道很怪，但还是想笑”的瞬间。哔哩哔哩上甚至有“我在绷不住大赛中坚持了 XX 秒”的互动话术。',
    sources: ['S12'],
  },
  {
    term: '牛奶蛙',
    alias: '亚马逊牛奶蛙',
    category: '形象',
    short: '真实存在的两栖动物，和奶蛙没有关系。',
    detail:
      '牛奶蛙（Trachycephalus resinifictrix）生活在南美亚马逊流域，蓝白斑纹，是爬宠圈常见饲养对象。搜“饲养、价格、寿命”找的是它；搜“表情包、大笑、立牌”找的是奶蛙。',
    sources: ['S8'],
  },
  {
    term: 'AI 亚种',
    alias: 'AI 变体',
    category: '形象',
    short: '网友对“由 AI 从原 IP 衍生出的野生形象”的称呼。',
    detail:
      '奶蛙是最典型的 AI 亚种：它保留了母本的黄色与大眼睛，却在生成过程中长出了完全不同的身体。3DM 甚至用“技能设计太过超模”的游戏术语来形容它。',
    sources: ['S10'],
  },
]

export interface RecipeIngredient {
  id: string
  label: string
  note: string
  points: number
  sources: string[]
}

export const recipeIngredients: RecipeIngredient[] = [
  {
    id: 'yellow',
    label: '黄色梨形身体',
    note: '一眼认出，且能在信息流里抢眼。',
    points: 18,
    sources: ['S8'],
  },
  {
    id: 'laugh',
    label: '捧腹大笑的结尾',
    note: '所有二创共享的“收束动作”，像一种仪式。',
    points: 22,
    sources: ['S5'],
  },
  {
    id: 'voice',
    label: '八级哥笑声 / 老水牛变声器',
    note: '卡痰音、失真、传染性极强。',
    points: 20,
    sources: ['S6'],
  },
  {
    id: 'mai',
    label: '变调不知火舞语音',
    note: '先荒诞、后爆笑的听觉钩子。',
    points: 14,
    sources: ['S5'],
  },
  {
    id: 'art',
    label: '名画 / 历史场景',
    note: '把严肃题材降维成笑料，反差最大。',
    points: 12,
    sources: ['S12'],
  },
  {
    id: 'dv',
    label: '伪 DV / 低画质',
    note: '制造“这玩意好像真的存在过”的错觉。',
    points: 8,
    sources: ['V2'],
  },
  {
    id: 'essay',
    label: '一句伤感小作文',
    note: '“生母弃我，胞兄厌我”——把梗变成家庭伦理剧。',
    points: 6,
    sources: ['S10'],
  },
]

export interface MorphStage {
  at: number
  code: string
  label: string
  note: string
}

export const morphStages: MorphStage[] = [
  { at: 0, code: 'GEN 0.00', label: '奶龙 · 官方设定', note: '圆头、短肢、绿色大眼，比例稳定。' },
  { at: 25, code: 'GEN 0.25', label: '识别开始偏移', note: '模型把“圆肚子”理解成了“梨形身体”。' },
  { at: 50, code: 'GEN 0.50', label: '颈部丢失', note: '头与身体之间的分界被抹平，像一只蛙。' },
  { at: 75, code: 'GEN 0.75', label: '眼球外凸', note: '绿色眼白 + 小黑瞳，蛙的特征被锁定。' },
  { at: 100, code: 'GEN 1.00', label: '奶蛙 · 命名完成', note: '网友看了一眼：这不是龙，这是蛙。' },
]

export interface Chapter {
  id: string
  no: string
  title: string
  short: string
  kicker: string
}

export const chapters: Chapter[] = [
  { id: 's00', no: '00', title: '30 秒速通', short: '速通', kicker: '先看懂，再考古' },
  { id: 's01', no: '01', title: '前史：一只黄色幼龙', short: '前史', kicker: '2020—2024' },
  { id: 's02', no: '02', title: '起源：一次 AI 事故', short: '起源', kicker: '2024-10-02' },
  { id: 's03', no: '03', title: '潜伏：角落里的两年', short: '潜伏', kicker: '2024—2025' },
  { id: 's04', no: '04', title: '爆发：笑声接管互联网', short: '爆发', kicker: '2026' },
  { id: 's05', no: '05', title: '完整时间线', short: '时间线', kicker: '可筛选 / 可放映' },
  { id: 's06', no: '06', title: '线下：流动奶蛙', short: '线下', kicker: '2026 秋' },
  { id: 's07', no: '07', title: '造物主：赛博两相隔', short: '造物主', kicker: '最残酷的结局' },
  { id: 's08', no: '08', title: '争议：版权与反噬', short: '争议', kicker: '谁拥有它？' },
  { id: 's09', no: '09', title: '档案馆', short: '档案', kicker: '视频 / 词典 / 出处' },
]

export const heroStats = [
  { value: '2024.10.02', label: '首次生成', note: '星野 App' },
  { value: '2026', label: '全面爆发', note: '中文互联网' },
  { value: '近 100 所', label: '高校立牌', note: '据不完全统计' },
  { value: '0', label: '官方版权', note: '这正是它自由的原因' },
]
