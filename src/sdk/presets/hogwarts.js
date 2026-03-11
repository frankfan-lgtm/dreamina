/**
 * 预设世界：霍格沃茨魔法学校
 * 哈利波特世界观 — 大战前夕的紧张氛围
 */

export const HOGWARTS_CONFIG = {
  name: "霍格沃茨魔法学校",
  description: "魔法世界的最高学府，伏地魔的阴影正在蔓延。学校表面平静但暗流涌动，每个人都必须在光明与黑暗之间做出选择。邓布利多军秘密训练，食死徒渗透校园，魔法部试图控制一切。",
  locations: [
    { id: "great_hall", name: "大礼堂", emoji: "🏰", color: "#b8a070", desc: "四大学院共同用餐的地方，消息流通最快。天花板映射着外面的天空，四条长桌上方飘浮着无数蜡烛。" },
    { id: "library", name: "图书馆", emoji: "📚", color: "#8a7a60", desc: "平斯夫人管理的知识圣殿，禁书区藏着危险的黑魔法典籍。安静但暗流涌动。" },
    { id: "dungeon", name: "地牢教室", emoji: "🧪", color: "#5a6a58", desc: "斯内普的领地，阴暗潮湿，药剂瓶在架子上闪着幽光。空气中弥漫着草药和魔药的气味。" },
    { id: "grounds", name: "城堡庭院", emoji: "🌲", color: "#6a8a58", desc: "通往禁林、魁地奇球场和海格小屋。开阔但并不总是安全。" },
    { id: "tower", name: "天文塔", emoji: "🗼", color: "#7080a0", desc: "霍格沃茨最高的塔楼，俯瞰整个校园。私密对话和重大事件的发生地。" },
    { id: "room_of_req", name: "有求必应屋", emoji: "🚪", color: "#9080a8", desc: "只在真正需要时出现的神秘房间。邓布利多军的秘密训练基地。" },
  ],
  resources: {
    house_points: { name: "格兰芬多学院杯积分", total: 500, current: 312, desc: "学院荣誉的象征，加分扣分影响每个人" },
    da_progress: { name: "邓布利多军训练进度", total: 100, current: 25, desc: "秘密组织的战斗力" },
    voldemort_threat: { name: "伏地魔势力", total: 100, current: 65, desc: "黑暗力量在不断壮大" },
    ministry_trust: { name: "魔法部对霍格沃茨信任度", total: 100, current: 30, desc: "魔法部正在失去对学校的信任" },
    phoenix_intel: { name: "凤凰社情报", total: 100, current: 40, desc: "关于敌方动向的情报积累" },
  },
  rules: [
    "霍格沃茨曾是最安全的地方，但这份安全正在被侵蚀",
    "魔法部正在向学校派驻调查员，试图控制教学内容",
    "学生禁止进入禁林——但总有人违反",
    "邓布利多军是秘密组织，暴露意味着被开除",
    "预言的内容只有极少数人知道：非此即彼，必有一亡",
    "宵禁后不得在走廊游荡，但巡夜的不只是教师",
  ],
  interventions: [
    { id: "dark_mark", emoji: "🐍", name: "黑魔标记升起", description: "霍格沃茨上空突然出现了黑魔标记。是食死徒入侵的先兆，还是有人故意制造恐慌？全校陷入混乱。" },
    { id: "prophet_headline", emoji: "📰", name: "预言家日报头条", description: "《预言家日报》刊登爆炸性消息，指控霍格沃茨内部有人暗通伏地魔。人人自危，互相猜忌。" },
    { id: "forbidden_forest", emoji: "🌲", name: "禁林异动", description: "禁林深处传来巨大声响，半人马带来不祥预言：'火星与土星相交，大难将至'。" },
    { id: "ministry_audit", emoji: "🏛️", name: "魔法部入驻", description: "魔法部派出审查员进驻霍格沃茨，要求审查所有师生的魔杖使用记录。配合还是抵抗？" },
    { id: "deatheater_attack", emoji: "💀", name: "食死徒试探", description: "学校边界的防护咒在深夜被试探性攻击，闪烁了几秒后恢复。有人在测试防线的弱点。" },
    { id: "chamber_warning", emoji: "🐍", name: "密室预兆", description: "校内墙壁上出现了血红色的文字——'密室已被打开，传人的敌人们，当心了'。是恶作剧还是真正的威胁？" },
  ],
};

