/**
 * SimulationAdapter — V2 多Agent模拟适配器
 *
 * 桥接 SimulationRuntime（前端） 与 V2 多Agent引擎。
 * 替代 V1 的 simulateTick/applyResult 单次LLM调用方式：
 *   V1: 一次LLM调用模拟所有NPC（上帝视角）
 *   V2: 每个NPC独立LLM调用 + 导演合成叙事（真正的多智能体）
 */

import { LLMClient } from '../agents/LLMClient.js';
import { NPCAgent } from '../agents/NPCAgent.js';
import { Director } from '../agents/Director.js';
import { CognitiveMemory } from '../memory/CognitiveMemory.js';

// ─── 模块级缓存：NPC Agent 实例（跨 tick 保持记忆连续性）───
let _agents = null;       // Map<npcId, NPCAgent>
let _director = null;     // Director
let _llmClient = null;    // LLMClient
let _prevNarrative = null; // 上一 tick 的导演输出

/**
 * 初始化或重置 Agent 实例
 * 在世界首次加载或配置变更时调用
 */
export function initAgents(apiConfig, npcs) {
  _llmClient = new LLMClient(apiConfig, {
    maxRetries: 2,
    retryDelay: 800,
    maxConcurrent: 5,
    timeout: 60000,
  });

  _director = new Director(apiConfig, {
    maxRetries: 2,
    retryDelay: 1000,
    maxConcurrent: 2,
    timeout: 90000,
  });

  _agents = new Map();
  for (const npc of npcs) {
    const memory = new CognitiveMemory(npc.gene || _defaultGene());
    const agent = new NPCAgent(npc, memory, _llmClient);
    _agents.set(npc.id, agent);
  }

  _prevNarrative = null;
}

/**
 * 获取 Agent 实例（用于 UI 面板读取 NPC 状态）
 */
export function getAgent(npcId) {
  return _agents?.get(npcId) ?? null;
}

/**
 * 获取所有 Agent 的当前状态
 */
export function getAllAgentStates() {
  if (!_agents) return [];
  return Array.from(_agents.values()).map(agent => agent.getState());
}

/**
 * V2 版 simulateTick — 多Agent并行决策 + 导演叙事合成
 *
 * @param {object} apiConfig - API配置
 * @param {object} worldConfig - 世界配置
 * @param {Array} npcs - 当前NPC列表（含最新状态）
 * @param {object} gameTime - { day, hour }
 * @param {string|null} intervention - 干预事件ID
 * @returns {Promise<object>} 兼容V1的结果格式 + V2导演叙事
 */
