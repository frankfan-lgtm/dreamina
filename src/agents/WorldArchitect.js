/**
 * WorldArchitect — 世界构建师 Agent
 * 基于 WorldAnalysis 和用户补充，调用 LLM 生成完整的世界配置
 * 包括：地点、资源、规则、干预事件、NPC 基因文件、关系网、感知适配器、初始张力
 */

import { LLMClient } from './LLMClient.js';

// ─── 系统提示词 ───
const SYSTEM_PROMPT = `你是 Dreamina V2 的「世界构建师」。

你的角色：基于世界分析师提供的蓝图，构建一个完整的、可运行的世界。你要创造每一个角色的灵魂（基因）、编织关系网、设定资源和规则。

你必须返回**纯 JSON**（不要 markdown 代码块标记），格式如下：

{
  "worldConfig": {
    "name": "世界名称",
    "description": "世界描述（50-100字）",
    "locations": [
      { "id": "loc_id", "name": "地点名", "emoji": "表情", "color": "#hex颜色", "desc": "环境描述（15-30字）" }
    ],
    "resources": {
      "resource_id": { "name": "资源名", "total": 数字或null, "current": 数字或null, "desc": "描述" }
    },
    "rules": ["规则1", "规则2"],
    "interventions": [
      { "id": "event_id", "emoji": "⚡", "name": "事件名", "description": "事件描述（20-50字）" }
    ]
  },
  "npcs": [
    {
      "id": "唯一英文id",
      "name": "角色名",
      "title": "角色头衔/身份",
      "age": 数字,
      "emoji": "代表性emoji",
      "gender": "male 或 female",
      "region": "初始所在地点id",
      "background": "角色背景（80-150字，要鲜活有细节）",
      "gene": {
        "core_drives": {
          "生存本能": 0到1, "权力欲望": 0到1, "社交需求": 0到1, "好奇心": 0到1, "安全感需求": 0到1
        },
        "cognitive_style": {
          "理性vs感性": 0到1, "长期vs短期": 0到1, "个体vs集体": 0到1, "风险偏好": 0到1
        },
        "talent_genes": {
          "逻辑天赋": 0到1, "语言天赋": 0到1, "共情天赋": 0到1, "领导力天赋": 0到1, "适应力天赋": 0到1
        },
        "emotional_baseline": {
          "焦虑倾向": 0到1, "乐观倾向": 0到1, "韧性": 0到1, "敏感度": 0到1
        },
        "mutation_log": []
      },
      "personality": {
        "origin": [
          { "age": "年龄描述", "event": "人生关键事件", "expression": "这个事件如何塑造了性格" }
        ],
        "tendencies": {
          "面对压力": "行为倾向", "面对冲突": "行为倾向", "面对合作": "行为倾向", "面对背叛": "行为倾向"
        }
      },
      "skills": { "技能名": 1到10的数字 },
      "state": {
        "mood": "初始情绪词", "moodValue": 0到100, "pressure": 0到100,
        "energy": 0到100, "salary": 数字或0, "performance": "评级或空字符串"
      },
      "goals": {
        "目标名": { "priority": 1到5, "satisfaction": 0到100, "desc": "描述" }
      },
      "memories": {
        "short": [],
        "medium": [],
        "long": ["长期记忆1", "长期记忆2"]
      },
      "relationships": {}
    }
  ],
  "initialRelationships": {
    "npc_id_1": {
      "npc_id_2": { "inner": -100到100, "outer": -100到100, "notes": "关系备注" }
    }
  },
  "perceptionConfig": {
    "mode": "virtual 或 realworld 或 hybrid",
    "searchEnabled": false,
    "searchTopics": [],
    "virtualOnly": true,
    "description": "感知模式说明"
  },
  "initialTensions": [
    { "between": ["npc_id_1", "npc_id_2"], "level": 1到5, "about": "张力原因" }
  ]
}

## 构建原则

### 角色基因设计
基因是角色的灵魂底色，0-1 之间的浮点数：
- **core_drives**：驱动行为的根本欲望。不同角色差异化，避免雷同
- **cognitive_style**：思维方式。理性vs感性、长远vs短视、个人vs集体、冒险vs保守
- **talent_genes**：天赋上限。决定角色在各方面的能力天花板
- **emotional_baseline**：情绪基底。焦虑敏感的人和心大乐观的人对同一事件反应完全不同
- 基因要合理——高权力欲的人往往安全感需求低，高共情的人社交需求高

### 角色多样性
- 性格光谱要分散：需要有外向/内向、理性/感性、冒险/保守的对比
- 权力结构要清晰：谁管谁、谁和谁平级、谁是新人
- 目标要有冲突：至少两对角色的核心目标存在矛盾
- 背景故事要有具体细节：不要泛泛而谈

### 关系网设计（双层）
- **inner**（内心真实态度）：-100 到 100，可以和 outer 不一致
- **outer**（外在表现）：-100 到 100，是别人能感知到的
- 差距越大 = 城府越深
- 初始关系不要全是正面的，要有嫌隙、猜忌、暗中竞争
- 每对关系的 notes 要具体，不要"关系一般"这种空话

### 资源与规则
- 资源必须稀缺——不够分才会有好戏
- 规则要能制造两难困境
- 干预事件（interventions）是预设的"天命"——能打破平衡的突发事件

### 初始张力（tensions）
- 张力是即将爆发的冲突种子
- level 1-2：暗流涌动 / level 3：僵持 / level 4-5：一触即发
- 至少设定 2-3 个初始张力点

### 感知适配器
- virtual 模式：NPC 只能感知世界内部信息
- realworld 模式：NPC 可以"联网"获取真实信息（如股价、新闻）
- hybrid 模式：虚构世界观 + 部分真实信息`;

