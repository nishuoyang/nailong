<script setup lang="ts">
// 奶龙 → 奶蛙 发展史专题页（内容基于公开报道与考据，全部事实均标注来源，见页面底部「参考资料」）

interface VideoItem {
  title: string
  author: string
  meta: string
  desc: string
  cover: string
  url: string
  bvid?: string
  tag: string
}

interface SourceItem {
  no: string
  title: string
  meta: string
  url: string
  note?: string
}

// —— 关键节点（时间线）——
const timeline: Array<{ date: string; title: string; desc: string; src: string }> = [
  { date: '2020-01-22', title: '奶龙上线抖音', desc: '原创动画IP「奶龙」开始在短视频平台发布作品，长线创作由此开始。', src: '[1]' },
  { date: '2020-12', title: '《好大一只变色龙！》爆款', desc: '单条作品获赞约 237 万，奶龙开始在抖音站稳脚跟。', src: '[1]' },
  { date: '2021-01', title: '《好大一条眼镜蛇！》再创纪录', desc: '获赞约 379.7 万，成为奶龙早期代表作之一。', src: '[1]' },
  { date: '2021-10', title: '官方微信表情包上线', desc: '第一套官方微信表情包上线，IP 从短视频走向聊天场景。', src: '[1]' },
  { date: '2023-01', title: '第一季动画番剧推出', desc: '从 1 分钟段子短视频升级为系列动画番剧（百科作《奶龙搞怪大作战》）。', src: '[1]' },
  { date: '2024-01', title: '第二季番剧上线', desc: '《奶龙与小七之大战暴暴龙》上线，IP 持续系列化。', src: '[1]' },
  { date: '2024-10-02', title: '奶蛙诞生', desc: '星野 App 用户「纲手[百豪]」用 AI 为「奶龙」智能体（ID: zNCvQDKfXy）创作背景图，体型畸变、形似青蛙，被后人称为「奶蛙」。', src: '[4]' },
  { date: '2024-12', title: '奶蛙形象首现社交平台', desc: '抖音博主「欢迎大家恐龙世界」（后设为私密账号）上传带「星野」字样的奶蛙视频，系可查证的首个传播节点。', src: '[4]' },
  { date: '2025-03', title: '「季洪行 AI 融合」误传', desc: '网友将奶蛙与抖音博主「季洪行」的视频做 AI 融合，导致奶蛙长期被误认为「季洪行×奶龙」的产物。', src: '[4]' },
  { date: '2025 至今', title: '奶蛙宇宙全面爆发', desc: '「奶蛙捧腹大笑 + 卡痰音大笑 + BABY DON’T CRY」成为抽象圈层经典迷因，二创渗透进名画、历史、神话等题材。', src: '[3]' },
  { date: '2026-01', title: '「大笑奶龙」成为第一猎奇梗', desc: '「被 AI 变成奶龙的季洪行」配上「八级哥 × 老水牛变声器」的魔性笑声，「唐唐联合」烧遍全网，奶龙官方账号不得不关闭评论区。', src: '[11]' },
  { date: '2026-08', title: '奶蛙来源正式考证确认', desc: '失传媒体中文维基完成考证：源头确认为星野 App 智能体背景图；B 站用户「雾蚀心忘症」也在星野 App 中找到对应智能体。', src: '[4]' },
]

