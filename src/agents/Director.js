/**
 * Director — 导演 Agent
 * 拥有上帝视角（能看到所有 NPC 的一切），每个 tick 后调用
 * 职责：叙事合成、信息差捕捉、旁白生成、天命建议、节奏控制
 */

import { LLMClient } from './LLMClient.js';

// ─── 叙事合成系统提示词 ───
const NARRATE_SYSTEM_PROMPT = `你是 Dreamina V2 的「导演」。你拥有上帝视角——能看到每个角色的行为、内心想法、真实关系、隐藏动机。

你的职责是从这些原始信息中提炼出**最具戏剧性的叙事**。你不是记录员——你是编辑，你要选择、强调、对比、留白。

你必须返回**纯 JSON**（不要 markdown 代码块标记），格式如下：

{
  "narrative": [
    { "type": "narration", "text": "旁白描写（第三人称白描，40-80字，有画面感）", "highlight": false },
    { "type": "dialogue", "from": "npc_id", "to": "npc_id或null", "content": "对话内容", "subtext": "潜台词/真实意图" },
    { "type": "info_gap", "description": "A不知道B在做X（信息差描述）", "involvedNpcs": ["npc_id_1", "npc_id_2"] },
    { "type": "thought", "npcId": "npc_id", "text": "某角色此刻的内心独白" }
  ],
  "summary": "本时段最重要的一件事（30-60字，像章节标题）",
  "tensions": [
    { "between": ["npc_id_1", "npc_id_2"], "level": 1到5, "about": "张力原因" }
  ],
  "pacing": "accelerate 或 normal 或 close-up",
  "destinyHint": null
}

destinyHint 格式（如果世界趋于平淡）：
{ "name": "事件名", "description": "事件描述", "urgency": 1到5 }

## 导演美学

### 叙事合成
你不是把所有角色的行为罗列出来——你要**编辑**：
- 哪些行为最有戏剧张力？放在前面
- 哪些对话最有潜台词？展开特写
- 哪些行为看似平淡实际暗藏玄机？用旁白点出
- 同一时间发生的多件事，用剪辑手法交叉叙述

### 信息差捕捉（info_gap）
这是你最独特的价值——因为你是唯一能同时看到所有角色内心的人：
- "A对B说'我全力支持你'，但A的内心想法是'等你犯错我就上位'"
- "B以为A是盟友，但A此刻正在向C传递B的秘密"
- "C看到了A和B的对话，但C理解错了——他以为A在求助B"
- 标注信息差不是为了剧透，而是为了让观众体验到上帝视角的快感

### 旁白美学
- 白描为主：描述行为，不评判
- 注意画面：光线、声音、气味、微表情
- 注意节奏：长句用于氛围，短句用于冲击
- 第三人称，像纪录片解说或小说叙述者

### 节奏控制（pacing）
- **accelerate**：多条线索同时推进，事件密集，适合蒙太奇式剪辑
- **normal**：正常节奏，多角度叙事
- **close-up**：某个角色或某段关系值得慢镜头特写，适合深入内心描写

### 天命建议（destinyHint）
当世界趋于平衡/无聊时，你可以建议注入一个突发事件：
- urgency 1-2：可以再观察几个 tick
- urgency 3：建议下一个 tick 触发
- urgency 4-5：强烈建议立刻触发
- 如果世界正在产生有趣的涌现，destinyHint 为 null——不要干预

## 输出要求
- narrative 数组中至少 5 个元素
- 至少包含 1 个 info_gap 类型（如果存在信息不对称的话）
- tensions 至少 1 个（如果张力存在的话）
- narrative 的顺序就是展示给用户的顺序——要有节奏感`;

