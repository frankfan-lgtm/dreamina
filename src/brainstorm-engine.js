/**
 * 创意脑爆引擎 — 多Agent协作创意生成
 *
 * 核心流程：
 * 1. 生成/接收脑爆角色人设
 * 2. 多Agent多轮讨论（动态收敛）
 * 3. 支持生图工具调用
 * 4. 主持人判断收敛 → 输出最终方案
 */

const MAX_ROUNDS = 15;

// ─── LLM 调用基础设施（复用现有 /api/claude） ───

async function fetchLLM(apiConfig, systemPrompt, messages, modelOverride) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt,
      messages,
      apiKey: apiConfig.apiKey,
      baseUrl: apiConfig.baseUrl,
      model: modelOverride || apiConfig.model,
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

async function fetchImage(apiConfig, prompt) {
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      apiKey: apiConfig.apiKey,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`图片生成失败 (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data.url) throw new Error("图片API返回为空");
  return data.url;
}

// VLM 调用 — 用 Doubao-Seed-2.0-lite 理解图片
// 图片通过 /api/vlm 端点在服务端处理，避免 base64 数据通过客户端传输超过 body 限制
async function fetchVLM(apiConfig, systemPrompt, textContent, imageUrl) {
  const res = await fetch("/api/vlm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt,
      textContent,
      imageUrl,
      apiKey: apiConfig.apiKey,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`VLM错误 (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data.text) throw new Error("VLM返回内容为空");
  return data.text;
}

function parseJSON(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const start = cleaned.indexOf("{");
    if (start >= 0) cleaned = cleaned.slice(start);
  }
  if (!cleaned.endsWith("}") && !cleaned.endsWith("]")) {
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (end >= 0) cleaned = cleaned.slice(0, end + 1);
  }
  return JSON.parse(cleaned);
}

// ─── 1. 生成脑爆角色（基因驱动人设系统） ───

export async function generatePersonas(intent, apiConfig) {
  const systemPrompt = `你是一个创意团队组建专家。根据用户的创作意图，设计3个最适合进行创意脑爆的角色。

每个角色都有独立的"性格基因"，决定了他们的思维方式、擅长领域和行为倾向。
3个角色必须在认知风格上形成对立轴——比如一个极度理性 vs 一个极度感性，一个冒险激进 vs 一个务实保守。

输出严格JSON格式：
{
  "personas": [
    {
      "name": "角色名（2-4字，有个性）",
      "emoji": "一个代表性emoji",
      "role": "角色定位（如：资深导演/用户心理学家/鬼才段子手）",
      "gene": {
        "core_drives": {
          "好奇心": 0.0-1.0,
          "权力欲望": 0.0-1.0,
          "社交需求": 0.0-1.0,
          "安全感需求": 0.0-1.0
        },
        "cognitive_style": {
          "理性vs感性": 0.0-1.0,
          "风险偏好": 0.0-1.0,
          "个体vs集体": 0.0-1.0
        }
      },
      "belief": "这个角色不可妥协的信念底线（一句话，15字内，如'真实感大于一切包装'）",
      "skills": {
        "技能名1": 1-10,
        "技能名2": 1-10,
        "技能名3": 1-10,
        "技能名4": 1-10
      },
      "tendencies": {
        "面对冲突": "这个角色面对意见分歧时的典型反应（15字内）",
        "面对合作": "这个角色面对需要协作时的典型反应（15字内）"
      }
    }
  ]
}

要求：
- skills 必须有4个，每人至少1项≥8（强项）和1项≤4（短板），且3人的强项和短板要错开
- 3个角色的 cognitive_style 数值要拉开差距（至少有一对在同一维度上差值≥0.5）
- belief 要具体、有棱角，不要"追求完美"这种空话
- tendencies 要有性格，不要"认真讨论"这种废话
- 角色设定要贴合用户的创作领域
- 不要太泛泛（如"创意人"），要具体有趣`;

  const userPrompt = `创作意图：${intent}`;
  const raw = await fetchLLM(apiConfig, systemPrompt, [{ role: "user", content: userPrompt }]);
  const result = parseJSON(raw);
  return result.personas;
}

// ─── 2. 单Agent baseline ───

