/**
 * 认知记忆系统 — Dreamina V2
 *
 * 参考:
 *   - 斯坦福小镇: 时间衰减 × 重要性 × 相关性 三因子检索
 *   - Mem0: 记忆写入流水线 (提取→比对→ADD/UPDATE/DELETE/NOOP)
 *   - Ebbinghaus 遗忘曲线: 指数衰减 retention = e^(-t/strength)
 *   - Tulving 情景/语义记忆二分法
 *
 * 基因调制:
 *   - 敏感度高 → 情绪事件记得更牢，但细节可能失真
 *   - 理性高 → 回忆偏向事实还原
 *   - 感性高 → 回忆偏向情绪强化
 *   - 风险偏好高 → 容易忘记失败教训
 *   - 共情高 → 记住别人的情绪细节
 */

// ─── 常量 ───

/** 情景记忆容量上限 */
const EPISODIC_CAPACITY = 100;

/** 语义记忆容量上限 */
const SEMANTIC_CAPACITY = 30;

/** 遗忘阈值 — retention 低于此值的记忆会被移除 */
const FORGET_THRESHOLD = 0.05;

/** 每次检索时最大候选集（避免对全量做相关性计算） */
const MAX_CANDIDATES = 50;

// ─── 工具函数 ───

/** 生成简易唯一 id */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 限制值域 */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 简单文本相似度 — 基于共有关键词的 Jaccard 系数
 * 不依赖 npm 包，效果足够用于记忆检索排序
 */