// ─── 天命建议系统提示词 ───
const DESTINY_SYSTEM_PROMPT = `你是 Dreamina V2 的「天命设计师」。当世界运转趋于平淡时，你需要设计一个突发事件来打破平衡。

好的天命事件应该：
1. **意外但合理**：能从世界设定中找到因果，但角色无法预料
2. **打破平衡**：改变现有的权力结构或资源分配
3. **制造两难**：让角色面临没有完美解的选择
4. **波及广泛**：影响到多个角色的利益

你必须返回**纯 JSON**（不要 markdown 代码块标记），格式如下：

{
  "name": "事件名称（2-6字，简洁有冲击力）",
  "description": "事件详细描述（50-100字，要有画面感）",
  "urgency": 1到5,
  "affectedNpcs": ["会被影响到的npc_id"],
  "expectedConsequences": ["可能引发的连锁反应1", "连锁反应2"],
  "type": "resource_shock 或 relationship_crisis 或 external_threat 或 internal_betrayal 或 opportunity 或 revelation"
}

事件类型说明：
- **resource_shock**：资源突变（供给中断、新资源出现、分配规则改变）
- **relationship_crisis**：关系危机（秘密被揭露、信任被打破、旧怨爆发）
- **external_threat**：外部威胁（竞争者、自然灾害、上级压力）
- **internal_betrayal**：内部背叛（叛变、泄密、暗中操作）
- **opportunity**：新机会出现（但通常也伴随竞争）
- **revelation**：真相揭露（被隐藏的信息浮出水面）`;

/**
 * Director 类
 */
export class Director {
  /**
   * @param {Object} apiConfig - { apiKey, baseUrl, model }
   * @param {Object} options - 传给 LLMClient 的选项
   */
  constructor(apiConfig, options = {}) {
    this.llm = new LLMClient(apiConfig, options);
  }

  /**
   * 叙事合成 — 每个 tick 后调用
   * @param {Object} worldState - 当前世界状态 { worldConfig, npcs, gameTime, resources }
   * @param {Array} allNpcActions - 所有 NPC 本 tick 的行为 [{ id, act, reg, ... }]
   * @param {Array} allNpcThoughts - 所有 NPC 本 tick 的内心想法 [{ id, th, mood, decisionChain }]
   * @param {Object|null} previousNarrative - 上一 tick 的导演输出（用于连贯性）
   * @returns {Promise<DirectorOutput>}
   */
  async narrate(worldState, allNpcActions, allNpcThoughts, previousNarrative = null) {
    const userPrompt = this._buildNarratePrompt(worldState, allNpcActions, allNpcThoughts, previousNarrative);
    const result = await this.llm.callJSON(NARRATE_SYSTEM_PROMPT, userPrompt);
    return this._validateNarrateOutput(result);
  }

  /**
   * 天命建议 — 当世界趋于平淡时调用
   * @param {Object} worldState - 当前世界状态
   * @param {Array} narrativeHistory - 最近几个 tick 的导演输出
   * @returns {Promise<DestinyEvent>}
   */
  async suggestDestiny(worldState, narrativeHistory = []) {
    const userPrompt = this._buildDestinyPrompt(worldState, narrativeHistory);
    const result = await this.llm.callJSON(DESTINY_SYSTEM_PROMPT, userPrompt);
    return this._validateDestinyOutput(result);
  }

