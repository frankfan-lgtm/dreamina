/**
 * 像素办公室 — 模拟引擎
 * 基因驱动的prompt系统 + 目标/状态/双层关系
 */

const SYSTEM_PROMPT = `你是「像素办公室」的世界模拟引擎。你的核心任务是根据每个NPC的基因（灵魂底色）、目标、记忆、技能、状态和人际关系，推演他们在当前时刻的行为。

## 核心哲学
不预设剧情。一切行为从两个条件涌现：
1. 每个NPC都有自己的目标（由基因决定权重）
2. 资源永远不够分（HC、晋升名额、好项目、领导注意力）

NPC的行为 = 基因倾向 × 当前目标优先级 × 记忆经验 × 人际关系 × 当前状态

## 决策链
感知环境 → 检索相关记忆 → 基因倾向评估 → 选择策略 → 输出行动

## 关键规则
- 同一地点的NPC可以交互，不同地点不能
- NPC不知道其他NPC的内心想法，只能观察外在行为
- 内心真实态度和外在表现可以不一致（城府）
- 情绪和压力会影响决策质量——压力>80时决策可能偏激
- 基因决定行为倾向，但不直接决定行为
- 重大事件可能触发基因微调（突变），幅度±0.05~0.15

你必须只输出纯JSON，不要包含任何markdown代码块标记或其他文字。`;

/**
 * 构建包含完整NPC数据的prompt
 */