function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a.replace(/[，。！？、；：""''（）\s]+/g, " ").split(" ").filter(Boolean));
  const setB = new Set(b.replace(/[，。！？、；：""''（）\s]+/g, " ").split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

// ─── 主类 ───

export class CognitiveMemory {
  /**
   * @param {object} npcGene — NPC 的基因数据，来自 world.js 中的 npc.gene
   */
  constructor(npcGene) {
    this.gene = npcGene;

    /** @type {Array<EpisodicMemory>} 情景记忆 */
    this.episodic = [];

    /** @type {Array<SemanticMemory>} 语义记忆 */
    this.semantic = [];

    // ── 从基因中提取调制参数（缓存，避免重复计算）──
    const sensitivity = npcGene.emotional_baseline?.敏感度 ?? 0.5;
    const rationality = npcGene.cognitive_style?.["理性vs感性"] ?? 0.5;
    const riskAppetite = npcGene.cognitive_style?.风险偏好 ?? 0.5;
    const empathy = npcGene.talent_genes?.共情天赋 ?? 0.5;
    const logic = npcGene.talent_genes?.逻辑天赋 ?? 0.5;

    /**
     * 基因调制参数，影响记忆的写入/衰减/检索行为
     */
    this.modifiers = {
      /** 情绪事件的记忆强度加成（敏感度越高加成越大） */
      emotionalBoost: 1 + sensitivity * 0.8, // 范围 1.0 ~ 1.8
      /** 情绪回忆时的细节失真概率（敏感度高+感性高→更容易失真） */
      distortionRisk: sensitivity * (1 - rationality) * 0.5,
      /** 失败教训的额外衰减速率（风险偏好高→更快遗忘失败） */
      failureDecayMultiplier: 1 + riskAppetite * 0.6, // 范围 1.0 ~ 1.6
      /** 他人情绪细节的记忆加成（共情高→记住别人的情绪） */
      empathyBoost: 1 + empathy * 0.5, // 范围 1.0 ~ 1.5
      /** 重要性评估准确度（逻辑天赋高→更准确） */
      importanceAccuracy: 0.5 + logic * 0.5, // 范围 0.5 ~ 1.0
      /** 回忆偏向：>0.5 偏事实还原，<0.5 偏情绪强化 */
      recallBias: rationality,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  记忆写入流水线
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 智能记忆写入（参考 Mem0 流水线）
   *
   * 流程: 事件 → LLM 提取关键事实 → 与已有记忆比对 → ADD/UPDATE/DELETE/NOOP
   *
   * @param {object} event — 发生的事件 { type, content, location, participants, emotionalIntensity, ... }
   * @param {object} npcState — NPC 当前状态 { mood, moodValue, pressure, energy, ... }
   * @param {object} llmClient — LLM 调用客户端 { call(systemPrompt, userPrompt): Promise<string> }
   * @returns {Promise<{action: string, memory?: object}>} 执行的操作及结果
   */
  async writeMemory(event, npcState, llmClient) {
    // 1. 从已有记忆中找出与事件相关的条目
    const relatedEpisodic = this._findRelated(event.content, this.episodic, 5);
    const relatedSemantic = this._findRelated(event.content, this.semantic, 3);

    // 2. 构建 LLM prompt，让其决定操作
    const systemPrompt = `你是一个记忆管理系统。根据NPC的新经历和已有记忆，决定如何更新记忆。
只输出纯JSON，不要任何其他文字。`;

    const userPrompt = `## 新发生的事件
${event.content}
情绪强度: ${event.emotionalIntensity ?? 50}/100
地点: ${event.location ?? "未知"}
来源: ${event.source ?? "witnessed"}

## NPC当前状态
情绪: ${npcState.mood}(${npcState.moodValue}/100) | 压力: ${npcState.pressure}/100

## 已有相关情景记忆
${relatedEpisodic.length > 0 ? relatedEpisodic.map((m, i) => `[${i}] id=${m.id}: ${m.content}`).join("\n") : "无"}

## 已有相关语义记忆(信念)
${relatedSemantic.length > 0 ? relatedSemantic.map((m, i) => `[${i}] id=${m.id}: ${m.belief}`).join("\n") : "无"}

请决定记忆操作，返回JSON:
{
  "episodic_action": "ADD" | "UPDATE" | "NOOP",
  "episodic_target_id": "要更新的记忆id（UPDATE时填）" | null,
  "episodic_content": "要写入/更新的记忆内容（ADD/UPDATE时填）" | null,
  "importance": 1-100,
  "semantic_action": "ADD" | "UPDATE" | "DELETE" | "NOOP",
  "semantic_target_id": "要操作的语义记忆id" | null,
  "semantic_belief": "归纳出的信念（ADD/UPDATE时填）" | null,
  "semantic_confidence": 0.1-1.0,
  "reasoning": "决策原因（20字内）"
}`;

    try {
      const raw = await llmClient.call(systemPrompt, userPrompt);
      const decision = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());

      // 3. 执行情景记忆操作
      let episodicResult = null;
      if (decision.episodic_action === "ADD") {
        episodicResult = this.addEpisodic({
          content: decision.episodic_content || event.content,
          timestamp: Date.now(),
          location: event.location ?? null,
          emotionalIntensity: clamp(
            (decision.importance ?? 50) * this.modifiers.emotionalBoost *
            (event.emotionalIntensity ? event.emotionalIntensity / 50 : 1),
            0, 100
          ),
          source: event.source ?? "witnessed",
          importance: clamp(decision.importance ?? 50, 1, 100),
        });
      } else if (decision.episodic_action === "UPDATE" && decision.episodic_target_id) {
        const target = this.episodic.find(m => m.id === decision.episodic_target_id);
        if (target) {
          target.content = decision.episodic_content || target.content;
          target.importance = Math.max(target.importance, decision.importance ?? target.importance);
          target.lastRecalled = Date.now();
          target.recallCount++;
          episodicResult = target;
        }
      }

      // 4. 执行语义记忆操作
      let semanticResult = null;
      if (decision.semantic_action === "ADD" && decision.semantic_belief) {
        semanticResult = this.addSemantic({
          belief: decision.semantic_belief,
          confidence: clamp(decision.semantic_confidence ?? 0.5, 0.1, 1),
          supportingEpisodes: episodicResult ? [episodicResult.id] : [],
        });
      } else if (decision.semantic_action === "UPDATE" && decision.semantic_target_id) {
        const target = this.semantic.find(m => m.id === decision.semantic_target_id);
        if (target) {
          target.belief = decision.semantic_belief || target.belief;
          target.confidence = clamp(
            decision.semantic_confidence ?? target.confidence,
            0.1, 1
          );
          target.lastValidated = Date.now();
          if (episodicResult) {
            target.supportingEpisodes.push(episodicResult.id);
          }
          semanticResult = target;
        }
      } else if (decision.semantic_action === "DELETE" && decision.semantic_target_id) {
        this.semantic = this.semantic.filter(m => m.id !== decision.semantic_target_id);
      }

      return {
        action: decision.episodic_action,
        episodic: episodicResult,
        semantic: semanticResult,
        reasoning: decision.reasoning,
      };
    } catch (_e) {
      // LLM 调用失败时，退化为简单 ADD
      const mem = this.addEpisodic({
        content: event.content,
        timestamp: Date.now(),
        location: event.location ?? null,
        emotionalIntensity: event.emotionalIntensity ?? 50,
        source: event.source ?? "witnessed",
        importance: 50,
      });
      return { action: "ADD_FALLBACK", episodic: mem, semantic: null, reasoning: "LLM调用失败，降级处理" };
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  记忆检索
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 检索与当前情境最相关的记忆
   *
   * 评分公式: score = recency × importance × relevance
   *   - recency: 时间衰减（越近越高）
   *   - importance: 归一化重要性
   *   - relevance: 与查询文本的相似度
   *
   * @param {string} context — 当前情境描述
   * @param {number} limit — 返回条数上限
   * @returns {Array<object>} 按得分排序的记忆列表
   */
  retrieveRelevant(context, limit = 5) {
    const now = Date.now();
    const results = [];

    // 情景记忆评分
    for (const mem of this.episodic) {
      const recency = this._calcRecency(mem, now);
      const importance = mem.importance / 100;
      const relevance = textSimilarity(context, mem.content);
      // 三因子加权
      const score = recency * 0.3 + importance * 0.3 + relevance * 0.4;
      results.push({ ...mem, _type: "episodic", _score: score, _recency: recency, _relevance: relevance });
    }

    // 语义记忆评分（信念的权重略高）
    for (const mem of this.semantic) {
      const recency = this._calcRecency({ timestamp: mem.formedAt, lastRecalled: mem.lastValidated, recallCount: mem.supportingEpisodes.length, decayRate: 0.3, importance: 70, emotionalIntensity: 30 }, now);
      const importance = mem.confidence;
      const relevance = textSimilarity(context, mem.belief);
      const score = recency * 0.2 + importance * 0.35 + relevance * 0.45;
      results.push({ ...mem, _type: "semantic", _score: score, _recency: recency, _relevance: relevance });
    }

    // 按分数降序排序，取 top-N
    results.sort((a, b) => b._score - a._score);
    return results.slice(0, limit);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  情景记忆: 亲身经历的事件
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 添加一条情景记忆
   *
   * @param {object} memory
   *   - content {string} 事件内容
   *   - timestamp {number} 发生时间 (ms)
   *   - location {string|null} 地点
   *   - emotionalIntensity {number} 情绪强度 0-100
   *   - source {'witnessed'|'heard'|'told'} 信息来源
   *   - importance {number} 重要性 1-100
   * @returns {object} 完整的记忆条目
   */
  addEpisodic(memory) {
    const entry = {
      id: uid(),
      timestamp: memory.timestamp ?? Date.now(),
      location: memory.location ?? null,
      content: memory.content,
      emotionalIntensity: clamp(memory.emotionalIntensity ?? 50, 0, 100),
      source: memory.source ?? "witnessed",
      importance: clamp(memory.importance ?? 50, 1, 100),
      lastRecalled: memory.timestamp ?? Date.now(),
      recallCount: 0,
      // 衰减速率: 基础0.5，情绪越强衰减越慢（记得越牢）
      decayRate: this._calcDecayRate(memory),
    };

    this.episodic.push(entry);

    // 容量管理: 超出上限时移除最不重要/最旧的
    if (this.episodic.length > EPISODIC_CAPACITY) {
      this._evictEpisodic();
    }

    return entry;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  语义记忆: 从经历中归纳的知识和信念
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 添加一条语义记忆（信念/知识）
   *
   * @param {object} belief
   *   - belief {string} 信念内容（如 "李四不可靠"）
   *   - confidence {number} 信心度 0.1-1.0
   *   - supportingEpisodes {string[]} 支撑这条信念的情景记忆 id 列表
   * @returns {object} 完整的语义记忆条目
   */
  addSemantic(belief) {
    const entry = {
      id: uid(),
      belief: belief.belief,
      confidence: clamp(belief.confidence ?? 0.5, 0.1, 1),
      supportingEpisodes: belief.supportingEpisodes ?? [],
      formedAt: Date.now(),
      lastValidated: Date.now(),
    };

    this.semantic.push(entry);

    // 容量管理
    if (this.semantic.length > SEMANTIC_CAPACITY) {
      this._evictSemantic();
    }

    return entry;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  战略性遗忘: Ebbinghaus 指数衰减
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 对所有记忆执行时间衰减，移除低于阈值的记忆
   *
   * 遗忘曲线: retention = e^(-t / strength)
   *   - t: 距上次回忆的时间（小时）
   *   - strength: 记忆强度 = importance × (1 + recallCount × 0.3) / decayRate
   *
   * @param {number} currentTime — 当前时间 (ms)
   * @returns {{ forgotten: number, remaining: number }} 遗忘统计
   */
  decay(currentTime) {
    const now = currentTime ?? Date.now();
    let forgotten = 0;

    // 情景记忆衰减
    this.episodic = this.episodic.filter(mem => {
      const retention = this._calcRetention(mem, now);
      if (retention < FORGET_THRESHOLD) {
        forgotten++;
        return false;
      }
      return true;
    });

    // 语义记忆衰减 — 信念衰减更慢，但失去所有支撑证据时会加速
    this.semantic = this.semantic.filter(mem => {
      // 检查支撑证据是否还存在
      const survivingSupport = mem.supportingEpisodes.filter(
        epId => this.episodic.some(e => e.id === epId)
      );
      mem.supportingEpisodes = survivingSupport;

      // 无支撑证据 → 信心度衰减
      if (survivingSupport.length === 0) {
        const hoursSinceValidated = (now - mem.lastValidated) / (1000 * 3600);
        mem.confidence -= hoursSinceValidated * 0.01;
      }

      if (mem.confidence < 0.1) {
        forgotten++;
        return false;
      }
      return true;
    });

    return { forgotten, remaining: this.episodic.length + this.semantic.length };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  反思: 从具体事件归纳抽象认知
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 基于最近的情景记忆进行反思，归纳出新的语义记忆（信念）
   *
   * @param {Array<object>} recentMemories — 最近的情景记忆（通常取最近 5-10 条）
   * @param {object} llmClient — { call(systemPrompt, userPrompt): Promise<string> }
   * @returns {Promise<Array<object>>} 新增的语义记忆列表
   */
  async reflect(recentMemories, llmClient) {
    if (!recentMemories || recentMemories.length < 3) {
      return []; // 记忆太少，不足以反思
    }

    const existingBeliefs = this.semantic.map(s => s.belief).join("\n") || "无";

    const systemPrompt = `你是一个NPC的认知反思系统。根据最近经历的事件，归纳出可以形成的信念或认知。
只输出纯JSON数组，不要任何其他文字。`;

    const userPrompt = `## 最近的经历
${recentMemories.map((m, i) => `${i + 1}. ${m.content} (重要性:${m.importance}, 情绪强度:${m.emotionalIntensity})`).join("\n")}

## 已有的信念
${existingBeliefs}

请归纳出0-2条新的信念/认知（不要重复已有信念），返回JSON数组:
[
  {
    "belief": "归纳出的信念（如：'在这个团队里主动发言会得到认可'）",
    "confidence": 0.1-1.0,
    "supporting_indices": [0, 2]
  }
]
如果没有新认知，返回空数组 []。`;

    try {
      const raw = await llmClient.call(systemPrompt, userPrompt);
      const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());

      const newBeliefs = [];
      for (const item of parsed) {
        if (!item.belief) continue;

        // 将 supporting_indices 映射为对应的 episodic id
        const supportingIds = (item.supporting_indices ?? [])
          .filter(i => i >= 0 && i < recentMemories.length)
          .map(i => recentMemories[i].id);

        const entry = this.addSemantic({
          belief: item.belief,
          confidence: clamp(item.confidence ?? 0.5, 0.1, 1),
          supportingEpisodes: supportingIds,
        });
        newBeliefs.push(entry);
      }

      return newBeliefs;
    } catch (_e) {
      return []; // 反思失败不影响主流程
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  查询与序列化
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 获取所有记忆（用于 UI 记忆面板展示）
   *
   * @returns {{ episodic: Array, semantic: Array }}
   */
  getAllMemories() {
    return {
      episodic: [...this.episodic],
      semantic: [...this.semantic],
    };
  }

  /**
   * 序列化为可持久化的纯对象
   */
  serialize() {
    return {
      episodic: this.episodic,
      semantic: this.semantic,
    };
  }

  /**
   * 从持久化数据恢复实例
   *
   * @param {object} data — serialize() 的输出
   * @param {object} npcGene — NPC 基因数据
   * @returns {CognitiveMemory}
   */
  static deserialize(data, npcGene) {
    const instance = new CognitiveMemory(npcGene);
    instance.episodic = data.episodic ?? [];
    instance.semantic = data.semantic ?? [];
    return instance;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  私有方法
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 计算记忆的 retention（保留率）
   *
   * Ebbinghaus 遗忘曲线: retention = e^(-t / strength)
   *   - t = 距上次回忆的时间（小时）
   *   - strength = importance × (1 + recallCount × 0.3) / decayRate
   */
  _calcRetention(mem, now) {
    const hours = (now - (mem.lastRecalled ?? mem.timestamp)) / (1000 * 3600);
    const strength = (mem.importance / 100) * (1 + (mem.recallCount ?? 0) * 0.3) / (mem.decayRate ?? 0.5);
    // strength 归一化到合理范围（避免除以0）
    const effectiveStrength = Math.max(strength, 0.01) * 24; // 以24小时为基准单位
    return Math.exp(-hours / effectiveStrength);
  }

  /**
   * 计算时间近度评分（用于检索排序）
   * 近期记忆分数高，远期记忆分数低，但被频繁回忆的记忆分数也高
   */
  _calcRecency(mem, now) {
    const hours = (now - (mem.lastRecalled ?? mem.timestamp)) / (1000 * 3600);
    // 近度随时间指数衰减，半衰期约12小时
    const baseRecency = Math.exp(-hours / 12);
    // 回忆次数加成
    const recallBoost = 1 + (mem.recallCount ?? 0) * 0.1;
    return clamp(baseRecency * recallBoost, 0, 1);
  }

  /**
   * 计算新记忆的衰减速率
   * 基因调制:
   *   - 情绪强的事件: 敏感度高→衰减更慢（记得更牢）
   *   - 失败教训: 风险偏好高→衰减更快（容易忘）
   */
  _calcDecayRate(memory) {
    let rate = 0.5; // 基础衰减速率

    const emotionalIntensity = (memory.emotionalIntensity ?? 50) / 100;

    // 情绪越强→衰减越慢（敏感度加成）
    if (emotionalIntensity > 0.5) {
      rate *= 1 / (this.modifiers.emotionalBoost * emotionalIntensity);
    }

    // 他人情绪相关记忆: 共情加成
    if (memory.source === "witnessed" || memory.source === "heard") {
      rate *= 1 / this.modifiers.empathyBoost;
    }

    // 负面/失败类事件: 风险偏好高→更快遗忘
    if (emotionalIntensity > 0.5 && (memory.importance ?? 50) < 40) {
      rate *= this.modifiers.failureDecayMultiplier;
    }

    return clamp(rate, 0.1, 2.0);
  }

  /**
   * 在记忆库中查找与给定文本相关的条目
   */
  _findRelated(text, memories, limit) {
    if (!text || memories.length === 0) return [];

    const scored = memories.map(m => ({
      ...m,
      _sim: textSimilarity(text, m.content || m.belief || ""),
    }));

    scored.sort((a, b) => b._sim - a._sim);
    return scored.slice(0, limit).filter(m => m._sim > 0);
  }

  /**
   * 情景记忆淘汰 — 移除最不重要且最旧的记忆直到容量合规
   */
  _evictEpisodic() {
    const now = Date.now();
    // 按综合得分排序（重要性 × retention），移除得分最低的
    this.episodic.sort((a, b) => {
      const scoreA = (a.importance / 100) * this._calcRetention(a, now);
      const scoreB = (b.importance / 100) * this._calcRetention(b, now);
      return scoreB - scoreA;
    });
    this.episodic = this.episodic.slice(0, EPISODIC_CAPACITY);
  }

  /**
   * 语义记忆淘汰 — 移除信心度最低的信念
   */
  _evictSemantic() {
    this.semantic.sort((a, b) => b.confidence - a.confidence);
    this.semantic = this.semantic.slice(0, SEMANTIC_CAPACITY);
  }
}