  /**
   * 构建叙事 prompt
   * @private
   */
  _buildNarratePrompt(worldState, allNpcActions, allNpcThoughts, previousNarrative) {
    const { worldConfig, npcs, gameTime } = worldState;
    let prompt = '';

    // 世界与时间
    prompt += `## 世界：${worldConfig.name}\n`;
    prompt += `${worldConfig.description}\n`;
    prompt += `当前时间：第${gameTime?.day ?? 1}天 ${String(gameTime?.hour ?? 10).padStart(2, '0')}:00\n\n`;

    // 地图概况
    prompt += `## 当前地图\n`;
    if (Array.isArray(worldConfig.locations)) {
      for (const loc of worldConfig.locations) {
        const present = npcs.filter(n => n.region === loc.id);
        const names = present.length > 0 ? present.map(n => `${n.emoji}${n.name}`).join('、') : '无人';
        prompt += `${loc.emoji} ${loc.name}：${names}\n`;
      }
    }

    // 所有 NPC 的行为（上帝视角全知）
    prompt += `\n## 本时段所有角色的行为【上帝视角】\n`;
    for (const action of allNpcActions) {
      const npc = npcs.find(n => n.id === action.id);
      if (!npc) continue;
      prompt += `\n### ${npc.emoji} ${npc.name}（${npc.title}）\n`;
      prompt += `- 行为：${action.act || '无'}\n`;
      prompt += `- 移动到：${action.reg || '原地'}\n`;
      if (action.mem) prompt += `- 新记忆：${action.mem}\n`;
    }

    // 所有 NPC 的内心（只有上帝能看到）
    prompt += `\n## 本时段所有角色的内心【绝密·只有上帝能看到】\n`;
    for (const thought of allNpcThoughts) {
      const npc = npcs.find(n => n.id === thought.id);
      if (!npc) continue;
      prompt += `\n### ${npc.emoji} ${npc.name}\n`;
      prompt += `- 情绪：${thought.mood || npc.state?.mood || '未知'}（${thought.mv ?? npc.state?.moodValue ?? '?'}/100）\n`;
      prompt += `- 内心独白：${thought.th || '（无）'}\n`;
      prompt += `- 决策链：${thought.decision_chain || thought.decisionChain || '（无）'}\n`;
    }

    // 关系网全貌（带城府差异）
    prompt += `\n## 关系网全貌【上帝视角·含城府】\n`;
    for (const npc of npcs) {
      if (!npc.relationships || Object.keys(npc.relationships).length === 0) continue;
      prompt += `\n${npc.name}的关系：\n`;
      for (const [tid, rel] of Object.entries(npc.relationships)) {
        const target = npcs.find(n => n.id === tid);
        if (!target) continue;
        const gap = Math.abs((rel.inner || 0) - (rel.outer || 0));
        const cityFox = gap > 20 ? ' ⚠️城府深' : '';
        prompt += `  对${target.name}：内心${rel.inner > 0 ? '+' : ''}${rel.inner} / 表面${rel.outer > 0 ? '+' : ''}${rel.outer}${cityFox} — ${rel.notes}\n`;
      }
    }

    // 对话记录
    if (worldState.talks && Array.isArray(worldState.talks)) {
      prompt += `\n## 本时段的对话记录\n`;
      for (const talk of worldState.talks) {
        const from = npcs.find(n => n.id === talk.f);
        const to = npcs.find(n => n.id === talk.t);
        prompt += `${from?.name || talk.f} → ${to?.name || talk.t}：「${talk.s}」`;
        if (talk.subtext) prompt += `（潜台词：${talk.subtext}）`;
        prompt += '\n';
      }
    }

    // 上一 tick 叙事连贯性
    if (previousNarrative) {
      prompt += `\n## 上一时段的叙事摘要\n`;
      prompt += `${previousNarrative.summary || '（无）'}\n`;
      prompt += `节奏建议：${previousNarrative.pacing || 'normal'}\n`;
      if (previousNarrative.tensions && previousNarrative.tensions.length > 0) {
        prompt += `遗留张力：${previousNarrative.tensions.map(t => `${t.between.join(' vs ')} [${t.level}] ${t.about}`).join('；')}\n`;
      }
    }

    // 张力信息
    if (worldState.tensions && Array.isArray(worldState.tensions)) {
      prompt += `\n## 当前张力\n`;
      for (const t of worldState.tensions) {
        prompt += `- [${t.level}/5] ${t.between.join(' vs ')}：${t.about}\n`;
      }
    }

    prompt += `\n## 导演任务
请基于以上所有信息，以上帝视角输出本时段的叙事编辑。

重点关注：
1. 最有戏剧张力的冲突或暗流
2. 信息不对称——谁不知道什么？
3. 角色的表里不一——说的和想的不一样
4. 关系变化的微妙征兆
5. 整体节奏应该加速还是特写？`;

    return prompt;
  }