export async function simulateTick(apiConfig, worldConfig, npcs, gameTime, intervention) {
  // 确保 Agent 已初始化
  if (!_agents || _agents.size === 0) {
    initAgents(apiConfig, npcs);
  }

  // 同步最新 NPC 状态到 Agent（处理外部状态更新）
  for (const npc of npcs) {
    const agent = _agents.get(npc.id);
    if (agent) {
      _syncNpcToAgent(agent, npc);
    }
  }

  // ── 1. 构建每个NPC的感知信息 ──
  const perceptions = {};
  for (const npc of npcs) {
    perceptions[npc.id] = _buildPerception(npc, npcs, worldConfig, gameTime, intervention);
  }

  // ── 2. 所有NPC Agent并行思考（每个独立LLM调用）──
  const agentResults = await Promise.all(
    npcs.map(async (npc) => {
      const agent = _agents.get(npc.id);
      if (!agent) return _fallbackResult(npc);
      try {
        return await agent.think(perceptions[npc.id]);
      } catch (e) {
        console.warn(`[V2] NPC ${npc.id} 思考失败:`, e.message);
        return _fallbackResult(npc);
      }
    })
  );

  // ── 3. 收集对话（NPC之间有speech时自动触发对方响应）──
  const talks = [];
  for (const result of agentResults) {
    if (result.speech?.to && result.speech?.content) {
      const fromNpc = npcs.find(n => n.id === result.id);
      const toAgent = _agents.get(result.speech.to);
      if (fromNpc && toAgent) {
        talks.push({
          f: result.id,
          t: result.speech.to,
          s: result.speech.content,
          subtext: result.speech.subtext || '',
        });
        // 触发对方的对话响应（异步但不阻塞主流程）
        try {
          const response = await toAgent.respondToSpeech(
            { id: fromNpc.id, name: fromNpc.name, title: fromNpc.title, mood: result.mood },
            result.speech.content,
            perceptions[result.speech.to]
          );
          if (response?.speech?.content) {
            talks.push({
              f: result.speech.to,
              t: result.id,
              s: response.speech.content,
              subtext: response.speech.subtext || '',
            });
          }
        } catch (e) {
          console.warn(`[V2] 对话响应失败:`, e.message);
        }
      }
    }
  }

  // ── 4. 导演叙事合成（上帝视角）──
  let directorOutput = null;
  try {
    const worldState = {
      worldConfig,
      npcs,
      gameTime,
      talks,
      tensions: _prevNarrative?.tensions || [],
    };

    const allActions = agentResults.map(r => ({
      id: r.id,
      act: r.action,
      reg: r.movement,
      mem: '', // 记忆由Agent内部管理
    }));

    const allThoughts = agentResults.map(r => ({
      id: r.id,
      th: r.thought,
      mood: r.mood,
      mv: r.moodValue,
      decisionChain: r.decisionChain,
    }));

    directorOutput = await _director.narrate(worldState, allActions, allThoughts, _prevNarrative);
    _prevNarrative = directorOutput;
  } catch (e) {
    console.warn('[V2] 导演叙事失败，降级为简单输出:', e.message);
  }

  // ── 5. 组装结果（兼容V1格式 + V2增强）──
  return {
    // V1兼容字段
    npcs: agentResults.map(r => ({
      id: r.id,
      act: r.action,
      reg: r.movement,
      th: r.thought,
      mood: r.mood,
      mv: r.moodValue,
      pressure: r.pressure,
      energy: r.energy,
      decision_chain: r.decisionChain,
      goal_changes: r.goalChanges,
      rc: (r.relationshipChanges || []).map(c => ({
        t: c.target,
        inner_d: c.innerDelta ?? 0,
        outer_d: c.outerDelta ?? 0,
        w: c.reason || '',
      })),
    })),
    talks,
    narrations: directorOutput?.narrative
      ?.filter(n => n.type === 'narration')
      .map(n => n.text) || [],
    sum: directorOutput?.summary || '',
    tensions: directorOutput?.tensions || [],

    // V2增强字段
    director: directorOutput,
  };
}

/**
 * V2 版 applyResult — 将模拟结果应用到 NPC 状态
 * Agent 内部已自动更新状态，这里主要同步到前端 npcs 数组
 */
export function applyResult(npcs, result) {
  return npcs.map((npc) => {
    const r = result.npcs?.find((n) => n.id === npc.id);
    if (!r) return npc;

    const updated = JSON.parse(JSON.stringify(npc));

    // 基本状态
    if (r.act) updated.action = r.act;
    if (r.reg) {
      updated.region = r.reg;
      updated.location = r.reg;
    }
    if (r.th) updated.thought = r.th;
    if (r.mood) updated.state.mood = r.mood;
    if (typeof r.mv === 'number') updated.state.moodValue = _clamp(r.mv, 0, 100);
    if (typeof r.pressure === 'number') updated.state.pressure = _clamp(r.pressure, 0, 100);
    if (typeof r.energy === 'number') updated.state.energy = _clamp(r.energy, 0, 100);

    // 决策链
    if (r.decision_chain) updated.decisionChain = r.decision_chain;

    // 关系更新
    if (r.rc && Array.isArray(r.rc)) {
      for (const change of r.rc) {
        if (!change.t) continue;
        const existing = updated.relationships?.[change.t] || { inner: 0, outer: 0, notes: '' };
        if (!updated.relationships) updated.relationships = {};
        updated.relationships[change.t] = {
          inner: _clamp(existing.inner + (change.inner_d || 0), -100, 100),
          outer: _clamp(existing.outer + (change.outer_d || 0), -100, 100),
          notes: change.w || existing.notes,
        };
      }
    }

    // 目标满足度
    if (r.goal_changes) {
      for (const [goalName, delta] of Object.entries(r.goal_changes)) {
        if (updated.goals?.[goalName]) {
          updated.goals[goalName].satisfaction = _clamp(
            updated.goals[goalName].satisfaction + delta, 0, 100
          );
        }
      }
    }

    return updated;
  });
}