export async function singleAgentCreate(intent, apiConfig, onStream) {
  const systemPrompt = `你是一个顶尖的创意策划专家。请针对用户的创作意图，给出一个完整、详细、有吸引力的创意方案。

要求：
- 方案要具体可执行，不要停留在概念层面
- 包含核心创意点、具体内容描述、亮点分析
- 如果涉及视觉内容，详细描述画面
- 用生动有感染力的语言表达`;

  const userPrompt = `创作意图：${intent}\n\n请给出你最好的创意方案。`;

  if (onStream) onStream({ type: "start" });
  const result = await fetchLLM(apiConfig, systemPrompt, [{ role: "user", content: userPrompt }]);
  if (onStream) onStream({ type: "done", content: result });
  return result;
}

// ─── 3. 多Agent脑爆核心（基因驱动） ───

function buildAgentSystemPrompt(persona, intent, allPersonas) {
  // 构建自身基因摘要
  const gene = persona.gene || {};
  const drives = gene.core_drives || {};
  const cog = gene.cognitive_style || {};

  const topDrives = Object.entries(drives).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const drivesStr = topDrives.map(([k, v]) => `${k}(${v})`).join("、");

  const cogStr = [
    `${cog["理性vs感性"] > 0.5 ? "理性偏强" : "感性偏强"}(${cog["理性vs感性"]})`,
    `风险偏好${cog["风险偏好"] > 0.5 ? "高" : "低"}(${cog["风险偏好"]})`,
    `${cog["个体vs集体"] > 0.5 ? "个体主义" : "集体主义"}(${cog["个体vs集体"]})`,
  ].join(" | ");

  const skills = persona.skills || {};
  const skillStr = Object.entries(skills).map(([k, v]) => `${k}(${v})`).join("、");

  const tendencies = persona.tendencies || {};
  const tendStr = Object.entries(tendencies).map(([k, v]) => `${k}→${v}`).join("；");

  // 构建伙伴描述（含对方强项和信念，便于有针对性地讨论）
  const othersDesc = allPersonas
    .filter(p => p.name !== persona.name)
    .map(p => {
      const otherSkills = p.skills ? Object.entries(p.skills).filter(([, v]) => v >= 7).map(([k]) => k).join("/") : "";
      return `${p.emoji} ${p.name}（${p.role}）— 擅长${otherSkills}，信念：${p.belief || "未知"}`;
    })
    .join("\n");

  return `你是「${persona.name}」，一位${persona.role}。

## 你的性格基因
🧬 核心驱力：${drivesStr}
🧠 认知风格：${cogStr}
⚡ 技能：${skillStr}
🎭 行为倾向：${tendStr}

## 你的信念底线
🔥 ${persona.belief || "无"}
当别人的提议违背你的信念时，你必须明确反对并给出理由。这是你的底线，不可退让。

## 创作意图
${intent}

## 脑爆伙伴
${othersDesc}

## 你是谁决定了你怎么说话
- 你的发言完全由你的基因、技能和信念驱动
- 在你擅长的领域（技能值≥7），你要自信地坚持专业判断，用具体理由说服别人
- 在你不擅长的领域（技能值≤4），你可以让步，但要诚实说"这块我不太懂，但我觉得..."
- 不要没有理由地附和别人。如果你真的觉得好，说好在哪里；如果觉得有问题，直接说哪里不行
- 可以请求生成概念图来可视化你的创意想法
- 用你性格基因里的方式说话——感性的人用感性的方式，理性的人摆逻辑和数据

## 输出格式（严格JSON）
{
  "message": "你的发言内容（自然语言，有个性，要体现你的基因特质）",
  "imageRequest": null 或 "需要生成的图片描述（英文，用于AI生图，80词内。描述视觉元素、风格、构图、色调）"
}

注意：imageRequest 只在你觉得需要用图片来表达/验证创意时才填，不是每次都需要。`;
}

/**
 * 执行一轮脑爆 — 所有agent依次发言
 * @param {string} intent - 创作意图
 * @param {Array} personas - 角色列表
 * @param {Array} history - 历史对话 [{agent, message, imageUrl?}]
 * @param {object} apiConfig
 * @param {function} onMessage - 每条消息的回调
 * @returns {Array} 本轮所有消息
 */