export function buildPrompt(world, npcs, gameTime, intervention) {
  let prompt = "";

  // 世界背景
  prompt += `【${world.name}】${world.description}\n`;
  prompt += `【当前时间】第${gameTime.day}天 ${String(gameTime.hour).padStart(2, "0")}:00\n`;

  // 资源状态
  prompt += `\n【有限资源——一切冲突的根源】\n`;
  for (const [key, res] of Object.entries(world.resources)) {
    if (res.total) {
      prompt += `- ${res.name}：${res.current}/${res.total}（${res.desc}）\n`;
    } else {
      prompt += `- ${res.name}：${res.desc}\n`;
    }
  }

  // 世界规则
  prompt += `\n【世界规则】\n`;
  for (const rule of world.rules) {
    prompt += `- ${rule}\n`;
  }

  // 突发事件
  if (intervention) {
    const ev = world.interventions.find((i) => i.id === intervention);
    if (ev) {
      prompt += `\n⚡【突发事件】「${ev.name}」：${ev.description}\n`;
      prompt += `所有NPC都会感知到这个事件并根据自身基因和处境做出反应。\n`;
    }
  }

  // 地图：谁在哪
  prompt += `\n【当前地图——同地点的人可以交互】\n`;
  for (const loc of world.locations) {
    const present = npcs.filter((n) => n.region === loc.id);
    const names = present.length > 0 ? present.map((n) => n.name).join("、") : "无人";
    prompt += `${loc.emoji} ${loc.name}：${names}\n`;
  }

  // 每个NPC的完整状态
  prompt += `\n【角色详细状态】\n`;
  for (const npc of npcs) {
    prompt += `\n━━━ ${npc.emoji} ${npc.name}（${npc.id}）| ${npc.title} | ${npc.age}岁 ━━━\n`;
    prompt += `📍 位置：${world.locations.find((l) => l.id === npc.region)?.name || "未知"}\n`;
    prompt += `🎭 背景：${npc.background}\n`;

    // 基因摘要（最核心的驱力）
    const drives = npc.gene.core_drives;
    const topDrives = Object.entries(drives).sort((a, b) => b[1] - a[1]).slice(0, 3);
    prompt += `🧬 基因核心驱力：${topDrives.map(([k, v]) => `${k}(${v})`).join("、")}\n`;

    const cog = npc.gene.cognitive_style;
    prompt += `🧠 认知风格：理性${cog["理性vs感性"]>0.5?"偏强":"偏弱"} | 风险偏好${cog.风险偏好>0.5?"高":"低"} | ${cog["个体vs集体"]>0.5?"个体主义":"集体主义"}\n`;

    const talents = npc.gene.talent_genes;
    const topTalents = Object.entries(talents).sort((a, b) => b[1] - a[1]).slice(0, 3);
    prompt += `💎 天赋上限：${topTalents.map(([k, v]) => `${k}(${v})`).join("、")}\n`;

    const emo = npc.gene.emotional_baseline;
    prompt += `💗 情绪基线：焦虑${emo.焦虑倾向} | 乐观${emo.乐观倾向} | 韧性${emo.韧性} | 敏感度${emo.敏感度}\n`;

    // 性格行为倾向
    const tend = npc.personality.tendencies;
    prompt += `🎭 行为倾向：${Object.entries(tend).map(([k, v]) => `${k}→${v}`).join("；")}\n`;

    // 技能
    const skillStr = Object.entries(npc.skills).map(([k, v]) => `${k}${v}`).join(" ");
    prompt += `⚡ 技能：${skillStr}\n`;

    // 当前状态
    const st = npc.state;
    prompt += `📊 状态：情绪${st.moodValue}/100(${st.mood}) | 压力${st.pressure}/100 | 精力${st.energy}/100 | 薪资${st.salary} | 绩效${st.performance || "待定"}\n`;

    // 目标优先级
    prompt += `🎯 目标（按优先级）：\n`;
    const sortedGoals = Object.entries(npc.goals).sort((a, b) => b[1].priority - a[1].priority);
    for (const [name, goal] of sortedGoals) {
      const bar = "█".repeat(Math.floor(goal.satisfaction / 10)) + "░".repeat(10 - Math.floor(goal.satisfaction / 10));
      prompt += `   ${goal.priority >= 4 ? "❗" : "  "} ${name}(优先${goal.priority})：${bar} ${goal.satisfaction}% — ${goal.desc}\n`;
    }

    // 记忆
    if (npc.memories) {
      if (npc.memories.long && npc.memories.long.length > 0) {
        prompt += `📚 长期记忆：${npc.memories.long.join("；")}\n`;
      }
      if (npc.memories.medium && npc.memories.medium.length > 0) {
        prompt += `📝 中期记忆：${npc.memories.medium.slice(-3).join("；")}\n`;
      }
      if (npc.memories.short && npc.memories.short.length > 0) {
        prompt += `💭 短期记忆：${npc.memories.short.slice(-3).join("；")}\n`;
      }
    }

    // 关系网（双层）
    if (npc.relationships && Object.keys(npc.relationships).length > 0) {
      prompt += `🤝 关系网（内心真实→外在表现）：\n`;
      for (const [tid, rel] of Object.entries(npc.relationships)) {
        const target = npcs.find((n) => n.id === tid);
        if (target) {
          const gap = Math.abs(rel.inner - rel.outer);
          const fake = gap > 20 ? "（城府深）" : "";
          prompt += `   对${target.name}：内心${rel.inner>0?"+":""}${rel.inner} / 表面${rel.outer>0?"+":""}${rel.outer} ${fake}— ${rel.notes}\n`;
        }
      }
    }
  }

  // 输出格式
  prompt += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
  prompt += `请根据以上所有信息，推演这个时间段每个NPC的行为。\n`;
  prompt += `\n决策时请考虑：\n`;
  prompt += `1. 基因驱力决定"想要什么"（权力欲望高→争表现，安全感需求高→求稳）\n`;
  prompt += `2. 当前状态决定"能做什么"（精力低→效率低，压力高→决策偏激）\n`;
  prompt += `3. 记忆决定"有什么经验"（被骗过→更警惕）\n`;
  prompt += `4. 关系决定"和谁合作/对抗"（内心态度vs外在表现可以不同）\n`;
  prompt += `5. 技能决定"怎么做"（沟通低→话说不好，向上管理高→会汇报）\n`;
  prompt += `6. 同区域的NPC才能交互，可以产生对话\n`;
  prompt += `\n返回纯JSON（不要代码块标记），格式：\n`;
  prompt += `{
  "npcs": [
    {
      "id": "zhangwei",
      "act": "具体行为描述（20-50字，要体现基因和性格特征）",
      "reg": "移动到的区域id",
      "th": "内心独白（带性格和基因特色，20-40字，要能看出基因驱力）",
      "mood": "情绪词",
      "mv": 60,
      "pressure": 70,
      "energy": 48,
      "mem": "值得记住的新记忆（15-30字）或null",
      "mem_level": "short或medium或long",
      "rc": [{"t":"linting","inner_d":0,"outer_d":1,"w":"原因（5-15字）"}],
      "goal_changes": {"地位": 5},
      "decision_chain": "感知→记忆→基因→行动 的简要推理链（30-60字）"
    }
  ],
  "sum": "这个时间段最重要的事（一句话，20-40字）",
  "talks": [{"f":"zhangwei","t":"linting","s":"对话内容（10-25字）","subtext":"潜台词/真实意图（10-20字）"}],
  "tensions": [{"between":["zhangwei","linting"],"level":3,"about":"原因"}],
  "mutation": null
}`;

  return prompt;
}