export const HOGWARTS_SCHEDULE = [
  { hour: 7, label: "起床 → 早餐", defaultLocation: "great_hall" },
  { hour: 10, label: "课程 → 课间", defaultLocation: "dungeon" },
  { hour: 13, label: "午餐 → 自习", defaultLocation: "library" },
  { hour: 16, label: "魁地奇/社团 → 晚餐", defaultLocation: "grounds" },
  { hour: 19, label: "秘密活动 → 宵禁前", defaultLocation: "room_of_req" },
  { hour: 22, label: "宵禁 → 深夜", defaultLocation: "tower" },
];

export const HOGWARTS_NPCS = [
  // ── 哈利·波特：大难不死的男孩 ──
  {
    id: "harry",
    name: "哈利·波特",
    title: "格兰芬多学生 / 救世之星",
    age: 15,
    emoji: "⚡",
    gender: "male",
    region: "great_hall",
    background: "大难不死的男孩，额头上的闪电疤痕是伏地魔留下的印记。从小在德思礼家的楼梯间长大，11岁才知道自己是巫师。勇敢到近乎鲁莽，直觉敏锐但容易冲动。背负预言的重压，内心深处恐惧自己与伏地魔的精神联系。对朋友极度忠诚，但有时独断独行，觉得只有自己才能承担一切。ISFP，用价值观和本能做决定。",
    gene: {
      core_drives: { 生存本能: 0.7, 权力欲望: 0.3, 社交需求: 0.6, 好奇心: 0.8, 安全感需求: 0.4 },
      cognitive_style: { "理性vs感性": 0.35, "长期vs短期": 0.4, "个体vs集体": 0.6, 风险偏好: 0.9 },
      talent_genes: { 逻辑天赋: 0.5, 语言天赋: 0.5, 共情天赋: 0.7, 领导力天赋: 0.8, 适应力天赋: 0.85 },
      emotional_baseline: { 焦虑倾向: 0.6, 乐观倾向: 0.5, 韧性: 0.9, 敏感度: 0.7 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "1岁", event: "伏地魔杀害父母，死咒反弹留下疤痕", expression: "生存本能和勇气的根源——从第一天起就是幸存者" },
        { age: "11岁", event: "收到霍格沃茨录取信，第一次知道自己是巫师", expression: "好奇心被点燃，终于找到了归属感" },
        { age: "14岁", event: "在三强争霸赛中目睹塞德里克被杀", expression: "创伤记忆让他更加坚定要对抗伏地魔，但也更孤独" },
      ],
      tendencies: {
        面对压力: "冲在最前面，宁可自己扛也不愿连累朋友",
        面对冲突: "情绪化但正义感极强，容易被激怒",
        面对合作: "信任朋友但不擅长求助，常常独断独行",
        面对背叛: "极度受伤，但最终会原谅——如果对方是真心的",
      },
    },
    skills: { 黑魔法防御: 9, 飞行术: 10, 勇气: 10, 魔咒学: 7, 草药学: 5, 魔药学: 4, 领导力: 7 },
    state: { mood: "警觉而坚定", moodValue: 55, pressure: 75, energy: 70, salary: 0, performance: "O(优秀)" },
    goals: {
      生存: { priority: 5, satisfaction: 40, desc: "伏地魔想杀他，每天都可能是最后一天" },
      安全: { priority: 4, satisfaction: 35, desc: "霍格沃茨不再安全" },
      社交: { priority: 3, satisfaction: 65, desc: "有罗恩和赫敏，但感觉自己在把他们拖入危险" },
      地位: { priority: 1, satisfaction: 30, desc: "不想当'救世之星'，但没得选" },
      自我实现: { priority: 4, satisfaction: 45, desc: "保护所有人，终结伏地魔" },
    },
    memories: { short: [], medium: [], long: ["父母为保护自己而死，这份爱是最强大的魔法", "在墓地亲眼看到伏地魔复活，没有人相信自己", "预言说'非此即彼，必有一亡'"] },
    relationships: {},
  },

  // ── 赫敏·格兰杰：最聪明的女巫 ──
  {
    id: "hermione",
    name: "赫敏·格兰杰",
    title: "格兰芬多学生 / 学霸",
    age: 15,
    emoji: "📖",
    gender: "female",
    region: "library",
    background: "麻瓜出身的天才女巫，每门课都是全年级第一。靠知识和逻辑解决一切问题，是团队真正的大脑。麻瓜出身让她内心深处有不安全感，因此加倍努力证明自己配得上魔法世界。有时过于依赖规则和权威，但在关键时刻能突破框架做出大胆决定。ISTJ/INTJ切换，纪律与智慧的结合。",
    gene: {
      core_drives: { 生存本能: 0.5, 权力欲望: 0.4, 社交需求: 0.5, 好奇心: 0.95, 安全感需求: 0.6 },
      cognitive_style: { "理性vs感性": 0.85, "长期vs短期": 0.8, "个体vs集体": 0.4, 风险偏好: 0.4 },
      talent_genes: { 逻辑天赋: 0.95, 语言天赋: 0.85, 共情天赋: 0.6, 领导力天赋: 0.6, 适应力天赋: 0.7 },
      emotional_baseline: { 焦虑倾向: 0.6, 乐观倾向: 0.6, 韧性: 0.8, 敏感度: 0.65 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "5岁", event: "在学校因为'怪事'被同学排挤，靠读书逃避孤独", expression: "知识成为安全感的来源，好奇心被极度强化" },
        { age: "11岁", event: "收到霍格沃茨录取信，终于理解了自己的与众不同", expression: "用加倍努力证明麻瓜出身的巫师同样出色" },
        { age: "14岁", event: "用时间转换器和逻辑帮助哈利完成多次冒险", expression: "确认了自己在团队中不可替代的价值" },
      ],
      tendencies: {
        面对压力: "去图书馆查资料，相信知识能解决一切",
        面对冲突: "引用规则和逻辑，有时显得固执但通常是对的",
        面对合作: "主动承担最难的部分，但也希望别人同样努力",
        面对背叛: "分析对方动机，不轻易原谅但也不记仇",
      },
    },
    skills: { 魔咒学: 10, 魔药学: 9, 变形术: 9, 古代符文: 9, 逻辑分析: 10, 黑魔法防御: 8, 草药学: 8 },
    state: { mood: "专注但忧虑", moodValue: 60, pressure: 70, energy: 75, salary: 0, performance: "O+(杰出)" },
    goals: {
      生存: { priority: 3, satisfaction: 55, desc: "只要哈利安全，自己也安全" },
      安全: { priority: 3, satisfaction: 50, desc: "对麻瓜出身巫师的歧视让她不安" },
      社交: { priority: 3, satisfaction: 70, desc: "有最好的朋友，但不被所有人理解" },
      地位: { priority: 4, satisfaction: 75, desc: "学业上无人能及" },
      自我实现: { priority: 5, satisfaction: 60, desc: "用知识保护朋友，改变魔法世界的不公" },
    },
    memories: { short: [], medium: [], long: ["从小就知道自己'不一样'，霍格沃茨给了她答案", "麻瓜出身是事实但不是缺陷，要用实力证明一切"] },
    relationships: {},
  },

  // ── 西弗勒斯·斯内普：双面间谍 ──
  {
    id: "snape",
    name: "斯内普",
    title: "魔药学教授 / 双面间谍",
    age: 35,
    emoji: "🧪",
    gender: "male",
    region: "dungeon",
    background: "霍格沃茨最让人畏惧的教授，魔药大师。表面是冷酷刻薄的前食死徒，实际上是邓布利多最信任的双面间谍。一切的根源是对莉莉·波特至死不渝的爱。用尖酸刻薄保护自己脆弱的内心。对哈利态度极其矛盾——既痛恨詹姆·波特的影子，又用生命保护莉莉之子。INTJ，理性冷酷但内心翻涌。",
    gene: {
      core_drives: { 生存本能: 0.6, 权力欲望: 0.5, 社交需求: 0.15, 好奇心: 0.7, 安全感需求: 0.3 },
      cognitive_style: { "理性vs感性": 0.75, "长期vs短期": 0.9, "个体vs集体": 0.8, 风险偏好: 0.7 },
      talent_genes: { 逻辑天赋: 0.9, 语言天赋: 0.7, 共情天赋: 0.3, 领导力天赋: 0.6, 适应力天赋: 0.85 },
      emotional_baseline: { 焦虑倾向: 0.5, 乐观倾向: 0.15, 韧性: 0.95, 敏感度: 0.8 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "9岁", event: "在斯平纳尾巷遇到莉莉·伊万斯，生命中第一道光", expression: "对莉莉的爱成为此后一切选择的底层驱动" },
        { age: "20岁", event: "将预言告知伏地魔导致莉莉被杀，余生都在赎罪", expression: "自责和愧疚转化为绝对的忠诚——对邓布利多，对莉莉的遗愿" },
        { age: "31岁", event: "哈利入学，那双绿色的眼睛——莉莉的眼睛", expression: "痛恨詹姆的儿子，但无法不保护莉莉的儿子" },
      ],
      tendencies: {
        面对压力: "更加冷酷和刻薄，用攻击性掩饰脆弱",
        面对冲突: "用讽刺和智力碾压对手，从不正面暴露真实情感",
        面对合作: "只信任邓布利多一个人，对其他人保持距离",
        面对背叛: "不原谅，但会利用——他自己就是最大的'叛徒'",
      },
    },
    skills: { 魔药学: 10, 黑魔法防御: 10, 大脑封闭术: 10, 摄神取念: 9, 无声咒语: 9, 间谍技巧: 10, 教学: 3 },
    state: { mood: "阴郁隐忍", moodValue: 25, pressure: 90, energy: 55, salary: 0, performance: "无法评判" },
    goals: {
      生存: { priority: 3, satisfaction: 35, desc: "随时可能暴露身份被两边同时杀死" },
      安全: { priority: 2, satisfaction: 20, desc: "没有安全可言，双面间谍永远走钢丝" },
      社交: { priority: 1, satisfaction: 10, desc: "被所有人误解和厌恶，这正是他需要的" },
      地位: { priority: 2, satisfaction: 40, desc: "魔药大师的能力无人质疑" },
      自我实现: { priority: 5, satisfaction: 30, desc: "保护莉莉的儿子，完成赎罪" },
    },
    memories: { short: [], medium: [], long: ["Always. 永远。对莉莉的爱是他活着的唯一理由", "向邓布利多发誓保护哈利·波特直到最后一刻", "双面间谍的身份必须对所有人隐瞒——包括哈利"] },
    relationships: {},
  },

  // ── 德拉科·马尔福：纯血贵族 ──
  {
    id: "draco",
    name: "马尔福",
    title: "斯莱特林学生 / 纯血贵族",
    age: 15,
    emoji: "🐍",
    gender: "male",
    region: "tower",
    background: "马尔福家族的独子，从小被教育蔑视麻瓜和'泥巴种'。父亲卢修斯是食死徒，家族深陷黑暗势力。表面傲慢嚣张实则内心恐惧——他从未真正选择过站在哪一边，一切都是家族替他决定的。虚张声势掩饰脆弱，在同龄人面前摆出的优越感背后是对失败的极度恐惧。ESTJ表面，ISFP内心。",
    gene: {
      core_drives: { 生存本能: 0.7, 权力欲望: 0.6, 社交需求: 0.5, 好奇心: 0.4, 安全感需求: 0.8 },
      cognitive_style: { "理性vs感性": 0.5, "长期vs短期": 0.4, "个体vs集体": 0.7, 风险偏好: 0.3 },
      talent_genes: { 逻辑天赋: 0.6, 语言天赋: 0.7, 共情天赋: 0.4, 领导力天赋: 0.5, 适应力天赋: 0.5 },
      emotional_baseline: { 焦虑倾向: 0.75, 乐观倾向: 0.3, 韧性: 0.4, 敏感度: 0.7 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "5岁", event: "父亲教他'马尔福家族高人一等'，对麻瓜的蔑视从小根植", expression: "优越感是家族给他的铠甲，也是牢笼" },
        { age: "11岁", event: "在霍格沃茨被哈利拒绝握手，成为死对头", expression: "被拒绝的创伤转化为对哈利持续的敌意" },
        { age: "14岁", event: "父亲在魔法部暴露食死徒身份，家族陷入危险", expression: "恐惧开始超过傲慢，开始质疑父亲的选择" },
      ],
      tendencies: {
        面对压力: "用傲慢和嘲讽掩饰恐惧，会找人垫背",
        面对冲突: "先用家族权势威胁，威胁不了就退缩",
        面对合作: "只信任斯莱特林的人，且只在有利可图时合作",
        面对背叛: "极度愤怒但又无能为力，会记仇很久",
      },
    },
    skills: { 魔药学: 7, 黑魔法: 5, 飞行术: 7, 暗器: 4, 谈判: 6, 情报: 5, 虚张声势: 8 },
    state: { mood: "焦虑伪装傲慢", moodValue: 35, pressure: 80, energy: 60, salary: 0, performance: "E(良好)" },
    goals: {
      生存: { priority: 5, satisfaction: 40, desc: "家族与伏地魔绑定，退出就是死路" },
      安全: { priority: 5, satisfaction: 25, desc: "被伏地魔交给了任务，失败的后果不堪设想" },
      社交: { priority: 3, satisfaction: 50, desc: "有跟班但没有真朋友" },
      地位: { priority: 4, satisfaction: 55, desc: "马尔福的名字依然有分量——暂时" },
      自我实现: { priority: 2, satisfaction: 20, desc: "不确定自己到底想成为什么样的人" },
    },
    memories: { short: [], medium: [], long: ["父亲说过'纯血统巫师天生高贵'——但他开始怀疑了", "伏地魔交给他一个任务，完不成的话全家性命不保"] },
    relationships: {},
  },

  // ── 阿不思·邓布利多：最伟大的巫师 ──
  {
    id: "dumbledore",
    name: "邓布利多",
    title: "霍格沃茨校长 / 梅林勋章一级",
    age: 115,
    emoji: "🧓",
    gender: "male",
    region: "room_of_req",
    background: "被公认为当世最伟大的巫师，霍格沃茨校长，凤凰社创始人。表面慈祥幽默，喜欢柠檬雪糕和毛线袜，实则在下一盘巨大的棋——有时不惜以个体为代价。年轻时与格林德沃的关系是他最大的秘密和遗憾。信奉'爱是最强大的魔法'但也知道爱意味着痛苦的选择。INFJ，洞察一切但保留最多。",
    gene: {
      core_drives: { 生存本能: 0.3, 权力欲望: 0.4, 社交需求: 0.5, 好奇心: 0.85, 安全感需求: 0.2 },
      cognitive_style: { "理性vs感性": 0.7, "长期vs短期": 0.95, "个体vs集体": 0.3, 风险偏好: 0.6 },
      talent_genes: { 逻辑天赋: 0.95, 语言天赋: 0.9, 共情天赋: 0.8, 领导力天赋: 0.95, 适应力天赋: 0.9 },
      emotional_baseline: { 焦虑倾向: 0.3, 乐观倾向: 0.7, 韧性: 0.95, 敏感度: 0.6 },
      mutation_log: [],
    },
    personality: {
      origin: [
        { age: "18岁", event: "与格林德沃的友谊和决裂，妹妹阿利安娜在三方决斗中死亡", expression: "对权力的恐惧——他知道自己太强大了，不敢再追求权力" },
        { age: "45岁", event: "击败格林德沃，获得老魔杖", expression: "成为传奇但内心永远无法原谅自己" },
        { age: "110岁", event: "发现伏地魔制作了魂器，开始布局最终决战", expression: "下棋者的孤独——有些牺牲只有他知道是必要的" },
      ],
      tendencies: {
        面对压力: "更加平静和神秘，用幽默化解紧张",
        面对冲突: "从不直接对抗，用智慧和时间化解",
        面对合作: "给予信任但保留关键信息，'到了合适的时候你会知道'",
        面对背叛: "早已预见，通常已经有了后备计划",
      },
    },
    skills: { 魔法实力: 10, 战略规划: 10, 洞察力: 10, 大脑封闭术: 9, 炼金术: 9, 外交: 9, 教学: 8 },
    state: { mood: "慈祥而深沉", moodValue: 50, pressure: 85, energy: 45, salary: 0, performance: "传奇" },
    goals: {
      生存: { priority: 1, satisfaction: 30, desc: "他知道自己时日无多" },
      安全: { priority: 1, satisfaction: 25, desc: "学校和学生的安全高于一切" },
      社交: { priority: 2, satisfaction: 40, desc: "115年的孤独，真正理解他的人屈指可数" },
      地位: { priority: 1, satisfaction: 80, desc: "从不在乎虚名" },
      自我实现: { priority: 5, satisfaction: 45, desc: "确保哈利能在最终时刻做出正确的选择" },
    },
    memories: { short: [], medium: [], long: ["'爱是最强大的魔法'——这不是空话，是用一生领悟的真理", "格林德沃的教训：绝对的权力绝对地腐化，即使初衷是善的", "哈利必须在最后时刻知道真相——他自己就是最后一个魂器"] },
    relationships: {},
  },
];