// —— 视频素材（含解释）——
const videos: VideoItem[] = [
  {
    title: '奶蛙这张图的由来我找到了',
    author: 'B站 UP主：弹簧刀thd',
    meta: 'Bilibili',
    desc: '溯源型二创视频：从奶蛙经典形象出发，追查「这张图到底从哪来」，是奶蛙起源考据最常被引用的视频之一。',
    cover: '/story/naiwa.jpg',
    url: 'https://www.bilibili.com/video/BV1iY3d67Edg/',
    bvid: 'BV1iY3d67Edg',
    tag: '起源考据',
  },
  {
    title: '09年dv录制奶蛙捧腹大笑',
    author: 'B站 UP主：藤原妹红鸡',
    meta: 'Bilibili',
    desc: '「捧腹大笑」是奶蛙最经典的姿态：黑短四肢、白肚皮、大张的嘴与魔性笑声，配合伪 DV 画质形成强反差。',
    cover: '/story/naiwa-laugh.jpg',
    url: 'https://www.bilibili.com/video/BV1HZgV6TETB/',
    bvid: 'BV1HZgV6TETB',
    tag: '经典迷因',
  },
  {
    title: '【奶蛙】斜视 meme',
    author: 'B站 UP主：是默陌墨喵',
    meta: 'Bilibili',
    desc: '医学梗重构：用「滑车神经麻痹」示意解读奶蛙的斜视绿眼睛，是奶蛙二创「万物皆可学术化」的代表。',
    cover: '/story/naiwa-squint.jpg',
    url: 'https://www.bilibili.com/video/BV1AxhK6BE54/',
    bvid: 'BV1AxhK6BE54',
    tag: '二创解构',
  },
  {
    title: '十年擦边无人问，cos奶龙天下知——互联网吊图合集270',
    author: 'B站 UP主：账号已注销',
    meta: 'Bilibili · 2024-10',
    desc: '奶龙被抽象化的前夜：真人穿奶龙玩偶服出镜、擦边无人问津 vs cos 奶龙爆火，记录奶龙从「子供向 IP」被互联网解构的过程。',
    cover: '/story/nailong-cos.jpg',
    url: 'https://www.bilibili.com/video/BV1ajCDYjE1Y/',
    tag: '史前记录',
  },
  {
    title: '被缚的奶蛙（《方舟上的奶蛙》系列）',
    author: '抖音',
    meta: 'Douyin',
    desc: '名画重构：奶蛙被铁链缚于悬崖，复刻普罗米修斯传说，「健硕肌肉 × 软萌青蛙」的反差消解了神话的严肃边界。',
    cover: '/story/naiwa.jpg',
    url: 'https://www.douyin.com/video/7632479202756063995',
    tag: '名画二创',
  },
  {
    title: '奶龙大笑出处完整版',
    author: 'B站 UP主：녹색멜로디',
    meta: 'Bilibili · 2026-03 · 321万播放',
    desc: '「大笑奶龙」出处合集：完整收录 2026 年第一猎奇梗的核心笑声音源——经「老水牛变声器」处理的魔性大笑。大笑奶龙本体是「被 AI 变成奶龙的抖音博主季洪行」，声源则来自《无畏契约》博主「八级哥」，两个元素「唐唐联合」后横扫全网，甚至让奶龙官方账号关闭了评论区[11]。',
    cover: '/story/nailong-daxiao.jpg',
    url: 'https://www.bilibili.com/video/BV1zCPCz2Enq/',
    bvid: 'BV1zCPCz2Enq',
    tag: '笑声出处',
  },
]

// —— 参考资料——
const sources: SourceItem[] = [
  {
    no: '[1]',
    title: '奶龙（中国动画短片创作者）· 百度百科',
    meta: '创作脉络、作品数据、大事记',
    url: 'https://wapbaike.baidu.com/item/%E5%A5%B6%E9%BE%99/64161212',
  },
  {
    no: '[2]',
    title: '「奶龙」出圈启示录：低龄IP的文旅变现密码 · 澎湃新闻/骨朵网络影视',
    meta: '2025-04-30 · 爆火逻辑、全网粉丝 3600 万+、播放量破百亿、文旅联动',
    url: 'https://m.thepaper.cn/newsDetail_forward_30748412',
  },
  {
    no: '[3]',
    title: '奶龙变成了奶蛙，我很想念它 · 机核 GCORES',
    meta: '2026-07-13 · 用户投稿（文中标注含 AI 生成内容，仅供参考）',
    url: 'https://www.gcores.com/articles/217077',
    note: '⚠️ 该文为机核用户投稿且自称含 AI 生成内容，观点性较强，正文已标注。',
  },
  {
    no: '[4]',
    title: '奶蛙（来源确定的奶龙恶搞图片；2024年）· 失传媒体中文维基',
    meta: '起源考证、传播节点、误传澄清，来源已正式确认',
    url: 'https://lostmedia.wikidot.com/deleted:naiwa',
  },
  {
    no: '[5]',
    title: '在奶蛙、牛来后，神秘黄色袋鼠成了抽象宇宙新神 · 网易新闻/3DM游戏',
    meta: '2026-08-23 · 「黄色三幻神」定位：奶蛙、牛来、美团袋鼠',
    url: 'https://m.163.com/dy/article/L524A6P20526D8LR.html',
  },
  {
    no: '[11]',
    title: '2026第一猎奇梗「大笑奶龙」，让奶龙官方账号关闭了评论区 · 网易新闻/3DM游戏',
    meta: '2026-01-15 · 「大笑奶龙」本体（季洪行 AI 变体）、笑声音源（八级哥 × 老水牛变声器）、官方关评论事件',
    url: 'https://www.163.com/dy/article/KJA7J2UR0526D8LR.html',
  },
]

