export const TEMPLATES = [
  {
    id: "office",
    name: "职场暗战",
    emoji: "🏢",
    tagline: "互联网公司的权力游戏",
    description:
      "一家刚完成B轮融资的互联网公司，资源有限但野心勃勃。五个人，各怀心思，在有限的晋升名额面前暗流涌动。",
    goal: "信息就是权力。掌握并传递关键信息者上升，被蒙在鼓里者淘汰。观察谁能在信息不对称中胜出。",
    regions: [
      { id: "r1", name: "开放办公区", emoji: "🖥️" },
      { id: "r2", name: "会议室", emoji: "📊" },
      { id: "r3", name: "总监办公室", emoji: "🚪" },
      { id: "r4", name: "茶水间", emoji: "☕" },
      { id: "r5", name: "前台大厅", emoji: "🌿" },
      { id: "r6", name: "服务器机房", emoji: "🔧" },
    ],
    npcs: [
      {
        id: "n1", name: "林总监", emoji: "👔", region: "r3", mood: "沉稳", moodValue: 6,
        personality: "老练的管理者，表面温和实则精于算计。善于用模糊的承诺控制下属。信奉'让他们互相竞争，我坐收渔利'。说话总是留三分余地。",
      },
      {
        id: "n2", name: "张姐", emoji: "👩‍💼", region: "r1", mood: "焦虑", moodValue: 4,
        personality: "工作十年的老员工，能力强但缺乏安全感。总觉得年轻人要取代自己。喜欢通过掌握八卦来维持存在感。对上谄媚，对下防备。",
      },
      {
        id: "n3", name: "陈工", emoji: "🧑‍💻", region: "r6", mood: "专注", moodValue: 7,
        personality: "技术宅，代码写得好但不善社交。相信'用实力说话'但不知道职场不是这么运作的。容易被人利用而不自知。内心其实渴望被认可。",
      },
      {
        id: "n4", name: "小王", emoji: "👶", region: "r1", mood: "兴奋", moodValue: 8,
        personality: "刚入职的应届生，充满干劲但天真。把公司当学校，把同事当同学。还不懂办公室政治是什么。很容易被PUA但恢复力也很强。",
      },
      {
        id: "n5", name: "李秘书", emoji: "📋", region: "r5", mood: "平静", moodValue: 5,
        personality: "总监的秘书，消息最灵通的人。看似不起眼但掌握所有人的行程和秘密。不主动参与争斗但会在关键时刻'不经意'透露信息。城府极深。",
      },
    ],
    interventions: [
      { id: "i1", emoji: "⚡", name: "突发裁员", description: "公司突然宣布要裁掉一个人。每个人都在猜谁会被裁。" },
      { id: "i2", emoji: "🎯", name: "神秘新项目", description: "一个直接向CEO汇报的秘密项目启动，只需要两个人。谁能入选？" },
      { id: "i3", emoji: "💣", name: "匿名举报", description: "有人匿名举报了公司内部的一个问题。每个人都在猜是谁举报的。" },
      { id: "i4", emoji: "💰", name: "年终奖揭晓", description: "年终奖金额泄露，差距悬殊。有人拿到了别人三倍的奖金。" },
    ],
  },
  {
    id: "island",
    name: "荒岛求生",
    emoji: "🏝️",
    tagline: "文明崩塌后的人性试炼",
    description:
      "一艘豪华游轮沉没，五个素不相识的人被冲到了同一个荒岛上。食物只够三个人吃一周。没有救援信号。",
    goal: "生存压力下观察合作与背叛的涌现。资源稀缺时，谁会分享，谁会独占，谁会结盟，谁会被抛弃。",
    regions: [
      { id: "r1", name: "海滩营地", emoji: "⛺" },
      { id: "r2", name: "丛林深处", emoji: "🌴" },
      { id: "r3", name: "悬崖瞭望", emoji: "🏔️" },
      { id: "r4", name: "淡水溪流", emoji: "💧" },
      { id: "r5", name: "暗礁海岸", emoji: "🪸" },
      { id: "r6", name: "山洞", emoji: "🕳️" },
    ],
    npcs: [
      {
        id: "n1", name: "老船长", emoji: "⚓", region: "r1", mood: "自责", moodValue: 3,
        personality: "退伍军人出身的老船长，对沉船事故深感自责。有野外求生经验，自然而然想当领导者。但自责让他犹豫不决，有时做不出果断决定。",
      },
      {
        id: "n2", name: "林医生", emoji: "🩺", region: "r1", mood: "冷静", moodValue: 5,
        personality: "急诊科医生，见惯生死所以异常冷静。用理性分析一切，包括人际关系。会在内心默默评估每个人的'生存价值'。说话直接，有时显得冷血。",
      },
      {
        id: "n3", name: "肥厨", emoji: "🍳", region: "r4", mood: "恐惧", moodValue: 2,
        personality: "游轮上的厨师，唯一懂烹饪和辨别食物的人。体力差但有不可替代的技能。恐惧让他想囤积食物，但又知道这样会被孤立。内心矛盾。",
      },
      {
        id: "n4", name: "小雨", emoji: "🎒", region: "r3", mood: "震惊", moodValue: 3,
        personality: "大学生背包客，年轻有体力但缺乏社会经验。遇到极端情况容易崩溃但也容易被激励。会本能地寻找'可以依靠的大人'。适应力强。",
      },
      {
        id: "n5", name: "赵总", emoji: "💼", region: "r5", mood: "愤怒", moodValue: 4,
        personality: "做生意的中年人，习惯用钱和权解决一切。在荒岛上这些都没用了，这让他暴躁。但他的谈判能力和察言观色是隐藏优势。不甘心当普通人。",
      },
    ],
    interventions: [
      { id: "i1", emoji: "🌊", name: "暴风雨来袭", description: "一场猛烈的暴风雨即将到来。营地可能被摧毁，必须决定是否转移。" },
      { id: "i2", emoji: "🚢", name: "远处的船影", description: "有人在悬崖上看到了远处似乎有一艘船。但只有一次发信号的机会。" },
      { id: "i3", emoji: "🍖", name: "食物发现", description: "在丛林深处发现了一棵结满果实的树，但路途危险，需要有人冒险去采。" },
      { id: "i4", emoji: "🤒", name: "有人病倒", description: "一个人突然发高烧。要不要把珍贵的淡水和食物分给一个可能拖累大家的病人？" },
    ],
  },
  {
    id: "palace",
    name: "宫斗风云",
    emoji: "👑",
    tagline: "深宫之中无真情",
    description:
      "架空王朝的后宫。皇帝体弱多病，朝不保夕。没有子嗣继承大统。后宫各方势力蠢蠢欲动，一场无声的战争即将开始。",
    goal: "控制信息流向的人控制一切。观察谁能通过结盟、离间、情报战在后宫中胜出。真相往往不重要，重要的是谁相信了什么。",
    regions: [
      { id: "r1", name: "凤仪宫", emoji: "🏯" },
      { id: "r2", name: "御花园", emoji: "🌸" },
      { id: "r3", name: "太医院", emoji: "🏥" },
      { id: "r4", name: "御膳房", emoji: "🍵" },
      { id: "r5", name: "密道", emoji: "🕯️" },
      { id: "r6", name: "佛堂", emoji: "🪷" },
    ],
    npcs: [
      {
        id: "n1", name: "皇后", emoji: "👸", region: "r1", mood: "忧虑", moodValue: 4,
        personality: "出身名门的正宫皇后，端庄持重但内心焦虑。最大的危机是无子。表面维持着后宫秩序，实际上已经开始物色可以过继的皇子。城府深但心不够狠。",
      },
      {
        id: "n2", name: "贵妃", emoji: "💃", region: "r2", mood: "得意", moodValue: 7,
        personality: "最受宠的妃子，美貌聪慧且野心勃勃。深知自己的美貌是武器但也是定时炸弹。善于在皇帝面前表演柔弱，背后手段凌厉。目标明确：取皇后而代之。",
      },
      {
        id: "n3", name: "才人", emoji: "📖", region: "r6", mood: "隐忍", moodValue: 5,
        personality: "低位份的才人，看似与世无争实则暗中观察一切。出身寒门靠才学入宫。不争不抢的外表下是惊人的记忆力和分析能力。在等一个时机。",
      },
      {
        id: "n4", name: "王总管", emoji: "🧓", region: "r4", mood: "谨慎", moodValue: 5,
        personality: "服侍了三代帝王的老太监，宫里没有他不知道的秘密。谁当权他就帮谁，但内心有自己的底线。年纪大了开始考虑退路。消息网络遍布宫廷。",
      },
      {
        id: "n5", name: "侍卫长", emoji: "⚔️", region: "r5", mood: "矛盾", moodValue: 4,
        personality: "年轻的侍卫长，武艺高强且忠心耿耿——至少曾经是。他与某位妃子之间有一段不可说的过往。这是他最大的弱点，也可能成为别人的把柄。",
      },
    ],
    interventions: [
      { id: "i1", emoji: "🤴", name: "皇帝病危", description: "皇帝突然吐血昏迷。太医说时日无多。后宫和朝堂同时陷入恐慌。" },
      { id: "i2", emoji: "📜", name: "密旨出现", description: "有人发现了一份据说是皇帝亲笔的密旨，内容涉及继承。但真假难辨。" },
      { id: "i3", emoji: "☠️", name: "下毒疑云", description: "御膳房的食物中被检出了毒药。是谁下的？目标是谁？人人自危。" },
      { id: "i4", emoji: "👶", name: "有人怀孕", description: "后宫传出有人怀孕的消息。如果是真的，这将彻底改变权力格局。但消息是否属实？" },
    ],
  },
  {
    id: "tribe",
    name: "原始部落",
    emoji: "🌿",
    tagline: "文明的第一缕曙光",
    description:
      "远古时代，一个小部落栖息在大河边。他们刚刚学会用火，语言还很原始。世界对他们来说充满了无法解释的神秘力量。",
    goal: "观察自然、总结规律、传递知识、推动进化。看他们如何从蒙昧走向文明——或者走向另一个方向。",
    regions: [
      { id: "r1", name: "篝火营地", emoji: "🔥" },
      { id: "r2", name: "河边浅滩", emoji: "🌊" },
      { id: "r3", name: "密林", emoji: "🌳" },
      { id: "r4", name: "山顶岩洞", emoji: "⛰️" },
      { id: "r5", name: "草原", emoji: "🌾" },
      { id: "r6", name: "沼泽", emoji: "🐊" },
    ],
    npcs: [
      {
        id: "n1", name: "族长·岩", emoji: "🦴", region: "r1", mood: "沉思", moodValue: 5,
        personality: "部落里最年长的人，靠经验和直觉做决定。对火有近乎宗教般的崇拜。不理解的东西就归因于'天神'。固执但关心族人。开始感到衰老的恐惧。",
      },
      {
        id: "n2", name: "猎人·风", emoji: "🏹", region: "r3", mood: "警觉", moodValue: 6,
        personality: "部落最强壮的猎人，沉默寡言但行动果断。通过观察动物行为来预判天气。内心有一种模糊的'科学思维'萌芽但还无法表达。对危险极度敏感。",
      },
      {
        id: "n3", name: "采集者·月", emoji: "🌙", region: "r2", mood: "好奇", moodValue: 7,
        personality: "负责采集的年轻女性，对世界充满好奇。发现了某些植物能治病但不知道原理。开始尝试'种植'而不只是采集。可能是部落第一个农民。",
      },
      {
        id: "n4", name: "巫师·星", emoji: "✨", region: "r4", mood: "神秘", moodValue: 6,
        personality: "自称能与天神对话的巫师。其实是部落里最聪明的人，用'神谕'来包装自己的观察和推理。权力欲强但也真心想保护部落。知识是他的权力来源。",
      },
      {
        id: "n5", name: "孩童·溪", emoji: "👦", region: "r1", mood: "天真", moodValue: 9,
        personality: "部落里最小的孩子，没有任何成见和恐惧。会问出大人们从未想过的问题。代表着纯粹的好奇心和学习能力。可能会发现改变部落命运的东西。",
      },
    ],
    interventions: [
      { id: "i1", emoji: "🌋", name: "远方火山", description: "远处的山冒出了火和烟。大地在颤抖。这是天神的愤怒还是可以理解的自然现象？" },
      { id: "i2", emoji: "🐺", name: "狼群来袭", description: "一群饥饿的狼开始在营地周围徘徊。是战斗、驱赶，还是有人会想到驯化它们？" },
      { id: "i3", emoji: "👥", name: "陌生部落", description: "河对岸出现了另一群人。他们的穿着和语言都不同。是敌人还是可以交流的同类？" },
      { id: "i4", emoji: "⭐", name: "天降异象", description: "夜空中一颗巨大的流星划过，伴随着雷鸣般的声响。在草原上留下了一个发光的坑。" },
    ],
  },
];