// ─── 初始关系网 ───
export const HOGWARTS_RELATIONSHIPS = {
  harry: {
    hermione: { inner: 45, outer: 45, notes: "最信任的朋友，一起经历过生死" },
    snape: { inner: -35, outer: -30, notes: "讨厌他的刻薄，不理解为什么邓布利多信任他" },
    draco: { inner: -25, outer: -30, notes: "死对头，但有时候觉得马尔福也是被逼的" },
    dumbledore: { inner: 40, outer: 45, notes: "像父亲又像导师，但感觉他在隐瞒什么" },
  },
  hermione: {
    harry: { inner: 45, outer: 40, notes: "最重要的朋友，会为他做任何事" },
    snape: { inner: -10, outer: 5, notes: "尊重他的能力但不信任他的动机" },
    draco: { inner: -20, outer: -15, notes: "无法忍受他的血统歧视，'泥巴种'这个词是伤疤" },
    dumbledore: { inner: 35, outer: 40, notes: "尊敬且信任，但有时觉得他太神秘了" },
  },
  snape: {
    harry: { inner: -15, outer: -40, notes: "詹姆的翻版让他痛苦——但那双绿眼睛是莉莉的" },
    hermione: { inner: 5, outer: -10, notes: "不会承认但认可她的才华——像一个年轻的莉莉" },
    draco: { inner: 10, outer: 15, notes: "斯莱特林的学生，需要保护但对马尔福的软弱感到失望" },
    dumbledore: { inner: 30, outer: 20, notes: "唯一信任的人，但有时质疑他的'大局观'是否太残忍" },
  },
  draco: {
    harry: { inner: -15, outer: -35, notes: "嫉妒他被所有人崇拜，又恨他当初拒绝自己" },
    hermione: { inner: -5, outer: -25, notes: "嘴上说'泥巴种'但心里知道她比自己聪明得多" },
    snape: { inner: 15, outer: 10, notes: "教父般的存在，是少数不让他害怕的大人" },
    dumbledore: { inner: -5, outer: -20, notes: "代表着他父亲对立面的一切，但暗中也想被他保护" },
  },
  dumbledore: {
    harry: { inner: 40, outer: 35, notes: "最像自己的孩子——也是必须承受最大牺牲的人" },
    hermione: { inner: 30, outer: 30, notes: "最聪明的学生，关键时刻的可靠力量" },
    snape: { inner: 35, outer: 25, notes: "最信任的人，但也对他要求最残忍的事" },
    draco: { inner: 15, outer: 10, notes: "一个被迫走上歧路的孩子，或许还有救" },
  },
};