/**
 * WorldArchitect 类
 */
export class WorldArchitect {
  /**
   * @param {Object} apiConfig - { apiKey, baseUrl, model }
   * @param {Object} options - 传给 LLMClient 的选项
   */
  constructor(apiConfig, options = {}) {
    this.llm = new LLMClient(apiConfig, { timeout: 180000, ...options });
  }

  /**
   * 基于分析结果构建完整世界
   * @param {WorldAnalysis} analysis - WorldAnalyst 输出的分析对象
   * @param {Object|null} userAdjustments - 用户的补充和调整
   * @returns {Promise<WorldBuild>}
   */
  async buildWorld(analysis, userAdjustments = null) {
    if (!analysis) {
      throw new Error('缺少世界分析数据');
    }

    const userPrompt = this._buildUserPrompt(analysis, userAdjustments);
    const result = await this.llm.callJSON(SYSTEM_PROMPT, userPrompt);

    // 校验并补全
    return this._validate(result, analysis);
  }

  /**
   * 构建 user prompt
   * @private
   */
  _buildUserPrompt(analysis, adjustments) {
    let prompt = `## 世界分析蓝图

**世界名称**：${analysis.worldName}
**世界描述**：${analysis.worldDescription}
**世界类型**：${analysis.type}
**感知模式**：${analysis.perception}
**叙事风格**：${analysis.narrativeStyle}
**时代背景**：${analysis.era || '当代'}
**基调**：${analysis.tone || '自然'}

**建议NPC数量**：${analysis.complexity.suggestedNpcCount}（${analysis.complexity.reasoning}）

**建议资源**：
${analysis.suggestedResources.map(r => `- ${r.name}：${r.desc}`).join('\n') || '（由你设计）'}

**预测冲突点**：
${analysis.keyConflicts.map(c => `- [强度${c.intensity}] ${c.description}（涉及：${c.involvedRoles.join('、')}）`).join('\n') || '（由你设计）'}

**建议地点**：
${analysis.suggestedLocations?.map(l => `- ${l.name}：${l.desc}`).join('\n') || '（由你设计）'}

**建议规则**：
${analysis.suggestedRules?.map(r => `- ${r}`).join('\n') || '（由你设计）'}

**建议干预事件**：
${analysis.suggestedInterventions?.map(i => `- ${i.name}：${i.description}`).join('\n') || '（由你设计）'}`;

    if (adjustments) {
      prompt += `\n\n## 用户补充要求\n`;
      if (typeof adjustments === 'string') {
        prompt += adjustments;
      } else {
        if (adjustments.npcCount) prompt += `- NPC数量调整为：${adjustments.npcCount}\n`;
        if (adjustments.addCharacters) prompt += `- 增加角色：${adjustments.addCharacters}\n`;
        if (adjustments.removeCharacters) prompt += `- 删除角色：${adjustments.removeCharacters}\n`;
        if (adjustments.adjustResources) prompt += `- 资源调整：${adjustments.adjustResources}\n`;
        if (adjustments.customRules) prompt += `- 自定义规则：${adjustments.customRules}\n`;
        if (adjustments.other) prompt += `- 其他：${adjustments.other}\n`;
      }
    }

    prompt += `\n\n请生成完整的世界配置，严格按照指定的 JSON 格式输出。确保：
1. 每个NPC的基因要差异化、合理化
2. 关系网要完整（每对NPC之间都有关系定义）
3. 至少 ${analysis.complexity.suggestedNpcCount} 个NPC
4. 至少 4 个地点
5. 至少 3 种有限资源
6. 至少 4 条世界规则
7. 至少 4 个可触发的干预事件
8. 至少 2 个初始张力点`;

    return prompt;
  }