export async function brainstormRound(intent, personas, history, apiConfig, onMessage) {
  const roundMessages = [];

  for (const persona of personas) {
    // 构建对话历史
    const chatMessages = [];

    // 将所有历史 + 本轮已发言的消息合并为对话格式
    // 用单条 user 消息包含所有其他人发言，避免连续同角色消息违反API规范
    const allMsgs = [...history, ...roundMessages];
    let pendingOthers = [];

    const flushOthers = () => {
      if (pendingOthers.length > 0) {
        chatMessages.push({ role: "user", content: pendingOthers.join("\n\n") });
        pendingOthers = [];
      }
    };

    for (const msg of allMsgs) {
      if (msg.agent === persona.name) {
        flushOthers();
        chatMessages.push({
          role: "assistant",
          content: JSON.stringify({ message: msg.message, imageRequest: null }),
        });
      } else {
        let content = `${msg.agentEmoji} ${msg.agent}：${msg.message}`;
        if (msg.imageDescription) {
          content += `\n[概念图描述: ${msg.imageDescription}]`;
        } else if (msg.imageUrl) {
          content += `\n[生成了一张概念图]`;
        }
        pendingOthers.push(content);
      }
    }
    flushOthers();

    // 如果没有任何历史，加一个开场引导
    if (chatMessages.length === 0) {
      chatMessages.push({
        role: "user",
        content: `创意脑爆开始！请你作为${persona.name}（${persona.role}），针对「${intent}」这个创作意图，提出你的初始想法。`,
      });
    } else {
      chatMessages.push({
        role: "user",
        content: `请继续讨论，提出你的新想法或对其他人想法的回应。`,
      });
    }

    const systemPrompt = buildAgentSystemPrompt(persona, intent, personas);
    const rawResponse = await fetchLLM(apiConfig, systemPrompt, chatMessages);

    let parsed;
    try {
      parsed = parseJSON(rawResponse);
    } catch {
      parsed = { message: rawResponse, imageRequest: null };
    }

    const msg = {
      agent: persona.name,
      agentEmoji: persona.emoji,
      agentRole: persona.role,
      message: parsed.message,
      imageRequest: parsed.imageRequest || null,
      imageUrl: null,
    };

    // 如果有图片请求，先通知UI（generating状态），再生成图片
    if (parsed.imageRequest) {
      onMessage && onMessage({ ...msg, imageStatus: "generating" });
      try {
        const imageUrl = await fetchImage(apiConfig, parsed.imageRequest);
        msg.imageUrl = imageUrl;

        // 用 VLM 让下一个 agent 能"看到"这张图
        try {
          const vlmDesc = await fetchVLM(
            apiConfig,
            "简洁描述这张概念图的视觉内容、风格和氛围，用中文，100字内。",
            `这是创意脑爆中生成的概念图，创作意图是：${intent}`,
            imageUrl
          );
          msg.imageDescription = vlmDesc;
        } catch {
          msg.imageDescription = parsed.imageRequest;
        }
      } catch (e) {
        msg.imageError = e.message;
      }
      // 更新之前的generating消息（用 imageUpdate 事件替换）
      onMessage && onMessage({ ...msg, imageStatus: "done" });
    } else {
      onMessage && onMessage(msg);
    }

    roundMessages.push(msg);
  }

  return roundMessages;
}

// ─── 4. 主持人判断是否收敛 ───

export async function moderatorJudge(intent, history, roundNum, apiConfig) {
  const systemPrompt = `你是一位创意脑爆的主持人。你的任务是判断当前讨论是否已经产出了一个足够好的创意共识。

判断标准：
- 是否有一个清晰的核心创意被多数人认可或发展
- 创意是否足够具体和可执行
- 是否还有明显的分歧值得继续探讨
- 讨论是否在原地打转（如果是，应该收敛）

输出严格JSON格式：
{
  "shouldContinue": true/false,
  "progressSummary": "当前讨论进展的简要总结（50字内）",
  "reason": "为什么继续/收敛的理由（30字内）"
}`;

  const conversationText = history
    .map(msg => `${msg.agentEmoji} ${msg.agent}：${msg.message}`)
    .join("\n\n");

  const userPrompt = `创作意图：${intent}
当前是第${roundNum}轮讨论。

讨论内容：
${conversationText}

请判断是否需要继续讨论。`;

  const raw = await fetchLLM(apiConfig, systemPrompt, [{ role: "user", content: userPrompt }]);
  try {
    return parseJSON(raw);
  } catch {
    return { shouldContinue: true, progressSummary: "主持人判断解析失败，继续讨论", reason: "解析错误" };
  }
}

