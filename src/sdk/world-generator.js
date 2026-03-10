/**
 * 世界生成器 — 用 AI 从用户的几句话生成完整的世界配置
 */

import { validateWorld, normalizeWorld } from "./world-schema.js";

// 示例世界（办公室）作为 few-shot，截取关键结构
const FEW_SHOT_EXAMPLE = `
{
  "config": {
    "name": "即梦办公室",
    "description": "字节跳动即梦(Dreamina)团队的日常，一群理想主义者在探索AI创作的未来",
    "locations": [
      { "id": "desk", "name": "工位区", "emoji": "🖥️", "color": "#b8a878", "desc": "产品经理们的工位" },
      { "id": "meeting", "name": "会议室", "emoji": "📊", "color": "#a8b8a0", "desc": "头脑风暴的地方" },
      { "id": "pantry", "name": "茶水间", "emoji": "☕", "color": "#c0a880", "desc": "灵感和八卦的集散地" },
      { "id": "boss", "name": "Kelly办公室", "emoji": "🚪", "color": "#90b0a0", "desc": "老板的办公室" },
      { "id": "canteen", "name": "食堂", "emoji": "🍜", "color": "#c8b888", "desc": "午餐时间放松" },
      { "id": "home", "name": "家", "emoji": "🏠", "color": "#a0a8b8", "desc": "卸下疲惫的地方" }
    ],
    "resources": {
      "hc": { "name": "HC（人员编制）", "total": 7, "current": 7, "desc": "团队核心成员" },
      "agent_progress": { "name": "创作Agent进度", "total": 100, "current": 35, "desc": "距离发布还有很长的路" },
      "competition": { "name": "竞争压力", "total": 100, "current": 70, "desc": "外部创业团队步步紧逼" }
    },
    "rules": [
      "团队使命：做出世界级的AI创作平台",
      "每季度末进行绩效评估，强制分布",
      "外部竞争激烈，需要快速迭代"
    ],
    "interventions": [
      { "id": "competitor", "emoji": "⚡", "name": "竞品发布", "description": "竞争对手发布了爆款工具，压力骤增。" },
      { "id": "perf_review", "emoji": "📋", "name": "绩效季来了", "description": "季度绩效评估开始。" },
      { "id": "demo_day", "emoji": "🎪", "name": "Demo Day", "description": "高层要来看Demo，只有一周准备。" },
      { "id": "viral_moment", "emoji": "🔥", "name": "出圈了", "description": "一个功能突然爆火，用户涌入。" }
    ]
  },
  "npcs": [
    {
      "id": "kelly",
      "name": "Kelly",
      "title": "业务负责人",
      "age": 38,
      "emoji": "👩‍💼",
      "gender": "female",
      "region": "boss",
      "background": "大女主人设，理想主义者。梦想是做出想象力世界平台。INFP，用直觉和价值观驱动决策。",
      "gene": {
        "core_drives": { "生存本能": 0.4, "权力欲望": 0.7, "社交需求": 0.6, "好奇心": 0.9, "安全感需求": 0.3 },
        "cognitive_style": { "理性vs感性": 0.35, "长期vs短期": 0.9, "个体vs集体": 0.4, "风险偏好": 0.8 },
        "talent_genes": { "逻辑天赋": 0.6, "语言天赋": 0.8, "共情天赋": 0.85, "领导力天赋": 0.9, "适应力天赋": 0.7 },
        "emotional_baseline": { "焦虑倾向": 0.4, "乐观倾向": 0.8, "韧性": 0.85, "敏感度": 0.7 },
        "mutation_log": []
      },
      "personality": {
        "origin": [
          { "age": "22岁", "event": "迷上创作和设计", "expression": "好奇心和理想主义的根源" }
        ],
        "tendencies": {
          "面对压力": "用愿景激励自己和团队",
          "面对冲突": "倾听各方，但最终相信直觉",
          "面对合作": "给团队自由度和信任",
          "面对背叛": "感到失望但会直面"
        }
      },
      "skills": { "战略规划": 9, "团队管理": 8, "沟通": 8 },
      "state": { "mood": "期待", "moodValue": 75, "pressure": 65, "energy": 70, "salary": 80000, "performance": "S" },
      "goals": {
        "生存": { "priority": 1, "satisfaction": 90, "desc": "不太担心" },
        "安全": { "priority": 2, "satisfaction": 70, "desc": "业务成绩需要持续证明" },
        "社交": { "priority": 3, "satisfaction": 75, "desc": "和团队关系融洽" },
        "地位": { "priority": 4, "satisfaction": 60, "desc": "证明即梦的战略价值" },
        "自我实现": { "priority": 5, "satisfaction": 50, "desc": "做出想象力世界平台" }
      },
      "memories": { "short": [], "medium": [], "long": ["一直相信想象力是人类最宝贵的能力"] }
    }
  ],
  "relationships": {
    "kelly": {
      "pine": { "inner": 35, "outer": 40, "notes": "亲自挖来的人，寄予厚望" }
    }
  },
  "schedule": [
    { "hour": 7, "label": "起床通勤", "defaultLocation": "home" },
    { "hour": 9, "label": "晨会", "defaultLocation": "meeting" },
    { "hour": 12, "label": "午饭", "defaultLocation": "canteen" },
    { "hour": 18, "label": "纠结下班", "defaultLocation": "desk" },
    { "hour": 23, "label": "睡觉", "defaultLocation": "home" }
  ]
}`;

