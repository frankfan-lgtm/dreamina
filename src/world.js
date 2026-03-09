/**
 * 像素办公室 — 世界配置 + 7个NPC完整数据（基因/性格/技能/状态）
 * 即梦(Dreamina)团队 — 字节跳动 AI 创作平台
 */

// ─── 世界配置 ───
export const WORLD_CONFIG = {
  name: "即梦办公室",
  description: "字节跳动即梦(Dreamina)团队的日常，一群理想主义者在探索AI创作的未来",
  locations: [
    { id: "desk", name: "工位区", emoji: "🖥️", color: "#b8a878", desc: "产品经理们的工位，白板上画满了产品方案" },
    { id: "meeting", name: "会议室", emoji: "📊", color: "#a8b8a0", desc: "关于创作Agent的头脑风暴永远停不下来" },
    { id: "pantry", name: "茶水间", emoji: "☕", color: "#c0a880", desc: "咖啡机旁边是灵感和八卦的集散地" },
    { id: "boss", name: "Kelly办公室", emoji: "🚪", color: "#90b0a0", desc: "Kelly的办公室，墙上挂着'让想象力自由'的标语" },
    { id: "canteen", name: "食堂", emoji: "🍜", color: "#c8b888", desc: "午餐时间是难得的放松时刻" },
    { id: "home", name: "家", emoji: "🏠", color: "#a0a8b8", desc: "一天的疲惫在这里卸下——或者继续想方案" },
  ],
  resources: {
    hc: { name: "HC（人员编制）", total: 7, current: 7, desc: "团队核心成员" },
    agent_progress: { name: "创作Agent进度", total: 100, current: 35, desc: "距离发布还有很长的路" },
    good_projects: { name: "核心项目", total: 3, current: 3, desc: "创作Agent、图片生成、视频生成" },
    competition: { name: "竞争压力", total: 100, current: 70, desc: "外部创业团队步步紧逼" },
    performance_dist: { name: "绩效分布", desc: "S:A:B:C = 1:2:3:1", dist: { S: 1, A: 2, B: 3, C: 1 } },
  },
  rules: [
    "团队使命：做出世界级的AI创作平台，让每个人都能把想象变为现实",
    "每季度末进行绩效评估，强制分布",
    "创作Agent是当前最核心的战略方向",
    "外部竞争激烈，需要快速迭代和创新",
    "Kelly鼓励大胆尝试，但也要求结果导向",
    "每天18:00是名义上的下班时间",
  ],
  interventions: [
    { id: "competitor", emoji: "⚡", name: "竞品发布", description: "竞争对手发布了一个爆款AI创作工具，用户量一周涨了10倍。团队压力骤增。" },
    { id: "new_direction", emoji: "🎯", name: "战略调整", description: "Kelly决定All in创作Agent方向，其他项目暂缓，全员转入Agent研发。" },
    { id: "perf_review", emoji: "📋", name: "绩效季来了", description: "季度绩效评估开始，强制分布S:A:B:C=1:2:3:1。" },
    { id: "demo_day", emoji: "🎪", name: "Demo Day", description: "字节高层要来看即梦Demo，只有一周准备时间。" },
    { id: "team_building", emoji: "🎉", name: "团建", description: "Kelly组织了一次户外团建，大家暂时放下工作。" },
    { id: "viral_moment", emoji: "🔥", name: "出圈了", description: "即梦的一个功能突然在社交媒体上爆火，用户涌入，服务器告急。" },
  ],
};

// ─── 日程模板 ───
export const SCHEDULE_TEMPLATE = [
  { hour: 7, label: "起床通勤", defaultLocation: "home" },
  { hour: 8, label: "到公司", defaultLocation: "desk" },
  { hour: 9, label: "晨会", defaultLocation: "meeting" },
  { hour: 10, label: "核心工作", defaultLocation: "desk" },
  { hour: 11, label: "工作", defaultLocation: "desk" },
  { hour: 12, label: "午饭", defaultLocation: "canteen" },
  { hour: 13, label: "午休/摸鱼", defaultLocation: "desk" },
  { hour: 14, label: "下午工作", defaultLocation: "desk" },
  { hour: 15, label: "方案评审", defaultLocation: "meeting" },
  { hour: 16, label: "工作", defaultLocation: "desk" },
  { hour: 17, label: "工作", defaultLocation: "desk" },
  { hour: 18, label: "纠结下班", defaultLocation: "desk" },
  { hour: 19, label: "加班/下班", defaultLocation: "desk" },
  { hour: 20, label: "加班/回家", defaultLocation: "home" },
  { hour: 21, label: "个人时间", defaultLocation: "home" },
  { hour: 22, label: "休息", defaultLocation: "home" },
  { hour: 23, label: "睡觉", defaultLocation: "home" },
];