/**
 * 调用 API
 */
export async function callAPI(apiConfig, systemPrompt, userPrompt) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt,
      userPrompt,
      apiKey: apiConfig.apiKey,
      baseUrl: apiConfig.baseUrl,
      model: apiConfig.model,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API错误 (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data.text) throw new Error("返回内容为空");
  return data.text;
}

/**
 * 解析 JSON 响应
 */
export function parseResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

/**
 * 执行一个 tick 的模拟
 */
export async function simulateTick(apiConfig, world, npcs, gameTime, intervention) {
  const userPrompt = buildPrompt(world, npcs, gameTime, intervention);
  const rawText = await callAPI(apiConfig, SYSTEM_PROMPT, userPrompt);
  return parseResponse(rawText);
}

/**
 * 将模拟结果应用到NPC状态上
 */
export function applyResult(npcs, result) {
  return npcs.map((npc) => {
    const r = result.npcs?.find((n) => n.id === npc.id);
    if (!r) return npc;

    const updated = JSON.parse(JSON.stringify(npc)); // deep clone

    // 基本状态
    if (r.act) updated.action = r.act;
    if (r.reg) updated.region = r.reg;
    if (r.th) updated.thought = r.th;
    if (r.mood) updated.state.mood = r.mood;
    if (typeof r.mv === "number") updated.state.moodValue = clamp(r.mv, 0, 100);
    if (typeof r.pressure === "number") updated.state.pressure = clamp(r.pressure, 0, 100);
    if (typeof r.energy === "number") updated.state.energy = clamp(r.energy, 0, 100);

    // 决策链
    if (r.decision_chain) updated.decisionChain = r.decision_chain;

    // 记忆系统
    if (r.mem) {
      const level = r.mem_level || "short";
      if (!updated.memories[level]) updated.memories[level] = [];
      updated.memories[level].push(r.mem);
      // 限制记忆数量
      if (level === "short") updated.memories.short = updated.memories.short.slice(-8);
      if (level === "medium") updated.memories.medium = updated.memories.medium.slice(-10);
      if (level === "long") updated.memories.long = updated.memories.long.slice(-15);
    }

    // 关系更新（双层）
    if (r.rc && Array.isArray(r.rc)) {
      for (const change of r.rc) {
        if (!change.t) continue;
        const existing = updated.relationships[change.t] || { inner: 0, outer: 0, notes: "" };
        updated.relationships[change.t] = {
          inner: clamp(existing.inner + (change.inner_d || 0), -100, 100),
          outer: clamp(existing.outer + (change.outer_d || 0), -100, 100),
          notes: change.w || existing.notes,
        };
      }
    }

    // 目标满足度变化
    if (r.goal_changes) {
      for (const [goalName, delta] of Object.entries(r.goal_changes)) {
        if (updated.goals[goalName]) {
          updated.goals[goalName].satisfaction = clamp(
            updated.goals[goalName].satisfaction + delta, 0, 100
          );
        }
      }
    }

    return updated;
  });
}

/**
 * 应用基因突变
 */
export function applyMutation(npc, mutation) {
  if (!mutation || !mutation.npc_id || mutation.npc_id !== npc.id) return npc;

  const updated = JSON.parse(JSON.stringify(npc));
  const { dimension, trait, old_value, new_value, reason } = mutation;

  if (updated.gene[dimension] && typeof updated.gene[dimension][trait] === "number") {
    updated.gene[dimension][trait] = clamp(new_value, 0, 1);
    updated.gene.mutation_log.push({
      tick: mutation.tick,
      dimension,
      trait,
      from: old_value,
      to: new_value,
      reason,
    });
  }

  return updated;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