/**
 * 重置所有Agent（切换世界时调用）
 */
export function resetAgents() {
  _agents = null;
  _director = null;
  _llmClient = null;
  _prevNarrative = null;
}

// ─── 内部工具函数 ───

function _clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 为NPC构建感知信息
 * 关键：信息隔离——每个NPC只能看到自己能看到的
 */
function _buildPerception(npc, allNpcs, worldConfig, gameTime, intervention) {
  const myLocation = npc.location || npc.region || 'default';

  // 同地点的其他NPC（只有外在信息，没有内心想法）
  const presentNpcs = allNpcs
    .filter(n => n.id !== npc.id && (n.location || n.region || 'default') === myLocation)
    .map(n => ({
      id: n.id,
      name: n.name,
      title: n.title,
      action: n.action || '在这里',
      mood: n.state?.mood || '正常',
    }));

  // 可去的地点
  const availableLocations = (worldConfig.locations || []).map(loc => ({
    id: loc.id,
    name: loc.name,
  }));

  // 世界事件（干预）
  let worldEvent = null;
  if (intervention) {
    const ev = worldConfig.interventions?.find(i => i.id === intervention);
    if (ev) worldEvent = `${ev.name}: ${ev.description}`;
  }

  // 世界规则
  const worldRules = worldConfig.rules || [];

  // 当前地点名称
  const locationData = worldConfig.locations?.find(l => l.id === myLocation);
  const locationName = locationData?.name || myLocation;

  return {
    currentTime: gameTime,
    location: myLocation,
    locationName,
    presentNpcs,
    recentSpeechToMe: [], // 由通信总线填充（当前简化：依赖Agent内部对话机制）
    worldEvent,
    worldRules,
    availableLocations,
  };
}

/**
 * 同步前端NPC数据到Agent实例
 */
function _syncNpcToAgent(agent, npc) {
  // 只同步可能被外部更新的字段
  agent.data.region = npc.region || npc.location;
  agent.data.location = npc.location || npc.region;
  if (npc.state) {
    agent.data.state = { ...agent.data.state, ...npc.state };
  }
  if (npc.relationships) {
    agent.data.relationships = npc.relationships;
  }
  if (npc.goals) {
    agent.data.goals = npc.goals;
  }
}

/**
 * NPC Agent调用失败时的降级结果
 */
function _fallbackResult(npc) {
  return {
    id: npc.id,
    action: `${npc.name}继续日常活动`,
    movement: null,
    speech: null,
    thought: '...',
    mood: npc.state?.mood || '平静',
    moodValue: npc.state?.moodValue ?? 50,
    pressure: npc.state?.pressure ?? 30,
    energy: Math.max((npc.state?.energy ?? 70) - 5, 0),
    decisionChain: '降级：默认行为',
    goalChanges: {},
    relationshipChanges: [],
  };
}

/**
 * 默认基因（当NPC没有基因数据时使用）
 */
function _defaultGene() {
  return {
    core_drives: { 生存: 0.7, 社交: 0.5, 成就: 0.5 },
    cognitive_style: { '理性vs感性': 0.5, 风险偏好: 0.5, '长期vs短期': 0.5, '个体vs集体': 0.5 },
    talent_genes: { 逻辑天赋: 0.5, 共情天赋: 0.5, 表达天赋: 0.5 },
    emotional_baseline: { 焦虑倾向: 0.3, 乐观倾向: 0.5, 韧性: 0.5, 敏感度: 0.5 },
  };
}