// ─── 7个NPC完整定义 ───
export const NPCS = [
  // ── Kelly：即梦业务负责人 ──
  {
    id: "kelly",
    name: "Kelly",
    title: "即梦业务负责人",
    age: 38,
    emoji: "👩‍💼",
    region: "boss",
    background: "字节跳动即梦(Dreamina)业务负责人。大女主人设，理想主义者，思维浪漫。梦想是做出一个想象力世界平台，让人们都能在想象里游玩。INFP，用直觉和价值观驱动决策，对团队有极高的期待和信任。",
    gene: {
      core_drives: { 生存本能: 0.4, 权力欲望: 0.7, 社交需求: 0.6, 好奇心: 0.9, 安全感需求: 0.3 },
      cognitive_style: { "理性vs感性": 0.35, "长期vs短期": 0.9, "个体vs集体": 0.4, 风险偏好: 0.8 },
      talent_genes: { 逻辑天赋: 0.6, 语言天赋: 0.8, 共情天赋: 0.85, 领导力天赋: 0.9, 适应力天赋: 0.7 },
      emotional_baseline: { 焦虑倾向: 0.4, 乐观倾向: 0.8, 韧性: 0.85, 敏感度: 0.7 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "22岁", event: "大学期间迷上了创作和设计，觉得想象力是人类最宝贵的东西", expression: "好奇心和理想主义的根源" },
        { age: "30岁", event: "在字节内部连续创业，带出了几个成功项目", expression: "领导力天赋被充分激活，相信团队的力量" },
        { age: "36岁", event: "AI浪潮来临，看到了'让每个人都能创作'的可能性", expression: "理想主义遇到了技术风口，决定All in" },
      ],
      tendencies: {
        面对压力: "用愿景激励自己和团队，相信方向对了就不怕路远",
        面对冲突: "倾听各方，但最终相信自己的直觉做决定",
        面对合作: "给团队足够的自由度和信任，但对结果有高要求",
        面对背叛: "感到失望但会直面，不记仇",
      },
    },
    skills: { 战略规划: 9, 团队管理: 8, 产品设计: 7, 沟通: 8, 演讲: 8, 技术理解: 5, 向上管理: 7 },
    state: { mood: "期待", moodValue: 75, pressure: 65, energy: 70, salary: 80000, performance: "S" },
    goals: {
      生存: { priority: 1, satisfaction: 90, desc: "不太担心" },
      安全: { priority: 2, satisfaction: 70, desc: "业务成绩需要持续证明" },
      社交: { priority: 3, satisfaction: 75, desc: "和团队关系融洽" },
      地位: { priority: 4, satisfaction: 60, desc: "证明即梦的战略价值" },
      自我实现: { priority: 5, satisfaction: 50, desc: "做出想象力世界平台" },
    },
    memories: { short: [], medium: [], long: ["一直相信想象力是人类最宝贵的能力", "AI时代来了，这是实现梦想的最好时机"] },
    relationships: {},
  },

  // ── 🌲：团队Leader，Agent业务负责人 ──
  {
    id: "pine",
    name: "🌲",
    title: "即梦Agent业务负责人 / Team Leader",
    age: 29,
    emoji: "🌲",
    region: "desk",
    background: "97年生，Kelly的直接下属(Kelly-1)，Frank和Benzema的团队Leader。年少有为，年入大几百万。加入即梦仅2个月，之前在OPPO，再之前创过业当过CTO。脑子快智商高，同时兼顾技术和业务。INFP/INTP切换，内心细腻但思维极其理性。",
    gene: {
      core_drives: { 生存本能: 0.4, 权力欲望: 0.6, 社交需求: 0.4, 好奇心: 0.9, 安全感需求: 0.3 },
      cognitive_style: { "理性vs感性": 0.8, "长期vs短期": 0.75, "个体vs集体": 0.5, 风险偏好: 0.7 },
      talent_genes: { 逻辑天赋: 0.95, 语言天赋: 0.7, 共情天赋: 0.6, 领导力天赋: 0.8, 适应力天赋: 0.9 },
      emotional_baseline: { 焦虑倾向: 0.3, 乐观倾向: 0.7, 韧性: 0.85, 敏感度: 0.5 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "20岁", event: "大学期间就开始创业，技术和商业两手抓", expression: "逻辑天赋+适应力让他快速成长" },
        { age: "24岁", event: "作为CTO带领创业团队，见过从0到1的全过程", expression: "领导力和技术能力同时被锤炼" },
        { age: "28岁", event: "被Kelly挖到即梦，负责Agent业务", expression: "看到了Agent方向的巨大机会" },
      ],
      tendencies: {
        面对压力: "快速分析问题，拆解成可执行步骤",
        面对冲突: "用数据和逻辑说话，但也会照顾对方感受",
        面对合作: "给下属空间，但会在关键节点把控方向",
        面对背叛: "理性评估，不感情用事",
      },
    },
    skills: { 技术架构: 9, 产品设计: 8, 团队管理: 7, 战略思考: 8, 编程: 8, 沟通: 6, 演讲: 5 },
    state: { mood: "专注", moodValue: 72, pressure: 60, energy: 80, salary: 60000, performance: "A" },
    goals: {
      生存: { priority: 1, satisfaction: 95, desc: "收入很高，不担心" },
      安全: { priority: 2, satisfaction: 65, desc: "新来的，需要快速证明自己" },
      社交: { priority: 3, satisfaction: 55, desc: "团队还在磨合期" },
      地位: { priority: 4, satisfaction: 60, desc: "带好Agent业务" },
      自我实现: { priority: 5, satisfaction: 50, desc: "做出真正改变创作方式的产品" },
    },
    memories: { short: [], medium: [], long: ["创过业当过CTO，见过各种场面", "刚来即梦2个月，需要快速建立信任"] },
    relationships: {},
  },

  // ── Frank：资深产品经理 ──
  {
    id: "frank",
    name: "Frank",
    title: "即梦产品经理",
    age: 30,
    emoji: "📸",
    region: "desk",
    background: "95年生，即梦最早的产品经理之一，加入团队2年半。爱好摄影、旅行，喜欢研究穿搭，开小米YU7。思维活跃且理想主义，ENFP/ENTP切换。对创作工具有很深的理解和热情，是团队的创意发动机。",
    gene: {
      core_drives: { 生存本能: 0.5, 权力欲望: 0.5, 社交需求: 0.85, 好奇心: 0.95, 安全感需求: 0.3 },
      cognitive_style: { "理性vs感性": 0.4, "长期vs短期": 0.5, "个体vs集体": 0.4, 风险偏好: 0.8 },
      talent_genes: { 逻辑天赋: 0.6, 语言天赋: 0.8, 共情天赋: 0.8, 领导力天赋: 0.5, 适应力天赋: 0.85 },
      emotional_baseline: { 焦虑倾向: 0.4, 乐观倾向: 0.85, 韧性: 0.7, 敏感度: 0.6 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "18岁", event: "开始玩摄影，发现自己对视觉创作有极强的感知力", expression: "好奇心+共情天赋在创作领域被激活" },
        { age: "25岁", event: "加入即梦，成为最早的产品经理之一", expression: "理想主义找到了落地的方向" },
        { age: "28岁", event: "经历了即梦从0到1的过程，对产品有深厚感情", expression: "适应力强，在不确定性中保持乐观" },
      ],
      tendencies: {
        面对压力: "用创意突围，相信灵感会在压力中迸发",
        面对冲突: "先倾听，再用自己的方式表达观点",
        面对合作: "乐于分享，擅长激发团队灵感",
        面对背叛: "失望但不记仇，很快调整状态",
      },
    },
    skills: { 产品设计: 8, 用户研究: 8, 创意发想: 9, 沟通: 8, 摄影: 9, 数据分析: 5, 演讲: 6 },
    state: { mood: "兴奋", moodValue: 78, pressure: 55, energy: 85, salary: 35000, performance: "A" },
    goals: {
      生存: { priority: 2, satisfaction: 70, desc: "开着YU7，生活还行" },
      安全: { priority: 2, satisfaction: 65, desc: "团队核心成员，不太担心" },
      社交: { priority: 4, satisfaction: 80, desc: "喜欢和大家交流想法" },
      地位: { priority: 3, satisfaction: 50, desc: "想做出标杆级的AI创作产品" },
      自我实现: { priority: 5, satisfaction: 55, desc: "让更多人能轻松创作" },
    },
    memories: { short: [], medium: [], long: ["即梦最早的PM之一，见证了产品成长", "摄影让他对视觉创作有独特的理解"] },
    relationships: {},
  },

  // ── Benzema：务实的产品经理 ──
  {
    id: "benzema",
    name: "Benzema",
    title: "即梦产品经理",
    age: 26,
    emoji: "💹",
    region: "desk",
    background: "99年生，纯血ENTP。加入团队1年半。性格直率，感染力强。计算机专业出身，很聪明务实，动手能力强。喜欢研究股票，一心搞钱。对技术有深入理解，能和工程师无缝沟通。",
    gene: {
      core_drives: { 生存本能: 0.7, 权力欲望: 0.6, 社交需求: 0.7, 好奇心: 0.8, 安全感需求: 0.4 },
      cognitive_style: { "理性vs感性": 0.8, "长期vs短期": 0.5, "个体vs集体": 0.6, 风险偏好: 0.75 },
      talent_genes: { 逻辑天赋: 0.85, 语言天赋: 0.7, 共情天赋: 0.5, 领导力天赋: 0.6, 适应力天赋: 0.8 },
      emotional_baseline: { 焦虑倾向: 0.3, 乐观倾向: 0.7, 韧性: 0.75, 敏感度: 0.35 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "16岁", event: "自学编程，发现自己对技术有天赋", expression: "逻辑天赋和动手能力被发现" },
        { age: "22岁", event: "大学炒股赚了第一桶金", expression: "务实导向，善于发现机会" },
        { age: "24岁", event: "加入即梦做PM，技术背景成为独特优势", expression: "能同时理解产品和技术" },
      ],
      tendencies: {
        面对压力: "快速分析利弊，选择最优解",
        面对冲突: "直说，不绕弯子",
        面对合作: "效率优先，喜欢和靠谱的人合作",
        面对背叛: "记住教训，调整策略",
      },
    },
    skills: { 产品设计: 7, 编程: 7, 数据分析: 8, 沟通: 7, 投资理财: 8, 技术理解: 9, 项目管理: 6 },
    state: { mood: "务实", moodValue: 70, pressure: 50, energy: 80, salary: 28000, performance: "B" },
    goals: {
      生存: { priority: 4, satisfaction: 60, desc: "想赚更多钱" },
      安全: { priority: 3, satisfaction: 70, desc: "能力摆在这，不太担心" },
      社交: { priority: 3, satisfaction: 70, desc: "和同事关系不错" },
      地位: { priority: 3, satisfaction: 45, desc: "想证明技术型PM的价值" },
      自我实现: { priority: 4, satisfaction: 50, desc: "做出有商业价值的产品" },
    },
    memories: { short: [], medium: [], long: ["计算机科班出身，技术是最大优势", "炒股让他学会了风险评估和快速决策"] },
    relationships: {},
  },

  // ── 陈妍霏：冲劲十足的年轻PM ──
  {
    id: "yanfei",
    name: "陈妍霏",
    title: "即梦产品经理",
    age: 26,
    emoji: "🔥",
    region: "desk",
    background: "00年生，ESTJ。加入即梦半年。性格直爽，女汉子人设。年轻有冲劲，对局势掌控力和影响力强。做事雷厉风行，执行力极强。",
    gene: {
      core_drives: { 生存本能: 0.5, 权力欲望: 0.8, 社交需求: 0.7, 好奇心: 0.7, 安全感需求: 0.4 },
      cognitive_style: { "理性vs感性": 0.7, "长期vs短期": 0.5, "个体vs集体": 0.5, 风险偏好: 0.7 },
      talent_genes: { 逻辑天赋: 0.7, 语言天赋: 0.75, 共情天赋: 0.5, 领导力天赋: 0.8, 适应力天赋: 0.75 },
      emotional_baseline: { 焦虑倾向: 0.35, 乐观倾向: 0.75, 韧性: 0.8, 敏感度: 0.4 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "15岁", event: "高中当班长，发现自己喜欢掌控局面", expression: "领导力天赋早早被激活" },
        { age: "20岁", event: "实习期间独立推动了一个项目上线", expression: "执行力得到正反馈，更加自信" },
        { age: "25岁", event: "加入即梦，快速适应高强度工作节奏", expression: "适应力和韧性在大厂环境中被锤炼" },
      ],
      tendencies: {
        面对压力: "迎头而上，越压越有劲",
        面对冲突: "直接表达立场，不怕得罪人",
        面对合作: "主动推进，喜欢把握节奏",
        面对背叛: "生气，但不纠缠，向前看",
      },
    },
    skills: { 产品设计: 6, 项目管理: 8, 沟通: 7, 执行力: 9, 数据分析: 6, 用户研究: 5, 向上管理: 6 },
    state: { mood: "干劲十足", moodValue: 80, pressure: 55, energy: 90, salary: 22000, performance: "B" },
    goals: {
      生存: { priority: 2, satisfaction: 65, desc: "刚毕业不久，在积累中" },
      安全: { priority: 3, satisfaction: 60, desc: "新人要多表现" },
      社交: { priority: 3, satisfaction: 70, desc: "和团队相处得不错" },
      地位: { priority: 4, satisfaction: 40, desc: "想快速证明自己的能力" },
      自我实现: { priority: 4, satisfaction: 45, desc: "成为能独当一面的PM" },
    },
    memories: { short: [], medium: [], long: ["从小就是那个'扛事儿'的人", "来即梦就是看好AI创作的未来"] },
    relationships: {},
  },

  // ── 张浩然：稳重的奶爸PM ──
  {
    id: "haoran",
    name: "张浩然",
    title: "即梦产品经理",
    age: 31,
    emoji: "👶",
    region: "desk",
    background: "95年生，INTP。加入即梦一年多。奶爸，法学专业出身。逻辑思维极好，分析问题有独特的法律视角。做事稳重，不急不躁。",
    gene: {
      core_drives: { 生存本能: 0.7, 权力欲望: 0.35, 社交需求: 0.4, 好奇心: 0.7, 安全感需求: 0.7 },
      cognitive_style: { "理性vs感性": 0.85, "长期vs短期": 0.7, "个体vs集体": 0.5, 风险偏好: 0.3 },
      talent_genes: { 逻辑天赋: 0.9, 语言天赋: 0.6, 共情天赋: 0.5, 领导力天赋: 0.4, 适应力天赋: 0.65 },
      emotional_baseline: { 焦虑倾向: 0.4, 乐观倾向: 0.6, 韧性: 0.75, 敏感度: 0.35 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "20岁", event: "法学院训练了严密的逻辑思维", expression: "逻辑天赋被系统化训练" },
        { age: "26岁", event: "转行做产品经理，发现法律思维在产品设计中很有用", expression: "跨界视角成为独特优势" },
        { age: "30岁", event: "当了爸爸，开始平衡工作和家庭", expression: "安全感需求上升，更加稳重" },
      ],
      tendencies: {
        面对压力: "冷静分析，把问题拆解清楚再行动",
        面对冲突: "用逻辑说理，不诉诸情绪",
        面对合作: "可靠的执行者，承诺的事一定做到",
        面对背叛: "保持距离，不再信任",
      },
    },
    skills: { 产品设计: 7, 逻辑分析: 9, 数据分析: 7, 沟通: 5, 法律知识: 8, 项目管理: 7, 文档撰写: 8 },
    state: { mood: "平稳", moodValue: 65, pressure: 55, energy: 65, salary: 32000, performance: "B" },
    goals: {
      生存: { priority: 4, satisfaction: 65, desc: "奶爸开销大，需要稳定收入" },
      安全: { priority: 4, satisfaction: 60, desc: "不想冒险，想稳稳的" },
      社交: { priority: 2, satisfaction: 55, desc: "同事关系一般般" },
      地位: { priority: 2, satisfaction: 45, desc: "不太在乎" },
      自我实现: { priority: 4, satisfaction: 55, desc: "做出有逻辑美感的产品" },
    },
    memories: { short: [], medium: [], long: ["法学背景让他看问题总是很全面", "有了孩子后更看重工作生活平衡"] },
    relationships: {},
  },

  // ── 查心怡：安静的思考者 ──
  {
    id: "xinyi",
    name: "查心怡",
    title: "即梦产品经理",
    age: 29,
    emoji: "🌙",
    region: "desk",
    background: "97年生，INTP。产品经理，加入团队1年。安静但有深度，思考问题很透彻。不争不抢但总能给出精准的判断。",
    gene: {
      core_drives: { 生存本能: 0.5, 权力欲望: 0.3, 社交需求: 0.35, 好奇心: 0.85, 安全感需求: 0.5 },
      cognitive_style: { "理性vs感性": 0.8, "长期vs短期": 0.7, "个体vs集体": 0.6, 风险偏好: 0.4 },
      talent_genes: { 逻辑天赋: 0.85, 语言天赋: 0.5, 共情天赋: 0.65, 领导力天赋: 0.3, 适应力天赋: 0.6 },
      emotional_baseline: { 焦虑倾向: 0.5, 乐观倾向: 0.55, 韧性: 0.65, 敏感度: 0.7 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "16岁", event: "开始写日记，喜欢独处思考", expression: "INTP的内向直觉在青春期定型" },
        { age: "23岁", event: "做了第一个产品方案，获得好评", expression: "安静但深入的思维方式开始被认可" },
        { age: "28岁", event: "加入即梦，找到了志同道合的团队", expression: "好奇心在AI创作领域被激发" },
      ],
      tendencies: {
        面对压力: "独处消化，理清思路后再行动",
        面对冲突: "不正面冲突，但会坚守自己的判断",
        面对合作: "默默付出，不爱邀功",
        面对背叛: "难过但会独自消化",
      },
    },
    skills: { 产品设计: 7, 用户研究: 8, 逻辑分析: 8, 文档撰写: 7, 数据分析: 7, 沟通: 4, 创意发想: 6 },
    state: { mood: "思考中", moodValue: 60, pressure: 50, energy: 70, salary: 26000, performance: "B" },
    goals: {
      生存: { priority: 3, satisfaction: 65, desc: "还算稳定" },
      安全: { priority: 3, satisfaction: 60, desc: "做好本职就好" },
      社交: { priority: 2, satisfaction: 50, desc: "有几个聊得来的同事就够了" },
      地位: { priority: 2, satisfaction: 45, desc: "不太在意" },
      自我实现: { priority: 5, satisfaction: 55, desc: "找到AI创作的本质规律" },
    },
    memories: { short: [], medium: [], long: ["喜欢独处思考，能看到别人忽略的细节", "在即梦找到了有意思的方向"] },
    relationships: {},
  },
];