// ─── 5. 最终方案整合 ───

export async function synthesizeFinal(intent, history, apiConfig) {
  const systemPrompt = `你是一位创意总监。多位创意人刚完成了一场脑爆讨论，请你整合他们的最佳想法，输出一个完整的创意方案。

要求：
- 提取讨论中最精彩的创意点
- 形成一个连贯、完整、可执行的方案
- 保留讨论中涌现的亮点细节
- 如果讨论中生成过概念图，引用并说明其作用
- 方案要有吸引力，让人想立刻执行

输出格式：
{
  "title": "创意方案标题（10字内，抓人）",
  "concept": "核心创意概述（50字内）",
  "detail": "详细方案描述（完整的执行方案，包含具体内容、亮点、节奏等）",
  "highlights": ["亮点1", "亮点2", "亮点3"],
  "imagePrompt": "为最终方案生成一张代表性概念图的英文描述（80词内）"
}`;

  const conversationText = history
    .map(msg => {
      let text = `${msg.agentEmoji} ${msg.agent}：${msg.message}`;
      if (msg.imageDescription) text += `\n[概念图描述: ${msg.imageDescription}]`;
      return text;
    })
    .join("\n\n");

  const userPrompt = `创作意图：${intent}

脑爆讨论全文：
${conversationText}

请整合出最终创意方案。`;

  const raw = await fetchLLM(apiConfig, systemPrompt, [{ role: "user", content: userPrompt }]);
  let result;
  try {
    result = parseJSON(raw);
  } catch {
    result = { title: "创意方案", concept: "", detail: raw, highlights: [], imagePrompt: null };
  }

  // 生成最终概念图
  if (result.imagePrompt) {
    try {
      result.finalImageUrl = await fetchImage(apiConfig, result.imagePrompt);
    } catch {
      // 图片生成失败不影响最终方案
    }
  }

  return result;
}

// ─── 6. 完整脑爆流程编排 ───

/**
 * 运行完整的多Agent脑爆流程
 * @param {object} params
 * @param {string} params.intent - 创作意图
 * @param {Array} params.personas - 角色列表 [{name, emoji, role, gene, belief, skills, tendencies}]
 * @param {object} params.apiConfig
 * @param {function} params.onEvent - 事件回调
 *   - {type: "round_start", round: n}
 *   - {type: "agent_message", message: {...}}
 *   - {type: "moderator", result: {...}}
 *   - {type: "synthesizing"}
 *   - {type: "final", result: {...}}
 *   - {type: "error", error: "..."}
 * @param {object} params.control - 外部控制 {shouldStop: bool, forceConverge: bool}
 * @returns {object} {history, finalResult}
 */
export async function runBrainstorm({ intent, personas, apiConfig, onEvent, control }) {
  const history = [];
  let roundNum = 0;

  try {
    while (roundNum < MAX_ROUNDS) {
      // 检查外部控制
      if (control?.shouldStop) break;
      if (control?.forceConverge) break;

      roundNum++;
      onEvent?.({ type: "round_start", round: roundNum });

      // 执行一轮脑爆
      const roundMessages = await brainstormRound(
        intent, personas, history, apiConfig,
        (msg) => onEvent?.({ type: "agent_message", message: msg, round: roundNum })
      );
      history.push(...roundMessages);

      // 检查外部控制（轮后再检查一次）
      if (control?.shouldStop) break;
      if (control?.forceConverge) break;

      // 主持人判断（至少2轮后才开始判断）
      if (roundNum >= 2) {
        const judgment = await moderatorJudge(intent, history, roundNum, apiConfig);
        onEvent?.({ type: "moderator", result: judgment, round: roundNum });

        if (!judgment.shouldContinue) break;
      }
    }

    // 如果是硬停止且没有历史，直接返回
    if (control?.shouldStop && history.length === 0) {
      return { history, finalResult: null };
    }

    // 最终整合（forceConverge 或自然收敛都要整合）
    if (!control?.shouldStop) {
      onEvent?.({ type: "synthesizing" });
      const finalResult = await synthesizeFinal(intent, history, apiConfig);
      onEvent?.({ type: "final", result: finalResult });
      return { history, finalResult };
    }

    return { history, finalResult: null };
  } catch (error) {
    onEvent?.({ type: "error", error: error.message });
    throw error;
  }
}