  /**
   * 构建天命建议 prompt
   * @private
   */
  _buildDestinyPrompt(worldState, narrativeHistory) {
    const { worldConfig, npcs } = worldState;
    let prompt = '';

    prompt += `## 世界：${worldConfig.name}\n`;
    prompt += `${worldConfig.description}\n\n`;

    // 资源状态
    prompt += `## 资源状况\n`;
    if (worldConfig.resources) {
      for (const [key, res] of Object.entries(worldConfig.resources)) {
        if (res.total) {
          prompt += `- ${res.name}：${res.current}/${res.total}（${res.desc}）\n`;
        } else {
          prompt += `- ${res.name}：${res.desc}\n`;
        }
      }
    }

    // 角色概况
    prompt += `\n## 角色概况\n`;
    for (const npc of npcs) {
      prompt += `- ${npc.emoji} ${npc.name}（${npc.title}）：情绪${npc.state?.mood}，压力${npc.state?.pressure}/100\n`;
    }

    // 预设干预事件（供参考）
    if (worldConfig.interventions && worldConfig.interventions.length > 0) {
      prompt += `\n## 预设干预事件库（可选用或重新设计）\n`;
      for (const ev of worldConfig.interventions) {
        prompt += `- ${ev.emoji || '⚡'} ${ev.name}：${ev.description}\n`;
      }
    }

    // 最近叙事历史
    if (narrativeHistory.length > 0) {
      prompt += `\n## 最近叙事历史（最近${narrativeHistory.length}个时段）\n`;
      for (const nh of narrativeHistory.slice(-5)) {
        prompt += `- ${nh.summary || '（无摘要）'}\n`;
        if (nh.pacing) prompt += `  节奏: ${nh.pacing}\n`;
        if (nh.tensions && nh.tensions.length > 0) {
          prompt += `  张力: ${nh.tensions.map(t => `${t.between.join('vs')}[${t.level}]`).join('、')}\n`;
        }
      }
    }

    // 当前张力
    if (worldState.tensions && worldState.tensions.length > 0) {
      prompt += `\n## 当前张力\n`;
      for (const t of worldState.tensions) {
        prompt += `- [${t.level}/5] ${t.between.join(' vs ')}：${t.about}\n`;
      }
    }

    prompt += `\n## 任务
世界正在趋于平淡或停滞。请设计一个合理的突发事件来打破平衡。
这个事件应该源自世界内部的逻辑，而非凭空出现。`;

    return prompt;
  }

  /**
   * 校验叙事输出
   * @private
   */
  _validateNarrateOutput(raw) {
    return {
      narrative: Array.isArray(raw.narrative) ? raw.narrative.map(item => {
        const base = { type: item.type || 'narration' };
        switch (base.type) {
          case 'narration':
            return { ...base, text: item.text || '', highlight: !!item.highlight };
          case 'dialogue':
            return { ...base, from: item.from || '', to: item.to || null, content: item.content || '', subtext: item.subtext || '' };
          case 'info_gap':
            return { ...base, description: item.description || '', involvedNpcs: Array.isArray(item.involvedNpcs) ? item.involvedNpcs : [] };
          case 'thought':
            return { ...base, npcId: item.npcId || item.npc_id || '', text: item.text || '' };
          default:
            return { type: 'narration', text: item.text || item.description || '', highlight: false };
        }
      }) : [],
      summary: raw.summary || '本时段无重大事件',
      tensions: Array.isArray(raw.tensions) ? raw.tensions.map(t => ({
        between: Array.isArray(t.between) ? t.between : [],
        level: this._clamp(t.level ?? 1, 1, 5),
        about: t.about || '',
      })) : [],
      pacing: ['accelerate', 'normal', 'close-up'].includes(raw.pacing) ? raw.pacing : 'normal',
      destinyHint: raw.destinyHint ? {
        name: raw.destinyHint.name || '未命名事件',
        description: raw.destinyHint.description || '',
        urgency: this._clamp(raw.destinyHint.urgency ?? 3, 1, 5),
      } : null,
    };
  }

  /**
   * 校验天命建议输出
   * @private
   */
  _validateDestinyOutput(raw) {
    const validTypes = ['resource_shock', 'relationship_crisis', 'external_threat', 'internal_betrayal', 'opportunity', 'revelation'];

    return {
      name: raw.name || '突发事件',
      description: raw.description || '',
      urgency: this._clamp(raw.urgency ?? 3, 1, 5),
      affectedNpcs: Array.isArray(raw.affectedNpcs) ? raw.affectedNpcs : [],
      expectedConsequences: Array.isArray(raw.expectedConsequences) ? raw.expectedConsequences : [],
      type: validTypes.includes(raw.type) ? raw.type : 'external_threat',
    };
  }

  /**
   * @private
   */
  _clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }
}
