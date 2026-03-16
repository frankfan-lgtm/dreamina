/**
 * WorldAnalyst — 世界分析师 Agent
 * 输入用户的一句话描述，调用 LLM 分析出世界类型、感知模式、复杂度等
 * 输出 WorldAnalysis 对象，供 WorldArchitect 使用
 */

import { LLMClient } from './LLMClient.js';

// ─── 系统提示词 ───
const SYSTEM_PROMPT = `你是 Dreamina V2 的「世界分析师」。

你的角色：用户描述了一个想要模拟的世界，你需要深入分析这个描述，为世界构建提供精准的蓝图。

你必须返回**纯 JSON**（不要 markdown 代码块标记）。
**重要**：所有字符串值必须用双引号包裹，数字值不加引号。不要输出裸文本值。

格式如下：

{
  "type": "narrative 或 prediction 或 hybrid",
  "perception": "virtual 或 realworld 或 hybrid",
  "complexity": {
    "suggestedNpcCount": 数字(3-20之间),
    "reasoning": "为什么建议这个数量（30-60字）"
  },
  "suggestedResources": [
    { "id": "resource_id", "name": "资源名称", "total": 数字或null, "current": 数字或null, "desc": "描述" }
  ],
  "keyConflicts": [
    { "description": "冲突描述（20-40字）", "involvedRoles": ["角色类型1", "角色类型2"], "intensity": 1到5 }
  ],
  "worldName": "世界名称（简洁有力，2-8字）",
  "worldDescription": "世界描述（50-100字，要有画面感和氛围）",
  "narrativeStyle": "小说风 或 分析报告风 或 纪实风",
  "suggestedLocations": [
    { "id": "location_id", "name": "地点名称", "desc": "描述（15-30字）" }
  ],
  "suggestedRules": ["规则1", "规则2"],
  "suggestedInterventions": [
    { "id": "event_id", "name": "事件名称", "description": "事件描述（20-50字）" }
  ],
  "era": "时代背景",
  "tone": "基调（如：紧张、温馨、荒诞、史诗等）"
}

## 分析原则

### type 世界类型判断
- **narrative**（叙事型）：重点是人物关系和故事发展。如：哈利波特后传、办公室政治、宫廷剧
- **prediction**（预测型）：重点是多方博弈和结果推演。如：股票市场、球赛预测、选举模拟
- **hybrid**（混合）：既有故事也有预测。如：商战（有人物故事也有市场博弈）

### perception 感知模式
- **virtual**：纯虚构世界，NPC 只感知世界内部信息。如：奇幻、科幻、历史架空
- **realworld**：基于现实，NPC 可获取真实世界信息。如：股票分析、体育预测
- **hybrid**：虚构世界观 + 真实信息。如：流浪地球（虚构+真实物理）

### complexity 复杂度
- 简单故事 3-5 个 NPC
- 中等复杂 6-10 个 NPC
- 群像剧/复杂博弈 11-20 个 NPC
- 考虑用户描述中提到的具体人物数量

### narrativeStyle 叙事风格
- **小说风**：叙事型世界默认，注重人物内心、对话张力
- **分析报告风**：预测型世界默认，注重数据、逻辑推理
- **纪实风**：混合型或真实事件类，客观冷静的白描

### suggestedResources 资源设计
资源是冲突的根源。好的资源设计应该：
- 稀缺：不够分才会有冲突
- 可争夺：多方都想要
- 有意义：影响角色的核心利益
每个世界建议 3-6 种关键资源

### keyConflicts 关键冲突点
预测这个世界中最可能产生的冲突：
- 资源争夺型：谁得到有限的机会？
- 目标冲突型：不同角色的目标互相矛盾
- 价值观冲突：做正确的事 vs 做有利的事
- 信息不对称：有人知道真相，有人被蒙在鼓里`;

/**
 * WorldAnalyst 类
 */
export class WorldAnalyst {
  /**
   * @param {Object} apiConfig - { apiKey, baseUrl, model }
   * @param {Object} options - 传给 LLMClient 的选项
   */
  constructor(apiConfig, options = {}) {
    this.llm = new LLMClient(apiConfig, options);
  }

  /**
   * 分析用户描述，返回 WorldAnalysis 对象
   * @param {string} userDescription - 用户的一句话描述
   * @returns {Promise<WorldAnalysis>}
   */
  async analyze(userDescription) {
    if (!userDescription || typeof userDescription !== 'string' || !userDescription.trim()) {
      throw new Error('请提供一句话描述你想模拟的世界');
    }

    const userPrompt = `用户想模拟的世界：

"${userDescription.trim()}"

请分析这段描述，输出完整的世界分析 JSON。`;

    const result = await this.llm.callJSON(SYSTEM_PROMPT, userPrompt);

    // 校验并填充默认值
    return this._validate(result);
  }

  /**
   * 校验并补全分析结果
   * @private
   */
  _validate(raw) {
    const validTypes = ['narrative', 'prediction', 'hybrid'];
    const validPerceptions = ['virtual', 'realworld', 'hybrid'];
    const validStyles = ['小说风', '分析报告风', '纪实风'];

    return {
      type: validTypes.includes(raw.type) ? raw.type : 'narrative',
      perception: validPerceptions.includes(raw.perception) ? raw.perception : 'virtual',
      complexity: {
        suggestedNpcCount: this._clamp(raw.complexity?.suggestedNpcCount ?? 7, 3, 20),
        reasoning: raw.complexity?.reasoning || '根据世界复杂度自动推荐',
      },
      suggestedResources: Array.isArray(raw.suggestedResources) ? raw.suggestedResources : [],
      keyConflicts: Array.isArray(raw.keyConflicts) ? raw.keyConflicts.map(c => ({
        description: c.description || '',
        involvedRoles: Array.isArray(c.involvedRoles) ? c.involvedRoles : [],
        intensity: this._clamp(c.intensity ?? 3, 1, 5),
      })) : [],
      worldName: raw.worldName || '未命名世界',
      worldDescription: raw.worldDescription || '',
      narrativeStyle: validStyles.includes(raw.narrativeStyle) ? raw.narrativeStyle : '小说风',
      suggestedLocations: Array.isArray(raw.suggestedLocations) ? raw.suggestedLocations : [],
      suggestedRules: Array.isArray(raw.suggestedRules) ? raw.suggestedRules : [],
      suggestedInterventions: Array.isArray(raw.suggestedInterventions) ? raw.suggestedInterventions : [],
      era: raw.era || '当代',
      tone: raw.tone || '自然',
    };
  }

  /**
   * @private
   */
  _clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }
}