const GENERATOR_SYSTEM_PROMPT = `你是一个「世界构建师」。用户会给你几句话描述一个世界的想法，你需要生成一个完整的、可以被模拟引擎运行的世界配置。

## 核心设计哲学
1. **有限资源驱动冲突** — 每个世界必须有稀缺资源，这是所有戏剧冲突的根源
2. **基因决定灵魂底色** — 每个NPC的基因（core_drives, cognitive_style, talent_genes, emotional_baseline）决定了他们的行为倾向
3. **双层关系制造张力** — inner（内心真实想法）和 outer（外在表现）可以不一致，这就是"城府"
4. **记忆塑造经验** — 长期记忆是角色的人生信条，中期记忆是近期重要事件，短期记忆是刚发生的事
5. **马斯洛目标驱动行动** — 每个NPC有生存/安全/社交/地位/自我实现五层目标，优先级因人而异

## 输出要求
生成 5-7 个NPC，6个地点，3-5个有限资源，4-6个干预事件，5-6条世界规则，以及完整的日程表（17个时段，从7:00到23:00）。

## NPC 设计要求
- 每个NPC必须有独特的 id（英文小写，简短）、name、title、age、emoji、gender（male/female）、region（初始位置）
- background 要详细（50-100字），包含性格特征、人生经历、行为模式
- gene 的每个值在 0-1 之间，要有差异化——不要每个人都是 0.5
- personality.origin 至少2个人生关键事件
- personality.tendencies 必须包含：面对压力、面对冲突、面对合作、面对背叛
- skills 至少5个技能，值1-10
- state 包含 mood(string)、moodValue(0-100)、pressure(0-100)、energy(0-100)、salary(number)、performance(string)
- goals 必须包含生存/安全/社交/地位/自我实现，每个有 priority(1-5)、satisfaction(0-100)、desc
- memories 包含 short(空数组)、medium(空数组)、long(1-3条初始长期记忆)

## 关系网设计要求
- 每对NPC之间都要有关系定义
- inner 和 outer 范围 -100 到 100
- notes 简短描述关系本质
- 要有矛盾和张力——不要所有关系都是正面的

## 日程表要求
- 17个时段（hour 7-23），每个有 label（当前活动描述）和 defaultLocation（默认地点id）
- 要符合世界观设定——比如学校世界有上课时间，职场有工作时间

## 参考示例（精简版）
${FEW_SHOT_EXAMPLE}

## 输出格式
只输出纯JSON，不要markdown代码块，不要其他文字。JSON结构必须包含：config, npcs, relationships, schedule。`;

/**
 * 调用 AI 生成世界
 * @param {string} userPrompt - 用户的世界描述（几句话即可）
 * @param {object} apiConfig - { apiKey, baseUrl, model }
 * @returns {Promise<object>} - 符合 Schema 的世界数据
 */
export async function generateWorld(userPrompt, apiConfig) {
  const enhancedPrompt = `请根据以下描述生成一个完整的可模拟世界：

「${userPrompt}」

请生成完整的世界配置JSON，包含丰富的角色设定、关系网络和戏剧冲突。`;

  let res;
  try {
    res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: GENERATOR_SYSTEM_PROMPT,
        userPrompt: enhancedPrompt,
        apiKey: apiConfig.apiKey,
        baseUrl: apiConfig.baseUrl,
        model: apiConfig.model,
      }),
    });
  } catch (e) {
    throw new Error("无法连接到服务器，请确认 node server.js 已启动");
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API错误 (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data.text) throw new Error("AI 返回内容为空");

  // 解析 JSON
  let cleaned = data.text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let worldData;
  try {
    worldData = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("AI 返回的不是有效JSON: " + e.message);
  }

  // 校验
  const validation = validateWorld(worldData);
  if (!validation.valid) {
    console.warn("世界数据校验警告:", validation.errors);
    // 不阻断，尝试标准化补全
  }

  // 标准化
  return normalizeWorld(worldData);
}
