/**
 * 模拟引擎 - 构建prompt、调用Claude API、解析返回JSON
 */

const SYSTEM_PROMPT = `你是一个世界模拟引擎。你的任务是根据给定的世界观和进化目标，自然推演每个角色这一天的行为。

核心原则：
- 不预设任何规则或剧本，让行为从世界观、角色性格、记忆和关系中自然涌现
- 同一区域的角色可以交互，不同区域的角色无法直接交流
- 角色不知道其他角色的内心想法，只能根据观察到的行为和对话来判断
- 每个角色的行为必须符合其性格特征
- 情绪会影响决策，记忆会影响判断
- 关系变化要有合理原因

你必须只输出纯JSON，不要包含任何markdown代码块标记或其他文字。`;

export function buildPrompt(template, npcs, tick, pendingIntervention) {
  const regionMap = {};
  for (const r of template.regions) {
    regionMap[r.id] = { ...r, presentNPCs: [] };
  }
  for (const npc of npcs) {
    if (regionMap[npc.region]) {
      regionMap[npc.region].presentNPCs.push(`${npc.emoji}${npc.name}`);
    }
  }

  let prompt = `【${template.emoji} ${template.name}】${template.description}\n`;
  prompt += `【进化法则】${template.goal}\n`;
  prompt += `【第${tick}天】\n`;

  if (pendingIntervention) {
    const ev = template.interventions.find((i) => i.id === pendingIntervention);
    if (ev) {
      prompt += `\n⚡ 突发事件「${ev.name}」：${ev.description}\n`;
    }
  }

  prompt += `\n【地图】\n`;
  for (const r of template.regions) {
    const info = regionMap[r.id];
    const who =
      info.presentNPCs.length > 0
        ? info.presentNPCs.join("、")
        : "（无人）";
    prompt += `${r.emoji} ${r.name}：${who}\n`;
  }

  prompt += `\n【角色状态】\n`;
  for (const npc of npcs) {
    const regionName =
      template.regions.find((r) => r.id === npc.region)?.name || "未知";
    prompt += `\n${npc.emoji} ${npc.name}（${npc.id}）\n`;
    prompt += `  位置：${regionName} | 情绪：${npc.mood}（${npc.moodValue}/10）\n`;
    prompt += `  性格：${npc.personality}\n`;

    if (npc.memories && npc.memories.length > 0) {
      prompt += `  最近记忆：\n`;
      for (const m of npc.memories.slice(-5)) {
        prompt += `    - ${m}\n`;
      }
    }

    if (npc.relationships && Object.keys(npc.relationships).length > 0) {
      prompt += `  关系：\n`;
      for (const [tid, rel] of Object.entries(npc.relationships)) {
        const target = npcs.find((n) => n.id === tid);
        if (target) {
          prompt += `    - 对${target.name}：好感${rel.sentiment > 0 ? "+" : ""}${rel.sentiment}（${rel.notes}）\n`;
        }
      }
    }
  }

  prompt += `\n请推演每个角色这一天的行动。同区域角色可交互。角色不知他人内心想法。\n`;
  prompt += `\n返回纯JSON（不要代码块标记），格式：\n`;
  prompt += `{
  "npcs": [
    {
      "id": "n1",
      "act": "具体行为描述（20-40字）",
      "reg": "移动到的区域id，不移动则填当前区域id",
      "th": "内心独白（带性格特色，15-30字）",
      "mood": "情绪词",
      "mv": 7,
      "mem": "值得记住的新记忆（15-25字）或null",
      "rc": [{"t":"n2","d":1,"w":"原因（5-10字）"}]
    }
  ],
  "sum": "这天最重要的事（一句话，15-25字）",
  "talks": [{"f":"n1","t":"n2","s":"对话内容（10-20字）"}]
}`;

  return prompt;
}

export async function callClaude(apiConfig, systemPrompt, userPrompt) {
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
    throw new Error(`服务器错误 (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data.text;
  if (!text) throw new Error("返回内容为空");
  return text;
}

export function parseResponse(text) {
  // 尝试清理可能的markdown代码块
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

export async function simulateTick(apiConfig, template, npcs, tick, pendingIntervention) {
  const userPrompt = buildPrompt(template, npcs, tick, pendingIntervention);
  const rawText = await callClaude(apiConfig, SYSTEM_PROMPT, userPrompt);
  const result = parseResponse(rawText);
  return result;
}

export function applyResult(npcs, result) {
  const updated = npcs.map((npc) => {
    const r = result.npcs?.find((n) => n.id === npc.id);
    if (!r) return npc;

    const newNpc = { ...npc };

    if (r.act) newNpc.action = r.act;
    if (r.reg) newNpc.region = r.reg;
    if (r.th) newNpc.thought = r.th;
    if (r.mood) newNpc.mood = r.mood;
    if (typeof r.mv === "number") newNpc.moodValue = Math.max(0, Math.min(10, r.mv));

    // 追加记忆，最多15条
    if (r.mem) {
      const mems = [...(npc.memories || []), r.mem];
      newNpc.memories = mems.slice(-15);
    } else {
      newNpc.memories = npc.memories || [];
    }

    // 更新关系
    const rels = { ...(npc.relationships || {}) };
    if (r.rc && Array.isArray(r.rc)) {
      for (const change of r.rc) {
        if (!change.t) continue;
        const existing = rels[change.t] || { sentiment: 0, notes: "" };
        rels[change.t] = {
          sentiment: Math.max(-10, Math.min(10, existing.sentiment + (change.d || 0))),
          notes: change.w || existing.notes,
        };
      }
    }
    newNpc.relationships = rels;

    return newNpc;
  });

  return updated;
}