function openVideo(v: VideoItem) {
  window.open(v.url, '_blank', 'noopener')
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-10">
    <!-- ===== Hero ===== -->
    <header class="text-center mb-12">
      <div class="flex items-center justify-center gap-3 mb-4">
        <img src="/logo.png" alt="奶龙" class="w-14 h-14 rounded-full object-cover shadow" />
        <h1 class="text-4xl font-bold">从奶龙到奶蛙</h1>
        <img src="/story/naiwa.jpg" alt="奶蛙" class="w-14 h-14 rounded-full object-cover shadow" />
      </div>
      <p class="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
        一个国民级 IP 在 AI 时代被重新发明的全过程 ——
        从 <strong>2020 年诞生的黄色小恐龙</strong>，到
        <strong>2024 年 AI 畸变出「奶蛙」</strong>，再到它席卷抽象互联网的
        <strong>奶蛙宇宙</strong>。本文所有事实均附来源索引，<span class="text-blue-600 dark:text-blue-400 font-medium">有理有据</span>。
      </p>
      <div class="flex flex-wrap justify-center gap-2 mt-6 text-xs">
        <span class="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">奶龙：子供向国民 IP</span>
        <span class="px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">2023-2024：被抽象解构</span>
        <span class="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">2024-2026：奶蛙宇宙</span>
      </div>
    </header>

    <!-- ===== 目录 ===== -->
    <nav class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 mb-10">
      <h2 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">📑 本页目录</h2>
      <div class="flex flex-wrap gap-2 text-sm">
        <a href="#c1" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 no-underline transition-colors">一、奶龙的诞生与走红（2020-2024）</a>
        <a href="#c2" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 no-underline transition-colors">二、奶龙的「被解构」时代</a>
        <a href="#c3" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 no-underline transition-colors">三、奶蛙的诞生（2024）</a>
        <a href="#c4" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 no-underline transition-colors">四、奶蛙宇宙的爆发（2025-2026）</a>
        <a href="#c5" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 no-underline transition-colors">五、黄色三幻神</a>
        <a href="#timeline" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 no-underline transition-colors">📅 完整时间线</a>
        <a href="#videos" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 no-underline transition-colors">🎬 视频档案馆</a>
        <a href="#refs" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 no-underline transition-colors">📚 参考资料</a>
      </div>
    </nav>

    <!-- ===== 第一章 ===== -->
    <section id="c1" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 md:p-8 mb-10 scroll-mt-24">
      <h2 class="text-2xl font-bold mb-2">一、奶龙的诞生与走红（2020-2024）</h2>
      <p class="text-sm text-gray-400 mb-6">资料来源：[1] 百度百科</p>

      <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
        奶龙是 <strong>第七印象文化传媒（深圳）有限公司</strong> 旗下的动画短片创作者/IP：全身黄色、圆脑袋、大肚皮的可爱幼龙形象，最早于
        <strong>2020 年 1 月 22 日</strong>在抖音开始发布作品。它以 1 分钟以内的单元剧短视频为主，定位是 10 岁以下的子供向动画，靠短视频的「奶头乐」属性大量借用网络流行梗 [[1]][[2]]。
      </p>

      <div class="grid md:grid-cols-2 gap-4 mb-6">
        <figure class="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          <img src="/story/nailong-anime.jpg" alt="奶龙动画剧照" class="w-full object-cover" loading="lazy" />
          <figcaption class="text-xs text-gray-400 p-2">奶龙动画剧照（图源：澎湃新闻·骨朵网络影视）[2]</figcaption>
        </figure>
        <figure class="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          <img src="/story/nailong-ip.jpg" alt="奶龙 IP 形象与经典动画联动" class="w-full object-cover" loading="lazy" />
          <figcaption class="text-xs text-gray-400 p-2">奶龙 IP 形象（图源：澎湃新闻·骨朵网络影视）[2]</figcaption>
        </figure>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
          <div class="text-2xl font-bold text-amber-600 dark:text-amber-400">419</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">抖音累计作品（截至 2026-03）[1]</div>
        </div>
        <div class="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
          <div class="text-2xl font-bold text-amber-600 dark:text-amber-400">2357.5 万</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">抖音粉丝（截至 2026-03）[1]</div>
        </div>
        <div class="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
          <div class="text-2xl font-bold text-amber-600 dark:text-amber-400">3791 万+</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">全网粉丝量 [1]</div>
        </div>
        <div class="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
          <div class="text-2xl font-bold text-amber-600 dark:text-amber-400">3.1 亿</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">全网获赞 [1]</div>
        </div>
      </div>

      <h3 class="font-bold text-lg mb-3">爆火逻辑：低龄 IP 的「黑红也是红」[[2]]</h3>
      <ol class="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 leading-relaxed">
        <li><strong>先在小学生群体爆火</strong> —— 孩子单纯觉得搞笑，且低幼内容可选范围小、用户粘性极强。</li>
        <li><strong>成年人开始反感「低智」</strong> —— 于是对着奶龙进行抽象解构，炮制大量嘲讽向二创视频。</li>
        <li><strong>官方索性玩梗自嘲</strong> —— 黑红也是红，奶龙团队接住流量化为己用，反而在嘲讽声中走向顶流。</li>
      </ol>
      <p class="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
        破圈之后，奶龙与<strong>麦当劳、名创优品、泡泡玛特</strong>等消费品牌，以及<strong>《和平精英》《梦幻西游》</strong>等手游联名；2024 年国庆在深圳前海石公园树起 20 米高气膜巨型奶龙，7 天内相关话题增长超 300 万；2025 年五一又落地贵阳云顶暮曙公园 22 米高「全国最大奶龙」与唐山皮影乐园主题巡游 [[2]]。
      </p>
    </section>

    <!-- ===== 第二章 ===== -->
    <section id="c2" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 md:p-8 mb-10 scroll-mt-24">
      <h2 class="text-2xl font-bold mb-2">二、奶龙的「被解构」时代（2023-2024）</h2>
      <p class="text-sm text-gray-400 mb-6">资料来源：[2][6]</p>

      <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
        当一个子供向 IP 在互联网上无处不在时，它的「可爱」很快会成为解构素材。澎湃的分析指出，奶龙大量视频<strong>连完整的故事都没有、只是段子</strong>，这让很多年轻人反感其「无所不在地入侵」[[2]]。
      </p>
      <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
        于是出现了「<strong>十年擦边无人问，cos 奶龙天下知</strong>」的现象级二创：真人套上黄色奶龙玩偶服出镜，比正经内容更容易获得流量 [[6]]。这个时期，奶龙的形象开始脱离官方设定，成为互联网通用的「黄色搞笑素材」——这为奶蛙的诞生埋下了土壤：<strong>当角色的脸可以被随意替换，为什么不能换成青蛙？</strong>
      </p>

      <figure class="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900 mb-4 max-w-sm">
        <img src="/story/nailong-cos.jpg" alt="cos 奶龙吊图合集" class="w-full object-cover" loading="lazy" />
        <figcaption class="text-xs text-gray-400 p-2">「cos 奶龙」合集画面（图源：B站二创视频封面）[6]</figcaption>
      </figure>

      <blockquote class="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-r-lg text-gray-700 dark:text-gray-300">
        「奶龙这辈子可能都没法想到，自己有一天在评选唐家三少时连上桌的资格都没有，甚至于这张桌子上，还在不断涌来新客，把奶龙挤回小孩那桌。」<span class="text-xs text-gray-400 block mt-2">—— 网易新闻/3DM游戏 [5]</span>
      </blockquote>
    </section>

    <!-- ===== 第三章 ===== -->
    <section id="c3" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 md:p-8 mb-10 scroll-mt-24">
      <h2 class="text-2xl font-bold mb-2">三、奶蛙的诞生（2024）—— AI 时代的「克苏鲁变体」</h2>
      <p class="text-sm text-gray-400 mb-6">资料来源：[4] 失传媒体中文维基（来源已确认）</p>

      <div class="grid md:grid-cols-2 gap-6 items-start">
        <div class="text-gray-700 dark:text-gray-300 leading-relaxed space-y-4">
          <p>
            奶蛙并非官方角色，而是<strong>AI 二创缝合产物</strong>。据失传媒体中文维基考证：2024 年 10 月 2 日，星野 App 用户
            <strong>「纲手[百豪]」</strong> 使用 AI 创作了一张对奶龙的恶搞图片，作为他为「奶龙」智能体（ID: <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">zNCvQDKfXy</code>）设置的背景图 [[4]]。
          </p>
          <p>
            经过 AI 渲染后，奶龙<strong>体型畸变、腹部膨大、四肢细小、头部异常肿大</strong>，加上绿色眼睛与黑色四肢，整体形似青蛙——「奶蛙」之名由此而来 [[4]]。机核的文章则形容它是「<strong>四肢黝黑，全身像黄桃罐头，头部异常肿大</strong>」的生物 [[3]]。
          </p>
          <p>
            <strong>关键辨析：</strong>该源头的确认经历了反复 —— 2025 年 3 月，网友将奶蛙与抖音博主「季洪行」视频做 AI 融合，导致很长一段时间奶蛙被误认为「季洪行×奶龙」的产物；2026 年 8 月，B 站用户「雾蚀心忘症」在星野 App 中找到符合形象的智能体，维基最终将来源正式确认（另有 2024 年 8 月更早的视频出现，但水印不同、主流理论认为是后期换源）[[4]]。
          </p>
        </div>
        <figure class="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          <img src="/story/naiwa.jpg" alt="奶蛙经典形象" class="w-full object-cover" loading="lazy" />
          <figcaption class="text-xs text-gray-400 p-2">奶蛙经典形象：黄桃罐头般的身体、绿眼睛、黑四肢（图源：B站《奶蛙这张图的由来我找到了》封面）[6]</figcaption>
        </figure>
      </div>
    </section>

    <!-- ===== 第四章 ===== -->
    <section id="c4" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 md:p-8 mb-10 scroll-mt-24">
      <h2 class="text-2xl font-bold mb-2">四、奶蛙宇宙的爆发（2025-2026）</h2>
      <p class="text-sm text-gray-400 mb-6">资料来源：[3][5][7][8][9][10]</p>

      <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
        奶蛙的二创视频绝大多数配有<strong>经过处理的直播连麦录音</strong>：结尾必有一声<strong>卡痰音大笑</strong>与动感 BGM
        <strong>《BABY DON’T CRY》</strong>——「捧腹大笑的奶蛙」因此成为 alpha 世代抽象圈层的经典迷因 [[3]][[4]]。
      </p>
      <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
        在 AI 工具的加持下，奶蛙开始「入侵」人类文明史：它可以出现在<strong>《创造亚当》</strong>里与上帝碰手指，可以成为<strong>《梅杜萨之筏》</strong>上即将覆灭的船员，也可以化身<strong>「拿破蛙」</strong>翻越阿尔卑斯山脉，或是像<strong>普罗米修斯</strong>一样被缚于悬崖 [[3]][[10]]。机核的文章以一句话总结这场「文艺复兴」：<strong>「旧龙已死，而新蛙当立。」</strong>[[3]]
      </p>

      <div class="grid md:grid-cols-2 gap-4 mb-6">
        <figure class="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          <img src="/story/naiwa-laugh.jpg" alt="奶蛙捧腹大笑" class="w-full object-cover" loading="lazy" />
          <figcaption class="text-xs text-gray-400 p-2">奶蛙捧腹大笑（图源：B站《09年dv录制奶蛙捧腹大笑》封面）[8]</figcaption>
        </figure>
        <figure class="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          <img src="/story/naiwa-squint.jpg" alt="奶蛙斜视 meme" class="w-full object-cover" loading="lazy" />
          <figcaption class="text-xs text-gray-400 p-2">奶蛙斜视 meme（图源：B站《【奶蛙】斜视meme》封面）[9]</figcaption>
        </figure>
      </div>

      <div class="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-5">
        <h3 class="font-bold text-green-700 dark:text-green-300 mb-2">🎯 为什么奶蛙比奶龙更「火」？</h3>
        <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          奶蛙相对于奶龙是「更高维」的抽象符号：它<strong>统一了「丑萌」与「魔性」</strong>——既保留了奶龙的黄色辨识度，又用畸变带来天然的荒诞感；任何严肃题材（名画、历史、医学）被奶蛙替换后都会立刻降维成笑料，完美契合「不需要理解、只需要感受」的互联网玩梗逻辑 [[5]]。而从传播学看，奶龙作为「正主」被官方大量联名变现，奶蛙作为「野生的二创」反而获得了不受版权约束的再创作自由 [[2]]。
        </p>
      </div>
    </section>

    <!-- ===== 第五章 ===== -->
    <section id="c5" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 md:p-8 mb-10 scroll-mt-24">
      <h2 class="text-2xl font-bold mb-2">五、黄色三幻神（2026）</h2>
      <p class="text-sm text-gray-400 mb-6">资料来源：[5] 网易新闻/3DM游戏</p>

      <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
        2026 年起，奶蛙与 <strong>牛来</strong>（一句话「妈——妈——」让无数人泪目的抽象新星）、<strong>美团袋鼠</strong>（「外卖越吃越少我怎么吃」的规则怪谈制造机）被网友凑成<strong>「黄色三幻神」</strong>。它们并非出自同一部作品，却都以黄色软萌外观 + 魔性言论/笑声称霸抽象宇宙 [[5]]。
      </p>
      <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 text-sm">
        3DM 的评论甚至为奶蛙「封神」：<strong>「奶蛙，原为奶龙 AI 亚种，由于技能设计太过超模，不论在什么场合都能让结尾收束为众宾欢也的哈哈大笑。」</strong>[[5]]
      </p>

      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <figure class="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          <img src="/story/niulai.jpg" alt="牛来" class="w-full aspect-[4/5] object-cover" loading="lazy" />
          <figcaption class="text-xs text-gray-400 p-2">牛来（图源：网易新闻）[5]</figcaption>
        </figure>
        <figure class="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          <img src="/story/kangaroo-review.jpg" alt="美团袋鼠差评梗" class="w-full aspect-[4/5] object-cover" loading="lazy" />
          <figcaption class="text-xs text-gray-400 p-2">美团袋鼠：外卖越吃越少（图源：网易新闻）[5]</figcaption>
        </figure>
        <figure class="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          <img src="/story/kangaroo-audit.jpg" alt="美团袋鼠评审团" class="w-full aspect-[4/5] object-cover" loading="lazy" />
          <figcaption class="text-xs text-gray-400 p-2">美团袋鼠：小美评审团（图源：网易新闻）[5]</figcaption>
        </figure>
      </div>
    </section>

    <!-- ===== 完整时间线 ===== -->
    <section id="timeline" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 md:p-8 mb-10 scroll-mt-24">
      <h2 class="text-2xl font-bold mb-6">📅 完整时间线</h2>
      <div class="relative pl-6 border-l-2 border-amber-300 dark:border-amber-700 space-y-6">
        <div v-for="(t, i) in timeline" :key="i" class="relative">
          <span class="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-amber-400 dark:bg-amber-600 ring-4 ring-white dark:ring-gray-800"></span>
          <div class="text-xs font-mono text-amber-600 dark:text-amber-400 mb-1">{{ t.date }} <span class="text-gray-400 ml-1">{{ t.src }}</span></div>
          <div class="font-bold text-gray-800 dark:text-gray-200 mb-1">{{ t.title }}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{{ t.desc }}</div>
        </div>
      </div>
    </section>

    <!-- ===== 视频档案馆 ===== -->
    <section id="videos" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 md:p-8 mb-10 scroll-mt-24">
      <h2 class="text-2xl font-bold mb-2">🎬 视频档案馆</h2>
      <p class="text-sm text-gray-400 mb-6">原始视频可能被下架或换源，若播放器无法加载，请点击「在源站打开」</p>

      <div class="space-y-8">
        <article v-for="(v, i) in videos" :key="i" class="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="grid md:grid-cols-2">
            <!-- 封面 / 播放器 -->
            <div class="relative aspect-video bg-black">
              <iframe
                v-if="v.bvid"
                :src="`https://player.bilibili.com/player.html?bvid=${v.bvid}&page=1&high_quality=1&danmaku=0&autoplay=0`"
                class="w-full h-full"
                scrolling="no"
                frameborder="no"
                allowfullscreen="true"
                loading="lazy"
                :title="v.title"
              ></iframe>
              <a v-else :href="v.url" target="_blank" rel="noopener" class="block w-full h-full">
                <img :src="v.cover" :alt="v.title" class="w-full h-full object-cover" loading="lazy" />
                <span class="absolute inset-0 flex items-center justify-center text-white text-5xl opacity-80">▶</span>
              </a>
            </div>
            <!-- 解释区 -->
            <div class="p-5 flex flex-col">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">{{ v.tag }}</span>
                <span class="text-xs text-gray-400">{{ v.meta }}</span>
              </div>
              <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">{{ v.title }}</h3>
              <p class="text-xs text-gray-400 mb-3">{{ v.author }}</p>
              <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">{{ v.desc }}</p>
              <button
                @click="openVideo(v)"
                class="mt-4 self-start px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors cursor-pointer"
              >
                在源站打开 ↗
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- ===== 参考资料 ===== -->
    <section id="refs" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 md:p-8 mb-10 scroll-mt-24">
      <h2 class="text-2xl font-bold mb-4">📚 参考资料</h2>
      <ol class="space-y-3 text-sm">
        <li v-for="s in sources" :key="s.no" class="flex gap-3">
          <span class="font-mono text-amber-600 dark:text-amber-400 shrink-0">{{ s.no }}</span>
          <div>
            <a :href="s.url" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline">{{ s.title }}</a>
            <div class="text-xs text-gray-400 mt-0.5">{{ s.meta }}</div>
            <div v-if="s.note" class="text-xs text-orange-500 mt-0.5">{{ s.note }}</div>
          </div>
        </li>
        <li class="flex gap-3">
          <span class="font-mono text-amber-600 dark:text-amber-400 shrink-0">[6-10]</span>
          <div>
            <div class="text-gray-700 dark:text-gray-300">B站 / 抖音 二创视频（正文中已逐条标注出处）：
              <a href="https://www.bilibili.com/video/BV1iY3d67Edg/" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline">奶蛙这张图的由来我找到了</a>、
              <a href="https://www.bilibili.com/video/BV1HZgV6TETB/" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline">09年dv录制奶蛙捧腹大笑</a>、
              <a href="https://www.bilibili.com/video/BV1AxhK6BE54/" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline">【奶蛙】斜视meme</a>、
              <a href="https://www.bilibili.com/video/BV1ajCDYjE1Y/" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline">十年擦边无人问，cos奶龙天下知</a>、
              <a href="https://www.douyin.com/video/7632479202756063995" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline">被缚的奶蛙（抖音）</a>
            </div>
            <div class="text-xs text-gray-400 mt-0.5">B站数据（标题/UP主/播放量）经 Bilibili 公开 API 于本页制作时核验。</div>
          </div>
        </li>
      </ol>
      <p class="text-xs text-gray-400 mt-6">
        ⚠️ 说明：页内所有图片与视频均来自公开报道/视频封面，版权归原作者所有，仅作介绍与考据用途；若涉及侵权请联系站长删除。
      </p>
    </section>

    <!-- ===== 回到主页 ===== -->
    <section class="text-center py-6">
      <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">看完奶蛙的成长史，想看图片？</p>
      <div class="flex justify-center gap-3">
        <router-link to="/" class="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm no-underline transition-colors">🖼️ 返回图片主页</router-link>
        <router-link to="/featured" class="px-5 py-2.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm no-underline transition-colors">⭐ 精选推荐</router-link>
        <router-link to="/other" class="px-5 py-2.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm no-underline transition-colors">🧸 其他推荐</router-link>
      </div>
    </section>
  </div>
</template>
