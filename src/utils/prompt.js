export function buildSystemPrompt() {
  return `你是一个世界模拟引擎。你的任务是根据给定的世界观和进化目标，自然推演每个角色在这一天的行为。

核心原则：
1. 不预设任何行为规则，让角色的行为从世界观、性格、记忆和关系中自然涌现
2. 角色不知道其他角色的内心想法，只能基于观察到的行为和对话做判断
3. 同一区域的角色可以互动，不同区域的角色这一天不会交互
4. 角色的行动要符合其性格特征，内心独白要有个人特色
5. 关系变化要有合理的原因，不要无缘无故地大幅度变化
6. 每天世界应该有有趣的事件发生，让故事推进

你必须且只能输出纯JSON，不要包含markdown代码块标记，不要有任何其他文本。`
}

export function buildTickPrompt(template, npcs, tick, pendingIntervention) {
  const regionMap = {}
  for (const r of template.regions) {
    regionMap[r.id] = { ...r, npcsHere: [] }
  }
  for (const npc of npcs) {
    if (regionMap[npc.region]) {
      regionMap[npc.region].npcsHere.push(npc.name)
    }
  }

  let prompt = `【${template.name}】${template.description}\n`
  prompt += `【进化法则】${template.goal}\n`
  prompt += `【第${tick}天】\n`

  if (pendingIntervention) {
    prompt += `⚡突发事件：${pendingIntervention}\n`
  }

  prompt += `\n【地图】\n`
  for (const r of template.regions) {
    const rm = regionMap[r.id]
    const who = rm.npcsHere.length > 0 ? rm.npcsHere.join('、') : '无人'
    prompt += `${r.emoji} ${r.name}（${r.id}）：${who}\n`
  }

  prompt += `\n【角色状态】\n`
  for (const npc of npcs) {
    const region = template.regions.find(r => r.id === npc.region)
    prompt += `\n${npc.emoji} ${npc.name}（${npc.id}）\n`
    prompt += `  位置：${region ? region.name : '未知'}\n`
    prompt += `  情绪：${npc.mood}（${npc.moodValue}/10）\n`
    prompt += `  性格：${npc.personality}\n`

    if (npc.memories && npc.memories.length > 0) {
      prompt += `  近期记忆：\n`
      for (const mem of npc.memories.slice(-5)) {
        prompt += `    - ${mem}\n`
      }
    }

    if (npc.relationships && Object.keys(npc.relationships).length > 0) {
      prompt += `  关系：\n`
      for (const [targetId, rel] of Object.entries(npc.relationships)) {
        const target = npcs.find(n => n.id === targetId)
        if (target) {
          prompt += `    - 对${target.name}：好感${rel.sentiment > 0 ? '+' : ''}${rel.sentiment}，${rel.notes}\n`
        }
      }
    }
  }

  prompt += `\n推演每个角色这一天的行动。同区域角色可以交互，角色不知他人内心想法。让行为从世界观和角色性格中自然涌现。

返回JSON格式：
{
  "npcs": [
    {
      "id": "角色id",
      "act": "这一天的具体行为描述（20-40字）",
      "reg": "移动到的新区域id（如不移动则填当前区域id）",
      "th": "内心独白（要有角色的性格特色，15-30字）",
      "mood": "情绪词（2-3个字）",
      "mv": 情绪值0到10的整数,
      "mem": "值得记住的新记忆（10-20字）或null",
      "rc": [{"t":"目标角色id","d":好感度变化整数,"w":"原因（5-10字）"}]
    }
  ],
  "sum": "这天最重要的事（一句话，15-25字）",
  "talks": [{"f":"说话者id","t":"听话者id","s":"对话内容（10-25字）"}]
}`

  return prompt
}
