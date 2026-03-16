/**
 * 独立 NPC Agent — Dreamina V2
 *
 * 核心升级: 每个NPC是独立的AI Agent
 *   - 独立的 LLM 调用（自己的"大脑"）
 *   - 独立的记忆系统（只记得自己经历的）
 *   - 独立的视角（只看到自己能看到的）
 *   - 独立的判断（可能是错的，可能被骗）
 *
 * NPC的system prompt只包含自己知道的信息，不包含其他NPC的内心想法。
 * 感知是有限的：只能看到同地点的人在做什么，听到别人对自己说的话。
 */

import { CognitiveMemory } from "../memory/CognitiveMemory.js";

// ─── 工具函数 ───

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 安全解析 LLM 返回的 JSON
 */
function safeParse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  if (!cleaned.startsWith("{")) {
    const start = cleaned.indexOf("{");
    if (start >= 0) cleaned = cleaned.slice(start);
  }
  if (!cleaned.endsWith("}")) {
    const end = cleaned.lastIndexOf("}");
    if (end >= 0) cleaned = cleaned.slice(0, end + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // 尝试修复常见问题
    let fixed = cleaned
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/(?<=[{,]\s*)(\w+)\s*:/g, '"$1":')
      .replace(/:\s*'([^']*)'/g, ': "$1"');
    // 修复未加引号的裸值（如中文文本）
    fixed = fixed.replace(/:\s*(?!true|false|null|"|\d|[-\d]|\[|\{)([^\n,}\]]+?)(\s*[,}\]])/g,
      (_, val, tail) => ': "' + val.trim().replace(/"/g, '\\"') + '"' + tail);
    return JSON.parse(fixed);
  }
}

// ─── 主类 ───

export class NPCAgent {
  /**
   * @param {object} npcData — 来自 world.js 的 NPC 完整数据
   * @param {CognitiveMemory} memory — 认知记忆实例
   * @param {object} llmClient — { call(systemPrompt, userPrompt): Promise<string> }
   */
  constructor(npcData, memory, llmClient) {
    /** NPC 的完整数据（基因、性格、技能等） */
    this.data = npcData;

    /** 认知记忆系统 */
    this.memory = memory;

    /** LLM 调用客户端 */
    this.llmClient = llmClient;

    /** 当前行动描述 */
    this.currentAction = null;

    /** 当前内心独白 */
    this.currentThought = null;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  核心思考循环
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 每个 tick 的核心循环: 感知 → 回忆 → 思考 → 行动 → 记忆写入
   *
   * @param {object} perception — 引擎推送的感知信息
   *   - currentTime {{ day: number, hour: number }}
   *   - location {string} 当前所在地点id
   *   - locationName {string} 地点名称
   *   - presentNpcs {Array<{ id, name, title, action, mood }>} 同地点的NPC（只有外在表现）
   *   - recentSpeechToMe {Array<{ from, fromName, content }>} 别人对我说的话
   *   - worldEvent {string|null} 当前世界事件
   *   - worldRules {string[]} 世界规则
   *   - availableLocations {Array<{ id, name }>} 可去的地点
   *
   * @returns {Promise<object>} NPC 的行动决策
   */
  async think(perception) {
    // 1. 感知: 构建当前感知的上下文文本
    const perceptionText = this._buildPerceptionText(perception);

    // 2. 回忆: 检索与当前情境相关的记忆
    const relevantMemories = this.memory.retrieveRelevant(perceptionText, 5);

    // 3. 遗忘: 执行时间衰减
    this.memory.decay(Date.now());

    // 4. 思考: 调用 LLM 做决策
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildPerceptionPrompt(perception, relevantMemories);

    let decision;
    try {
      const raw = await this.llmClient.call(systemPrompt, userPrompt);
      decision = safeParse(raw);
    } catch (e) {
      // LLM 调用失败时返回默认行为
      decision = this._fallbackDecision(perception);
    }

    // 5. 记忆写入: 将本次经历写入记忆
    const eventContent = this._summarizeExperience(perception, decision);
    await this.memory.writeMemory(
      {
        content: eventContent,
        location: perception.location,
        emotionalIntensity: decision.moodValue ?? this.data.state.moodValue,
        source: "witnessed",
      },
      this.data.state,
      this.llmClient
    );

    // 6. 更新自身状态
    this.currentAction = decision.action ?? null;
    this.currentThought = decision.thought ?? null;
    this._lastAction = this.currentAction;
    this._lastThought = this.currentThought;
    this._lastDecisionChain = decision.decisionChain ?? "";
    this._applyDecisionToState(decision);

    // 7. 返回标准格式的行动结果
    return {
      id: this.data.id,
      action: decision.action ?? "继续当前活动",
      movement: decision.movement ?? null,
      speech: decision.speech ?? null,
      thought: decision.thought ?? "...",
      mood: decision.mood ?? this.data.state.mood,
      moodValue: clamp(decision.moodValue ?? this.data.state.moodValue, 0, 100),
      pressure: clamp(decision.pressure ?? this.data.state.pressure, 0, 100),
      energy: clamp(decision.energy ?? this.data.state.energy, 0, 100),
      decisionChain: decision.decisionChain ?? "",
      goalChanges: decision.goalChanges ?? {},
      relationshipChanges: decision.relationshipChanges ?? [],
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  System Prompt 构建
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 构建独立的 system prompt
   *
   * 关键: 只包含这个NPC自己知道的信息，不包含:
   *   - 其他NPC的内心想法
   *   - 其他NPC的真实态度（只有外在表现）
   *   - 不在视野内的事件
   */
  buildSystemPrompt() {
    const npc = this.data;
    const gene = npc.gene;

    // ── 基因摘要 ──
    const topDrives = Object.entries(gene.core_drives)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}(${v})`)
      .join("、");

    const cogStyle = gene.cognitive_style;
    const cogDesc = `理性${cogStyle["理性vs感性"] > 0.5 ? "偏强" : "偏弱"} | 风险偏好${cogStyle.风险偏好 > 0.5 ? "高" : "低"} | ${cogStyle["长期vs短期"] > 0.5 ? "重视长期" : "关注短期"} | ${cogStyle["个体vs集体"] > 0.5 ? "个体主义" : "集体主义"}`;

    const topTalents = Object.entries(gene.talent_genes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}(${v})`)
      .join("、");

    const emoBase = gene.emotional_baseline;

    // ── 性格与行为倾向 ──
    const tendencies = Object.entries(npc.personality.tendencies)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    // ── 技能 ──
    const skills = Object.entries(npc.skills)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");

    // ── 关系（只用NPC自己的视角：inner是真实感受，outer是表现） ──
    let relationshipsText = "";
    if (npc.relationships && Object.keys(npc.relationships).length > 0) {
      const relLines = [];
      for (const [targetId, rel] of Object.entries(npc.relationships)) {
        relLines.push(`  对${targetId}: 内心${rel.inner > 0 ? "+" : ""}${rel.inner}, 表面${rel.outer > 0 ? "+" : ""}${rel.outer} — ${rel.notes}`);
      }
      relationshipsText = relLines.join("\n");
    } else {
      relationshipsText = "  还没有形成深入的人际关系";
    }

    // ── 目标 ──
    const goalLines = Object.entries(npc.goals)
      .sort((a, b) => b[1].priority - a[1].priority)
      .map(([name, g]) => `  ${g.priority >= 4 ? "[重要]" : ""} ${name}(优先级${g.priority}): 满足度${g.satisfaction}% — ${g.desc}`)
      .join("\n");

    // ── 记忆摘要（来自认知记忆系统） ──
    const memAll = this.memory.getAllMemories();
    const recentEpisodic = memAll.episodic
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8)
      .map(m => `  [${m.source}] ${m.content} (重要性:${m.importance})`)
      .join("\n");

    const beliefs = memAll.semantic
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map(m => `  "${m.belief}" (信心:${Math.round(m.confidence * 100)}%)`)
      .join("\n");

    // ── 构建 system prompt ──
    return `你是${npc.name}（${npc.title}，${npc.age}岁），在一个AI驱动的世界模拟中独立思考和行动。

## 你的身份
${npc.background}

## 你的灵魂基因
核心驱力: ${topDrives}
认知风格: ${cogDesc}
天赋上限: ${topTalents}
情绪基线: 焦虑倾向${emoBase.焦虑倾向} | 乐观倾向${emoBase.乐观倾向} | 韧性${emoBase.韧性} | 敏感度${emoBase.敏感度}

## 你的行为倾向
${tendencies}

## 你的技能
${skills}

## 你的当前状态
情绪: ${npc.state.mood}(${npc.state.moodValue}/100) | 压力: ${npc.state.pressure}/100 | 精力: ${npc.state.energy}/100
绩效: ${npc.state.performance || "待定"} | 薪资: ${npc.state.salary}

## 你的目标
${goalLines}

## 你对同事的看法（你的真实感受和外在表现可以不一致）
${relationshipsText}

## 你的记忆
近期经历:
${recentEpisodic || "  暂无"}

你相信的事:
${beliefs || "  暂无"}

## 思考规则
1. 你只知道自己经历过的事、亲眼看到的事、别人告诉你的事
2. 你不知道其他人的内心想法——只能从外在行为推测
3. 你的决策受基因影响: ${cogStyle["理性vs感性"] > 0.5 ? "你倾向用数据和逻辑分析" : "你倾向用直觉和情绪判断"}
4. 你的记忆可能不完美: ${emoBase.敏感度 > 0.6 ? "情绪强烈的事你记得很清楚，但细节可能有偏差" : "你的回忆偏向客观事实"}
5. 压力>80时你的判断可能偏激，精力<30时效率很低
6. 说话风格要符合你的性格和背景——你是真实的人，不是AI

只输出纯JSON，不要任何其他文字或markdown标记。`;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  感知 Prompt 构建
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 构建当前感知的 user prompt
   *
   * @param {object} perception — 引擎推送的感知信息
   * @param {Array<object>} relevantMemories — 检索到的相关记忆
   * @returns {string}
   */
  buildPerceptionPrompt(perception, relevantMemories = []) {
    const parts = [];

    // ── 时间 ──
    parts.push(`【当前时间】第${perception.currentTime.day}天 ${String(perception.currentTime.hour).padStart(2, "0")}:00`);

    // ── 你的位置和周围的人 ──
    parts.push(`【你在哪】${perception.locationName || perception.location}`);

    if (perception.presentNpcs && perception.presentNpcs.length > 0) {
      parts.push("【你看到的人】");
      for (const p of perception.presentNpcs) {
        // 注意: 只有外在行为，没有内心想法
        parts.push(`  ${p.name}(${p.title}): ${p.action || "在这里"} — 看起来${p.mood || "正常"}`);
      }
    } else {
      parts.push("【你看到的人】周围没有其他人");
    }

    // ── 别人对你说的话 ──
    if (perception.recentSpeechToMe && perception.recentSpeechToMe.length > 0) {
      parts.push("【别人对你说的话】");
      for (const speech of perception.recentSpeechToMe) {
        parts.push(`  ${speech.fromName || speech.from} 对你说: "${speech.content}"`);
      }
    }

    // ── 世界事件 ──
    if (perception.worldEvent) {
      parts.push(`【发生了重大事件】${perception.worldEvent}`);
    }

    // ── 相关记忆（被当前情境触发） ──
    if (relevantMemories.length > 0) {
      parts.push("【你想起了...】");
      for (const mem of relevantMemories) {
        if (mem._type === "episodic") {
          parts.push(`  记忆: ${mem.content} (${mem.source === "witnessed" ? "亲眼所见" : mem.source === "heard" ? "听说的" : "被告知的"})`);
        } else if (mem._type === "semantic") {
          parts.push(`  你相信: ${mem.belief} (信心${Math.round((mem.confidence ?? 0.5) * 100)}%)`);
        }
      }
    }

    // ── 可去的地方 ──
    if (perception.availableLocations && perception.availableLocations.length > 0) {
      const locList = perception.availableLocations.map(l => `${l.name}(${l.id})`).join("、");
      parts.push(`【你可以去】${locList}`);
    }

    // ── 世界规则提醒 ──
    if (perception.worldRules && perception.worldRules.length > 0) {
      parts.push("【世界规则】");
      for (const rule of perception.worldRules) {
        parts.push(`  - ${rule}`);
      }
    }

    // ── 要求输出格式 ──
    parts.push("");
    parts.push("请根据你看到的、听到的、记住的，做出这个时间段的决策。");
    parts.push(`返回纯JSON:
{
  "action": "你这个时间段做了什么（50-100字，像小说叙述——有表情、小动作、环境互动）",
  "movement": "要移动到的地点id" 或 null,
  "speech": { "to": "对方npc_id", "content": "说的话（40-80字，像真人说话）", "subtext": "你说这话的真实意图（20字）" } 或 null,
  "thought": "你的内心独白（50-80字，意识流风格——纠结、欲望、恐惧交织）",
  "mood": "细腻的情绪词（如'烦躁中带着不甘'）",
  "moodValue": 0-100,
  "pressure": 0-100,
  "energy": 0-100,
  "decisionChain": "感知→记忆→基因→行动 的推理链（50-100字）",
  "goalChanges": { "目标名": 增减值 } 或 {},
  "relationshipChanges": [{ "target": "npc_id", "innerDelta": 0, "outerDelta": 0, "reason": "原因" }] 或 []
}`);

    return parts.join("\n");
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  对话响应
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 被另一个 NPC 说话时触发的响应
   *
   * @param {object} fromNpc — 说话者的外在信息 { id, name, title, mood }
   * @param {string} content — 对方说的话
   * @param {object} perception — 当前感知信息
   * @returns {Promise<object>} 回应结果 { speech, thought, moodChange, relationshipChange }
   */
  async respondToSpeech(fromNpc, content, perception) {
    // 检索与说话者和话题相关的记忆
    const context = `${fromNpc.name}对我说: ${content}`;
    const relevantMemories = this.memory.retrieveRelevant(context, 3);

    // 查看我对这个人的关系
    const relationship = this.data.relationships?.[fromNpc.id];
    const relDesc = relationship
      ? `内心态度${relationship.inner > 0 ? "+" : ""}${relationship.inner}, 外在表现${relationship.outer > 0 ? "+" : ""}${relationship.outer} — ${relationship.notes}`
      : "不太了解这个人";

    const systemPrompt = this.buildSystemPrompt();

    const memoryText = relevantMemories.length > 0
      ? relevantMemories.map(m => `  - ${m.content || m.belief}`).join("\n")
      : "  没有特别相关的记忆";

    const userPrompt = `【有人在和你说话】
${fromNpc.name}(${fromNpc.title}) 对你说: "${content}"
对方看起来: ${fromNpc.mood || "正常"}

【你对这个人的看法】
${relDesc}

【你想起了...】
${memoryText}

【当前场景】
地点: ${perception.locationName || perception.location}
时间: 第${perception.currentTime.day}天 ${String(perception.currentTime.hour).padStart(2, "0")}:00

请决定如何回应，返回纯JSON:
{
  "speech": "你的回复（40-80字，像真人说话——有语气词、有性格）",
  "subtext": "你说这话的真实意图（20字）",
  "thought": "你的内心想法（30-50字）",
  "moodChange": -10到10之间的情绪变化值,
  "relationshipChange": { "innerDelta": -5到5, "outerDelta": -5到5, "reason": "原因" }
}`;

    try {
      const raw = await this.llmClient.call(systemPrompt, userPrompt);
      const result = safeParse(raw);

      // 写入对话记忆
      await this.memory.writeMemory(
        {
          content: `${fromNpc.name}对我说:"${content}"，我回复:"${result.speech || "..."}"`,
          location: perception.location,
          emotionalIntensity: Math.abs(result.moodChange ?? 0) * 5 + 30,
          source: "witnessed",
        },
        this.data.state,
        this.llmClient
      );

      // 更新情绪
      if (result.moodChange) {
        this.data.state.moodValue = clamp(this.data.state.moodValue + result.moodChange, 0, 100);
      }

      return {
        speech: {
          to: fromNpc.id,
          content: result.speech ?? "...",
          subtext: result.subtext ?? "",
        },
        thought: result.thought ?? "",
        moodChange: result.moodChange ?? 0,
        relationshipChange: result.relationshipChange
          ? { target: fromNpc.id, ...result.relationshipChange }
          : null,
      };
    } catch (_e) {
      // 降级: 简单回应
      return {
        speech: {
          to: fromNpc.id,
          content: "嗯...我想想。",
          subtext: "需要时间消化",
        },
        thought: "一时不知道该怎么回应。",
        moodChange: 0,
        relationshipChange: null,
      };
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  状态查询与更新
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 获取 NPC 当前完整状态（用于 UI 展示）
   *
   * @returns {object} 包含基本信息、状态、记忆、关系的完整快照
   */
  getState() {
    const memAll = this.memory.getAllMemories();
    return {
      // 基本信息
      id: this.data.id,
      name: this.data.name,
      title: this.data.title,
      emoji: this.data.emoji,
      age: this.data.age,
      region: this.data.region,
      background: this.data.background,

      // 当前状态
      state: { ...this.data.state },
      currentAction: this.currentAction,
      currentThought: this.currentThought,

      // 基因（只读摘要）
      gene: this.data.gene,

      // 技能
      skills: this.data.skills,

      // 目标
      goals: this.data.goals,

      // 关系网
      relationships: this.data.relationships,

      // 性格
      personality: this.data.personality,

      // 当前行动/思考（兼容字段名）
      action: this.currentAction,
      thought: this.currentThought,

      // 决策链
      decisionChain: this._lastDecisionChain,

      // 记忆面板数据
      memories: {
        episodic: memAll.episodic.sort((a, b) => b.timestamp - a.timestamp),
        semantic: memAll.semantic.sort((a, b) => b.confidence - a.confidence),
        // 兼容V1格式
        long: memAll.semantic?.map(s => s.belief) || [],
        medium: memAll.episodic?.filter(e => e.importance > 0.5).map(e => e.content) || [],
        short: memAll.episodic?.slice(-5).map(e => e.content) || [],
        stats: {
          episodicCount: memAll.episodic.length,
          episodicCapacity: 100,
          semanticCount: memAll.semantic.length,
          semanticCapacity: 30,
        },
      },
    };
  }

  /**
   * 更新 NPC 状态（外部注入，如世界引擎的强制更新）
   *
   * @param {object} changes — 要更新的字段
   */
  updateState(changes) {
    if (changes.region !== undefined) this.data.region = changes.region;
    if (changes.state) {
      if (changes.state.mood !== undefined) this.data.state.mood = changes.state.mood;
      if (changes.state.moodValue !== undefined) this.data.state.moodValue = clamp(changes.state.moodValue, 0, 100);
      if (changes.state.pressure !== undefined) this.data.state.pressure = clamp(changes.state.pressure, 0, 100);
      if (changes.state.energy !== undefined) this.data.state.energy = clamp(changes.state.energy, 0, 100);
      if (changes.state.performance !== undefined) this.data.state.performance = changes.state.performance;
      if (changes.state.salary !== undefined) this.data.state.salary = changes.state.salary;
    }
    if (changes.goals) {
      for (const [name, delta] of Object.entries(changes.goals)) {
        if (this.data.goals[name]) {
          this.data.goals[name].satisfaction = clamp(
            this.data.goals[name].satisfaction + delta, 0, 100
          );
        }
      }
    }
    if (changes.relationships) {
      for (const change of changes.relationships) {
        if (!change.target) continue;
        const existing = this.data.relationships[change.target] || { inner: 0, outer: 0, notes: "" };
        this.data.relationships[change.target] = {
          inner: clamp(existing.inner + (change.innerDelta ?? 0), -100, 100),
          outer: clamp(existing.outer + (change.outerDelta ?? 0), -100, 100),
          notes: change.reason || existing.notes,
        };
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  私有方法
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 将感知信息转为纯文本（用于记忆检索的查询文本）
   */
  _buildPerceptionText(perception) {
    const parts = [];
    parts.push(`地点:${perception.locationName || perception.location}`);

    if (perception.presentNpcs?.length > 0) {
      parts.push(`看到:${perception.presentNpcs.map(p => `${p.name}在${p.action || "这里"}`).join("，")}`);
    }
    if (perception.recentSpeechToMe?.length > 0) {
      parts.push(`听到:${perception.recentSpeechToMe.map(s => `${s.fromName || s.from}说"${s.content}"`).join("，")}`);
    }
    if (perception.worldEvent) {
      parts.push(`事件:${perception.worldEvent}`);
    }
    return parts.join(" | ");
  }

  /**
   * 将本次经历汇总为记忆写入的内容
   */
  _summarizeExperience(perception, decision) {
    const parts = [];
    const time = `第${perception.currentTime.day}天${perception.currentTime.hour}:00`;
    parts.push(`[${time}]`);
    parts.push(`在${perception.locationName || perception.location}`);

    if (decision.action) {
      parts.push(decision.action.slice(0, 50));
    }
    if (decision.speech?.content) {
      parts.push(`对${decision.speech.to}说了话`);
    }
    if (perception.recentSpeechToMe?.length > 0) {
      parts.push(`${perception.recentSpeechToMe[0].fromName || perception.recentSpeechToMe[0].from}跟我说了话`);
    }
    if (perception.worldEvent) {
      parts.push(`发生了:${perception.worldEvent.slice(0, 30)}`);
    }

    return parts.join("，");
  }

  /**
   * 将决策结果应用到 NPC 状态
   */
  _applyDecisionToState(decision) {
    // 情绪/压力/精力
    if (decision.mood) this.data.state.mood = decision.mood;
    if (typeof decision.moodValue === "number") this.data.state.moodValue = clamp(decision.moodValue, 0, 100);
    if (typeof decision.pressure === "number") this.data.state.pressure = clamp(decision.pressure, 0, 100);
    if (typeof decision.energy === "number") this.data.state.energy = clamp(decision.energy, 0, 100);

    // 位置
    if (decision.movement) this.data.region = decision.movement;

    // 目标变化
    if (decision.goalChanges) {
      for (const [name, delta] of Object.entries(decision.goalChanges)) {
        if (this.data.goals[name]) {
          this.data.goals[name].satisfaction = clamp(
            this.data.goals[name].satisfaction + delta, 0, 100
          );
        }
      }
    }

    // 关系变化
    if (decision.relationshipChanges && Array.isArray(decision.relationshipChanges)) {
      for (const change of decision.relationshipChanges) {
        if (!change.target) continue;
        const existing = this.data.relationships[change.target] || { inner: 0, outer: 0, notes: "" };
        this.data.relationships[change.target] = {
          inner: clamp(existing.inner + (change.innerDelta ?? 0), -100, 100),
          outer: clamp(existing.outer + (change.outerDelta ?? 0), -100, 100),
          notes: change.reason || existing.notes,
        };
      }
    }
  }

  /**
   * LLM 调用失败时的降级决策
   */
  _fallbackDecision(perception) {
    return {
      action: `${this.data.name}继续待在${perception.locationName || perception.location}，做着日常的工作。`,
      movement: null,
      speech: null,
      thought: "今天似乎没什么特别的事...",
      mood: this.data.state.mood,
      moodValue: this.data.state.moodValue,
      pressure: this.data.state.pressure,
      energy: Math.max(this.data.state.energy - 5, 0),
      decisionChain: "LLM调用失败，执行默认行为",
      goalChanges: {},
      relationshipChanges: [],
    };
  }
}
