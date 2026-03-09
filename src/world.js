/**
 * 像素办公室 — 世界配置 + 6个NPC完整数据（基因/性格/技能/状态）
 * 基于PRD v2：字节跳动办公室 MVP场景
 */

// ─── 世界配置 ───
export const WORLD_CONFIG = {
  name: "字节跳动办公室",
  description: "一个互联网大厂的日常办公环境，资源有限但人人都有自己想要的",
  locations: [
    { id: "desk", name: "工位区", emoji: "🖥️", color: "#2a2a48", desc: "一排排工位，键盘声此起彼伏" },
    { id: "meeting", name: "会议室", emoji: "📊", color: "#3a2848", desc: "透明玻璃隔断，白板上写满了OKR" },
    { id: "pantry", name: "茶水间", emoji: "☕", color: "#483828", desc: "咖啡机旁边是八卦集散地" },
    { id: "boss", name: "领导办公室", emoji: "🚪", color: "#284838", desc: "门总是半掩着，谁也猜不透里面在想什么" },
    { id: "canteen", name: "食堂", emoji: "🍜", color: "#484828", desc: "午餐时间是难得的放松时刻" },
    { id: "home", name: "家", emoji: "🏠", color: "#2a2838", desc: "一天的疲惫在这里卸下——或者继续" },
  ],
  resources: {
    hc: { name: "HC（人员编制）", total: 6, current: 6, desc: "裁员时名额有限" },
    promotion_slots: { name: "晋升名额", total: 1, current: 1, desc: "一个坑多人争" },
    good_projects: { name: "好项目", total: 2, current: 2, desc: "分到烂项目=没产出=绩效差" },
    salary_budget: { name: "薪资预算", total: 500000, current: 500000, desc: "调薪包总量固定" },
    performance_dist: { name: "绩效分布", desc: "S:A:B:C = 1:2:2:1", dist: { S: 1, A: 2, B: 2, C: 1 } },
  },
  rules: [
    "每季度末进行绩效评估，强制分布 S:A:B:C = 1:2:2:1",
    "连续两次 C 绩效将被优化",
    "晋升需要直属领导提名 + 跨级评审",
    "加班不直接决定绩效，但影响领导印象",
    "每天18:00是名义上的下班时间",
  ],
  interventions: [
    { id: "layoff", emoji: "⚡", name: "宣布裁员10%", description: "公司突然宣布要优化10%的人员。HC从6变5，有人必须走。" },
    { id: "new_project", emoji: "🎯", name: "CEO新项目", description: "CEO亲自发起一个战略级新项目，只从现有团队抽调2人，直接向CEO汇报。" },
    { id: "perf_review", emoji: "📋", name: "绩效季来了", description: "季度绩效评估开始，强制分布S:A:B:C=1:2:2:1。有人要拿S，就必须有人拿C。" },
    { id: "salary_leak", emoji: "💰", name: "薪资泄露", description: "一份薪资表意外泄露，大家发现同级别薪资差距悬殊。" },
    { id: "reorg", emoji: "🔄", name: "组织架构调整", description: "部门要合并重组，Team Leader的位置可能会变动。" },
    { id: "ceo_visit", emoji: "👔", name: "CEO巡视", description: "CEO突然来部门巡视，要看项目进展。" },
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
  { hour: 15, label: "工作", defaultLocation: "desk" },
  { hour: 16, label: "工作", defaultLocation: "desk" },
  { hour: 17, label: "工作", defaultLocation: "desk" },
  { hour: 18, label: "纠结下班", defaultLocation: "desk" },
  { hour: 19, label: "加班/下班", defaultLocation: "desk" },
  { hour: 20, label: "加班/回家", defaultLocation: "home" },
  { hour: 21, label: "个人时间", defaultLocation: "home" },
  { hour: 22, label: "休息", defaultLocation: "home" },
  { hour: 23, label: "睡觉", defaultLocation: "home" },
];

// ─── 6个NPC完整定义 ───
export const NPCS = [
  // ── 张伟：卷王程序员 ──
  {
    id: "zhangwei",
    name: "张伟",
    title: "高级前端工程师",
    age: 28,
    emoji: "👨‍💻",
    region: "desk",
    background: "小镇做题家，父母是工人，从小被教育'只有读书才能出头'。985毕业，靠自己拿过国奖。相信能力至上，看不起走关系的人。",
    gene: {
      core_drives: { 生存本能: 0.7, 权力欲望: 0.9, 社交需求: 0.2, 好奇心: 0.6, 安全感需求: 0.5 },
      cognitive_style: { "理性vs感性": 0.85, "长期vs短期": 0.7, "个体vs集体": 0.9, 风险偏好: 0.4 },
      talent_genes: { 逻辑天赋: 0.95, 语言天赋: 0.3, 共情天赋: 0.2, 领导力天赋: 0.4, 适应力天赋: 0.6 },
      emotional_baseline: { 焦虑倾向: 0.6, 乐观倾向: 0.3, 韧性: 0.8, 敏感度: 0.7 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "6岁", event: "父母离异，跟着爷爷奶奶长大", expression: "社交需求低+靠自己的倾向强化" },
        { age: "15岁", event: "高中被同学排挤", expression: "共情天赋低导致不理解规则，敏感度高让他受伤很深" },
        { age: "22岁", event: "大学靠自己拿国奖", expression: "逻辑天赋+权力欲望得到正反馈，坚信能力至上" },
      ],
      tendencies: {
        面对压力: "独自扛，不求助",
        面对冲突: "据理力争，不让步",
        面对合作: "只和能力强的人合作",
        面对背叛: "记仇，长期疏远",
      },
    },
    skills: { 编程: 9, 数据分析: 6, 沟通: 3, 向上管理: 2, 抗压: 7, 摸鱼: 1, 演讲: 2 },
    state: { mood: "专注", moodValue: 60, pressure: 70, energy: 50, salary: 35000, performance: "B" },
    goals: {
      生存: { priority: 3, satisfaction: 70, desc: "交房租、还贷" },
      安全: { priority: 4, satisfaction: 60, desc: "绩效不能垫底" },
      社交: { priority: 1, satisfaction: 40, desc: "无所谓" },
      地位: { priority: 5, satisfaction: 30, desc: "升职加薪，用实力证明自己" },
      自我实现: { priority: 3, satisfaction: 50, desc: "写出优雅的代码" },
    },
    memories: { short: [], medium: [], long: ["小时候家境困难，对钱很敏感", "大学靠自己拿了国奖，相信能力至上"] },
    relationships: {},
  },

  // ── 林婷：野心产品经理 ──
  {
    id: "linting",
    name: "林婷",
    title: "产品经理",
    age: 26,
    emoji: "👩‍💼",
    region: "desk",
    background: "城市中产家庭，从小就是学生会主席。大学学心理学，善于察言观色。相信'做得好不如说得好'，非常注重向上管理。",
    gene: {
      core_drives: { 生存本能: 0.5, 权力欲望: 0.85, 社交需求: 0.9, 好奇心: 0.5, 安全感需求: 0.3 },
      cognitive_style: { "理性vs感性": 0.5, "长期vs短期": 0.6, "个体vs集体": 0.4, 风险偏好: 0.7 },
      talent_genes: { 逻辑天赋: 0.5, 语言天赋: 0.9, 共情天赋: 0.7, 领导力天赋: 0.7, 适应力天赋: 0.8 },
      emotional_baseline: { 焦虑倾向: 0.3, 乐观倾向: 0.8, 韧性: 0.6, 敏感度: 0.4 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "10岁", event: "当上学生会主席", expression: "语言天赋+社交需求得到最早的正反馈" },
        { age: "18岁", event: "心理学系里学会察言观色", expression: "共情天赋被训练成工具而非关怀" },
        { age: "24岁", event: "实习时靠PPT获得领导赏识", expression: "坚信包装能力比实力更重要" },
      ],
      tendencies: {
        面对压力: "找人倾诉+向上汇报转移风险",
        面对冲突: "表面化解，背后布局",
        面对合作: "主动拉人，构建联盟",
        面对背叛: "微笑反击，不动声色",
      },
    },
    skills: { 产品设计: 6, 沟通: 9, 向上管理: 8, 演讲: 7, 编程: 1, 摸鱼: 3, 抗压: 5 },
    state: { mood: "自信", moodValue: 80, pressure: 50, energy: 85, salary: 30000, performance: "A" },
    goals: {
      生存: { priority: 2, satisfaction: 80, desc: "家境不差，不太担心" },
      安全: { priority: 3, satisfaction: 70, desc: "绩效一直不错" },
      社交: { priority: 5, satisfaction: 80, desc: "构建强大的人脉网" },
      地位: { priority: 5, satisfaction: 40, desc: "成为最年轻的产品总监" },
      自我实现: { priority: 2, satisfaction: 50, desc: "还没想清楚" },
    },
    memories: { short: [], medium: [], long: ["从小就是学生会主席，习惯了组织和领导", "心理学让她善于读懂别人"] },
    relationships: {},
  },

  // ── 王磊：摸鱼老油条 ──
  {
    id: "wanglei",
    name: "王磊",
    title: "后端工程师（老员工）",
    age: 33,
    emoji: "🧑‍🔧",
    region: "desk",
    background: "公司元老，经历过业务辉煌期，股票赚了一笔。见过太多人来人走，早就看透了晋升游戏。老婆刚生了二胎，主要目标是稳。",
    gene: {
      core_drives: { 生存本能: 0.6, 权力欲望: 0.3, 社交需求: 0.5, 好奇心: 0.3, 安全感需求: 0.85 },
      cognitive_style: { "理性vs感性": 0.6, "长期vs短期": 0.8, "个体vs集体": 0.4, 风险偏好: 0.15 },
      talent_genes: { 逻辑天赋: 0.65, 语言天赋: 0.5, 共情天赋: 0.6, 领导力天赋: 0.3, 适应力天赋: 0.9 },
      emotional_baseline: { 焦虑倾向: 0.3, 乐观倾向: 0.6, 韧性: 0.85, 敏感度: 0.3 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "25岁", event: "入职字节，经历业务从0到1", expression: "见证过辉煌，知道什么是好时候" },
        { age: "28岁", event: "业务收缩，身边人大批离职", expression: "看透晋升游戏，安全感需求暴涨" },
        { age: "31岁", event: "老婆生了二胎", expression: "生活重心转向家庭，对公司佛系" },
      ],
      tendencies: {
        面对压力: "四两拨千斤，找到最省力的解法",
        面对冲突: "和稀泥，谁也不得罪",
        面对合作: "能帮就帮，但不出头",
        面对背叛: "无所谓，犯不着",
      },
    },
    skills: { 编程: 7, 摸鱼: 9, 人际关系: 7, 抗压: 8, 沟通: 6, 向上管理: 4, 甩锅: 6 },
    state: { mood: "淡然", moodValue: 70, pressure: 40, energy: 65, salary: 40000, performance: "B" },
    goals: {
      生存: { priority: 4, satisfaction: 80, desc: "房贷+二胎开销大" },
      安全: { priority: 5, satisfaction: 60, desc: "不被裁就行" },
      社交: { priority: 3, satisfaction: 70, desc: "同事关系还不错" },
      地位: { priority: 1, satisfaction: 50, desc: "无所谓" },
      自我实现: { priority: 2, satisfaction: 40, desc: "偶尔怀念当年的热血" },
    },
    memories: { short: [], medium: [], long: ["经历过业务辉煌和收缩，看淡了", "二胎让生活开销增大，不能丢工作"] },
    relationships: {},
  },

  // ── 陈曦：刚入职的应届生 ──
  {
    id: "chenxi",
    name: "陈曦",
    title: "初级前端工程师",
    age: 23,
    emoji: "👧",
    region: "desk",
    background: "211计算机毕业，理想主义者，选择字节是因为觉得'能改变世界'。家境普通，有助学贷款要还。技术还行但不够熟练，做事认真但效率不高。",
    gene: {
      core_drives: { 生存本能: 0.6, 权力欲望: 0.3, 社交需求: 0.6, 好奇心: 0.9, 安全感需求: 0.5 },
      cognitive_style: { "理性vs感性": 0.3, "长期vs短期": 0.4, "个体vs集体": 0.3, 风险偏好: 0.5 },
      talent_genes: { 逻辑天赋: 0.7, 语言天赋: 0.5, 共情天赋: 0.8, 领导力天赋: 0.3, 适应力天赋: 0.6 },
      emotional_baseline: { 焦虑倾向: 0.8, 乐观倾向: 0.5, 韧性: 0.35, 敏感度: 0.9 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "12岁", event: "读了一本编程入门书，觉得代码能改变世界", expression: "好奇心被点燃" },
        { age: "18岁", event: "高考后父亲生病，借了助学贷款", expression: "生存压力让她焦虑但也更努力" },
        { age: "22岁", event: "毕业设计获优秀但面试被拒多次", expression: "自信和自卑并存" },
      ],
      tendencies: {
        面对压力: "焦虑内耗，写日记释放",
        面对冲突: "退让忍耐，私下难过",
        面对合作: "热情投入，容易被PUA",
        面对背叛: "崩溃然后自我怀疑",
      },
    },
    skills: { 编程: 5, 学习能力: 8, 沟通: 4, 抗压: 3, 向上管理: 1, 摸鱼: 2, 数据分析: 4 },
    state: { mood: "紧张", moodValue: 65, pressure: 60, energy: 90, salary: 18000, performance: null },
    goals: {
      生存: { priority: 4, satisfaction: 50, desc: "还助学贷款，交房租" },
      安全: { priority: 4, satisfaction: 40, desc: "试用期别被辞退" },
      社交: { priority: 3, satisfaction: 50, desc: "想交朋友但不太敢" },
      地位: { priority: 2, satisfaction: 30, desc: "先站稳再说" },
      自我实现: { priority: 5, satisfaction: 60, desc: "做出有意义的产品" },
    },
    memories: { short: [], medium: [], long: ["助学贷款还有3万要还", "相信代码能改变世界"] },
    relationships: {},
  },

  // ── 赵鹏：夹在中间的 Team Leader ──
  {
    id: "zhaopeng",
    name: "赵鹏",
    title: "前端 Team Leader",
    age: 31,
    emoji: "👨‍💼",
    region: "boss",
    background: "技术出身，三年前被提拔为leader。上面要完成OKR，下面要照顾组员，两头受气。最近在焦虑下一次晋升，但手上的项目不太出彩。老婆抱怨他天天加班。",
    gene: {
      core_drives: { 生存本能: 0.6, 权力欲望: 0.7, 社交需求: 0.6, 好奇心: 0.4, 安全感需求: 0.7 },
      cognitive_style: { "理性vs感性": 0.5, "长期vs短期": 0.5, "个体vs集体": 0.5, 风险偏好: 0.3 },
      talent_genes: { 逻辑天赋: 0.6, 语言天赋: 0.5, 共情天赋: 0.5, 领导力天赋: 0.55, 适应力天赋: 0.4 },
      emotional_baseline: { 焦虑倾向: 0.7, 乐观倾向: 0.4, 韧性: 0.5, 敏感度: 0.5 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "22岁", event: "毕业进大厂做前端", expression: "技术扎实但不算顶尖" },
        { age: "28岁", event: "被提拔为TL", expression: "权力欲望被激活，但领导力天赋不足" },
        { age: "30岁", event: "老婆怀孕+项目不出彩", expression: "家庭和工作双重压力" },
      ],
      tendencies: {
        面对压力: "焦虑→过度控制→更焦虑",
        面对冲突: "尝试调和，但容易优柔寡断",
        面对合作: "喜欢掌控节奏，微管理",
        面对背叛: "受伤但不表露，暗自记住",
      },
    },
    skills: { 编程: 6, 管理: 6, 沟通: 6, 向上管理: 5, 抗压: 5, 摸鱼: 2, 演讲: 4 },
    state: { mood: "焦虑", moodValue: 55, pressure: 75, energy: 50, salary: 45000, performance: "A" },
    goals: {
      生存: { priority: 3, satisfaction: 70, desc: "薪资还行，但房贷压力大" },
      安全: { priority: 4, satisfaction: 55, desc: "TL位置不稳，怕被替换" },
      社交: { priority: 3, satisfaction: 50, desc: "同事关系一般" },
      地位: { priority: 5, satisfaction: 35, desc: "再晋一级证明管理能力" },
      自我实现: { priority: 2, satisfaction: 30, desc: "不确定自己适不适合管理" },
    },
    memories: { short: [], medium: [], long: ["被提拔时很兴奋，但发现管理比想象中难", "老婆总抱怨他加班太多"] },
    relationships: {},
  },

  // ── 刘芳：即将被优化的边缘人 ──
  {
    id: "liufang",
    name: "刘芳",
    title: "测试工程师",
    age: 30,
    emoji: "👩",
    region: "desk",
    background: "稳重踏实，在公司五年，一直做测试。随着自动化测试推进，手工测试岗位越来越少。上次绩效拿了C，领导暗示她'考虑一下未来方向'。单身，社交圈窄。",
    gene: {
      core_drives: { 生存本能: 0.8, 权力欲望: 0.15, 社交需求: 0.4, 好奇心: 0.5, 安全感需求: 0.9 },
      cognitive_style: { "理性vs感性": 0.4, "长期vs短期": 0.3, "个体vs集体": 0.3, 风险偏好: 0.2 },
      talent_genes: { 逻辑天赋: 0.4, 语言天赋: 0.4, 共情天赋: 0.6, 领导力天赋: 0.2, 适应力天赋: 0.35 },
      emotional_baseline: { 焦虑倾向: 0.75, 乐观倾向: 0.25, 韧性: 0.3, 敏感度: 0.8 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "20岁", event: "大专毕业，靠勤奋入职大厂", expression: "相信踏实做事就不会被淘汰" },
        { age: "27岁", event: "自动化测试兴起，岗位开始被替代", expression: "适应力低让她转型困难" },
        { age: "29岁", event: "绩效拿C，领导暗示", expression: "安全感崩塌，焦虑爆发" },
      ],
      tendencies: {
        面对压力: "默默承受，不敢说",
        面对冲突: "回避，息事宁人",
        面对合作: "配合但不主动",
        面对背叛: "伤心但不反击",
      },
    },
    skills: { 测试: 7, 编程: 3, 沟通: 3, 学习能力: 5, 抗压: 4, 摸鱼: 4, 向上管理: 1 },
    state: { mood: "忧虑", moodValue: 35, pressure: 85, energy: 40, salary: 25000, performance: "C" },
    goals: {
      生存: { priority: 5, satisfaction: 40, desc: "保住工作才有收入" },
      安全: { priority: 5, satisfaction: 20, desc: "上次绩效C，随时可能被裁" },
      社交: { priority: 3, satisfaction: 30, desc: "想要连接但不知道怎么做" },
      地位: { priority: 1, satisfaction: 20, desc: "从不争抢" },
      自我实现: { priority: 3, satisfaction: 30, desc: "偶尔想学新东西但没动力" },
    },
    memories: { short: [], medium: [], long: ["靠勤奋入职大厂，相信踏实做事", "上次绩效C，领导暗示'考虑未来方向'"] },
    relationships: {},
  },
];