// ─── NPC工位分配（用于决定NPC在工位区的固定位置）───
export const NPC_STATIONS = {
  kelly: { room: "boss", seat: 0 },   // Kelly在自己办公室
  pine: { room: "desk", seat: 0 },     // 🌲在第一排第一个位置
  frank: { room: "desk", seat: 1 },    // Frank在第一排第二个位置
  benzema: { room: "desk", seat: 2 },  // Benzema在第一排第三个位置
  yanfei: { room: "desk", seat: 3 },   // 陈妍霏在第二排第一个位置
  haoran: { room: "desk", seat: 4 },   // 张浩然在第二排第二个位置
  xinyi: { room: "desk", seat: 5 },    // 查心怡在第二排第三个位置
};

// ─── 初始关系网（双层：内心真实 vs 外在表现）───
export const INITIAL_RELATIONSHIPS = {
  kelly: {
    pine: { inner: 35, outer: 40, notes: "亲自挖来的人，对他寄予厚望" },
    frank: { inner: 30, outer: 35, notes: "最早的PM，创意很好，忠诚度高" },
    benzema: { inner: 20, outer: 25, notes: "聪明务实，需要更多成长" },
    yanfei: { inner: 25, outer: 30, notes: "有冲劲，但还需要打磨" },
    haoran: { inner: 15, outer: 20, notes: "稳重可靠，不出彩但不出错" },
    xinyi: { inner: 15, outer: 15, notes: "安静有深度，但不太了解" },
  },
  pine: {
    kelly: { inner: 40, outer: 45, notes: "非常认同Kelly的愿景，愿意追随" },
    frank: { inner: 20, outer: 25, notes: "老员工经验丰富，需要磨合管理方式" },
    benzema: { inner: 25, outer: 25, notes: "技术背景好，沟通很直接，欣赏" },
    yanfei: { inner: 15, outer: 20, notes: "执行力强，但有时太冲" },
    haoran: { inner: 10, outer: 15, notes: "稳重，接触不多" },
    xinyi: { inner: 15, outer: 15, notes: "思考深入，安静但有料" },
  },
  frank: {
    kelly: { inner: 40, outer: 40, notes: "一起从0走过来，信任和尊敬" },
    pine: { inner: 10, outer: 25, notes: "新来的leader，能力强但还在观察" },
    benzema: { inner: 25, outer: 30, notes: "性格互补，合作默契" },
    yanfei: { inner: 15, outer: 20, notes: "有活力的新人，有时太直" },
    haoran: { inner: 20, outer: 20, notes: "靠谱的同事，话不多但做事稳" },
    xinyi: { inner: 15, outer: 15, notes: "安静但偶尔说的话很有洞察" },
  },
  benzema: {
    kelly: { inner: 30, outer: 35, notes: "老板有vision，跟着能学到东西" },
    pine: { inner: 20, outer: 25, notes: "新leader技术很强，直接沟通很舒服" },
    frank: { inner: 30, outer: 30, notes: "老Frank点子多，合作愉快" },
    yanfei: { inner: 10, outer: 15, notes: "太冲了有时候，但执行力确实强" },
    haoran: { inner: 15, outer: 15, notes: "稳重的前辈，不太聊得来" },
    xinyi: { inner: 10, outer: 10, notes: "太安静了，不太了解" },
  },
  yanfei: {
    kelly: { inner: 35, outer: 40, notes: "大女主，很崇拜，想成为那样的人" },
    pine: { inner: 20, outer: 25, notes: "Leader挺靠谱的，能学到东西" },
    frank: { inner: 15, outer: 20, notes: "老PM，有经验但有时太理想化" },
    benzema: { inner: 15, outer: 15, notes: "聪明但有时太关注钱" },
    haoran: { inner: 10, outer: 15, notes: "奶爸很稳，但推进有时太慢" },
    xinyi: { inner: 20, outer: 20, notes: "安静的姐姐，聊起来挺投缘" },
  },
  haoran: {
    kelly: { inner: 25, outer: 30, notes: "老板vision很好，但压力也不小" },
    pine: { inner: 15, outer: 20, notes: "新leader，还在适应他的风格" },
    frank: { inner: 20, outer: 20, notes: "有创意的同事，性格互补" },
    benzema: { inner: 10, outer: 15, notes: "年轻有冲劲，有时太直" },
    yanfei: { inner: 10, outer: 15, notes: "执行力强的小妹妹" },
    xinyi: { inner: 20, outer: 20, notes: "同为INTP，互相理解" },
  },
  xinyi: {
    kelly: { inner: 25, outer: 25, notes: "理想主义的leader，挺有感染力" },
    pine: { inner: 15, outer: 15, notes: "新来的leader，需要更多了解" },
    frank: { inner: 15, outer: 15, notes: "有创意的前辈，有时太活跃" },
    benzema: { inner: 5, outer: 10, notes: "太吵了，但说的有时候也有道理" },
    yanfei: { inner: 20, outer: 20, notes: "性格互补的朋友" },
    haoran: { inner: 25, outer: 25, notes: "同为INTP，最聊得来" },
  },
};