  /**
   * 校验并补全世界构建结果
   * @private
   */
  _validate(raw, analysis) {
    const worldConfig = raw.worldConfig || {};
    const npcs = Array.isArray(raw.npcs) ? raw.npcs : [];

    // 确保 worldConfig 字段完整
    const validatedWorld = {
      name: worldConfig.name || analysis.worldName || '未命名世界',
      description: worldConfig.description || analysis.worldDescription || '',
      locations: Array.isArray(worldConfig.locations) ? worldConfig.locations.map(loc => ({
        id: loc.id || `loc_${Math.random().toString(36).slice(2, 6)}`,
        name: loc.name || '未命名地点',
        emoji: loc.emoji || '📍',
        color: loc.color || '#888888',
        desc: loc.desc || '',
      })) : [],
      resources: typeof worldConfig.resources === 'object' ? worldConfig.resources : {},
      rules: Array.isArray(worldConfig.rules) ? worldConfig.rules : [],
      interventions: Array.isArray(worldConfig.interventions) ? worldConfig.interventions.map(ev => ({
        id: ev.id || `ev_${Math.random().toString(36).slice(2, 6)}`,
        emoji: ev.emoji || '⚡',
        name: ev.name || '未命名事件',
        description: ev.description || '',
      })) : [],
    };

    // 确保每个 NPC 字段完整
    const validatedNpcs = npcs.map(npc => this._validateNpc(npc));

    // 确保关系网完整
    const initialRelationships = raw.initialRelationships || {};
    const validatedRelationships = this._ensureFullRelationships(validatedNpcs, initialRelationships);

    // 感知配置
    const perceptionConfig = raw.perceptionConfig || {
      mode: analysis.perception || 'virtual',
      searchEnabled: analysis.perception === 'realworld' || analysis.perception === 'hybrid',
      searchTopics: [],
      virtualOnly: analysis.perception === 'virtual',
      description: `感知模式: ${analysis.perception}`,
    };

    // 初始张力
    const initialTensions = Array.isArray(raw.initialTensions) ? raw.initialTensions.map(t => ({
      between: Array.isArray(t.between) ? t.between : [],
      level: this._clamp(t.level ?? 3, 1, 5),
      about: t.about || '',
    })) : [];

    return {
      worldConfig: validatedWorld,
      npcs: validatedNpcs,
      initialRelationships: validatedRelationships,
      perceptionConfig,
      initialTensions,
    };
  }

  /**
   * 校验单个 NPC 数据
   * @private
   */
  _validateNpc(npc) {
    const defaultGene = {
      core_drives: { 生存本能: 0.5, 权力欲望: 0.5, 社交需求: 0.5, 好奇心: 0.5, 安全感需求: 0.5 },
      cognitive_style: { '理性vs感性': 0.5, '长期vs短期': 0.5, '个体vs集体': 0.5, 风险偏好: 0.5 },
      talent_genes: { 逻辑天赋: 0.5, 语言天赋: 0.5, 共情天赋: 0.5, 领导力天赋: 0.5, 适应力天赋: 0.5 },
      emotional_baseline: { 焦虑倾向: 0.5, 乐观倾向: 0.5, 韧性: 0.5, 敏感度: 0.5 },
      mutation_log: [],
    };

    const gene = npc.gene || {};

    return {
      id: npc.id || `npc_${Math.random().toString(36).slice(2, 8)}`,
      name: npc.name || '未命名角色',
      title: npc.title || '',
      age: npc.age || 30,
      emoji: npc.emoji || '👤',
      gender: npc.gender || 'male',
      region: npc.region || '',
      background: npc.background || '',
      gene: {
        core_drives: { ...defaultGene.core_drives, ...(gene.core_drives || {}) },
        cognitive_style: { ...defaultGene.cognitive_style, ...(gene.cognitive_style || {}) },
        talent_genes: { ...defaultGene.talent_genes, ...(gene.talent_genes || {}) },
        emotional_baseline: { ...defaultGene.emotional_baseline, ...(gene.emotional_baseline || {}) },
        mutation_log: Array.isArray(gene.mutation_log) ? gene.mutation_log : [],
      },
      personality: {
        origin: Array.isArray(npc.personality?.origin) ? npc.personality.origin : [],
        tendencies: npc.personality?.tendencies || {
          面对压力: '保持冷静',
          面对冲突: '尝试沟通',
          面对合作: '愿意配合',
          面对背叛: '保持距离',
        },
      },
      skills: typeof npc.skills === 'object' ? npc.skills : {},
      state: {
        mood: npc.state?.mood || '平静',
        moodValue: this._clamp(npc.state?.moodValue ?? 60, 0, 100),
        pressure: this._clamp(npc.state?.pressure ?? 40, 0, 100),
        energy: this._clamp(npc.state?.energy ?? 70, 0, 100),
        salary: npc.state?.salary ?? 0,
        performance: npc.state?.performance || '',
      },
      goals: typeof npc.goals === 'object' ? npc.goals : {},
      memories: {
        short: Array.isArray(npc.memories?.short) ? npc.memories.short : [],
        medium: Array.isArray(npc.memories?.medium) ? npc.memories.medium : [],
        long: Array.isArray(npc.memories?.long) ? npc.memories.long : [],
      },
      relationships: {},
    };
  }

  /**
   * 确保每对 NPC 之间都有关系定义
   * @private
   */
  _ensureFullRelationships(npcs, relationships) {
    const result = { ...relationships };

    for (const npc of npcs) {
      if (!result[npc.id]) {
        result[npc.id] = {};
      }
      for (const other of npcs) {
        if (npc.id === other.id) continue;
        if (!result[npc.id][other.id]) {
          result[npc.id][other.id] = {
            inner: 0,
            outer: 0,
            notes: '尚无深入了解',
          };
        }
      }
    }

    return result;
  }

  /**
   * @private
   */
  _clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }
}