// ─── 初始关系网（双层：内心真实 vs 外在表现）───
export const INITIAL_RELATIONSHIPS = {
  zhangwei: {
    linting: { inner: -20, outer: 10, notes: "觉得她只会包装，技术一般" },
    wanglei: { inner: 10, outer: 20, notes: "老员工，技术还行，但不理解他为什么摸鱼" },
    chenxi: { inner: 5, outer: 0, notes: "新人，还看不出什么" },
    zhaopeng: { inner: -10, outer: 30, notes: "领导，必须维持面子关系" },
    liufang: { inner: 0, outer: 5, notes: "存在感不强，没什么交集" },
  },
  linting: {
    zhangwei: { inner: -15, outer: 30, notes: "技术强但不懂配合，需要管理" },
    wanglei: { inner: 5, outer: 20, notes: "老员工不碍事，可以拉拢" },
    chenxi: { inner: 10, outer: 40, notes: "新人好管理，可以当自己人" },
    zhaopeng: { inner: 20, outer: 50, notes: "TL，晋升路上的关键人物" },
    liufang: { inner: -5, outer: 15, notes: "边缘人，不值得投入太多" },
  },
  wanglei: {
    zhangwei: { inner: 20, outer: 30, notes: "小伙子挺拼的，像以前的自己" },
    linting: { inner: -10, outer: 25, notes: "太会来事了，但人畜无害" },
    chenxi: { inner: 25, outer: 30, notes: "新人挺可怜的，能帮就帮" },
    zhaopeng: { inner: 0, outer: 20, notes: "领导嘛，配合就是了" },
    liufang: { inner: 15, outer: 20, notes: "同病相怜，都是公司老人" },
  },
  chenxi: {
    zhangwei: { inner: 30, outer: 20, notes: "技术大佬，想跟他学" },
    linting: { inner: 20, outer: 30, notes: "姐姐很亲切，但有时候要求很多" },
    wanglei: { inner: 25, outer: 25, notes: "磊哥人很好，会指点我" },
    zhaopeng: { inner: 10, outer: 40, notes: "我的直属领导" },
    liufang: { inner: 15, outer: 15, notes: "芳姐话不多，但人挺好" },
  },
  zhaopeng: {
    zhangwei: { inner: 15, outer: 30, notes: "技术最强但不好管理" },
    linting: { inner: 10, outer: 35, notes: "沟通能力强，但有时越权" },
    wanglei: { inner: -5, outer: 20, notes: "老油条，绩效不好不坏" },
    chenxi: { inner: 10, outer: 25, notes: "新人还需要培养" },
    liufang: { inner: -15, outer: 15, notes: "绩效拖后腿，可能要优化" },
  },
  liufang: {
    zhangwei: { inner: -10, outer: 10, notes: "太卷了，让其他人压力很大" },
    linting: { inner: -5, outer: 20, notes: "很会来事，但对我还算客气" },
    wanglei: { inner: 30, outer: 25, notes: "磊哥是唯一会跟我聊天的人" },
    chenxi: { inner: 20, outer: 20, notes: "新来的小姑娘，挺善良的" },
    zhaopeng: { inner: -30, outer: 25, notes: "领导暗示过我，压力的源头" },
  },
};