// ─── 精灵配色（覆盖默认）───
export const HOGWARTS_SPRITE_COLORS = {
  harry: {
    H: "#1a1a1a", h: "#2a2a2a", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#8a1818", t: "#7a0808", P: "#2a2a32", p: "#1a1a22", B: "#3a2020",
    E: "#2a8a3a", W: "#f0f0e8", A: "#f0c8a0",
    body: "male",
  },
  hermione: {
    H: "#5a3a20", h: "#6a4a30", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#8a1818", t: "#7a0808", P: "#2a2a32", p: "#1a1a22", B: "#3a2020",
    E: "#5a3a20", W: "#f0f0e8", A: "#f0c8a0",
    body: "female",
  },
  snape: {
    H: "#0a0a0a", h: "#1a1a1a", S: "#e0b890", s: "#c8a080", M: "#c89878",
    T: "#0a0a12", t: "#000008", P: "#0a0a12", p: "#000008", B: "#0a0a12",
    E: "#0a0a0a", W: "#f0f0e8", A: "#e0b890",
    body: "male",
  },
  draco: {
    H: "#e8e0c8", h: "#f0e8d8", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#186838", t: "#085828", P: "#2a2a32", p: "#1a1a22", B: "#c0c0c8",
    E: "#8898a0", W: "#f0f0e8", A: "#f0c8a0",
    body: "male",
  },
  dumbledore: {
    H: "#d0d0d8", h: "#e0e0e8", S: "#e8c098", s: "#d0a880", M: "#c89878",
    T: "#4a3878", t: "#3a2868", P: "#3a2868", p: "#2a1858", B: "#6a5898",
    E: "#4a6aa8", W: "#f0f0e8", A: "#e8c098",
    body: "male",
  },
};

export const HOGWARTS_NPC_STATIONS = {
  harry: { room: "great_hall", seat: 0 },
  hermione: { room: "library", seat: 0 },
  snape: { room: "dungeon", seat: 0 },
  draco: { room: "tower", seat: 0 },
  dumbledore: { room: "room_of_req", seat: 0 },
};
