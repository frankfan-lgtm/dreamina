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
async function fetchVLM(apiConfig, systemPrompt, textContent, imageUrl) {
  const userContent = [
    { type: "text", text: textContent },
  ];
  if (imageUrl) {
    userContent.push({
      type: "image_url",
      image_url: { url: imageUrl },
    });
  }

  const res = await fetch("/api/vlm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt,
      messages: [{ role: "user", content: userContent }],
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

// ─── 1. 生成脑爆角色 ───

export async function generatePersonas(intent, apiConfig) {
  const systemPrompt = `你是一个创意团队组建专家。根据用户的创作意图，设计3个最适合进行创意脑爆的角色。

每个角色要有鲜明的思维方式差异，确保能从不同角度碰撞出火花。

输出严格JSON格式：
{
  "personas": [
    {
      "name": "角色名（2-4字，有个性）",
      "emoji": "一个代表性emoji",
      "role": "角色定位（如：资深导演/用户心理学家/鬼才段子手）",
      "style": "思维和表达风格描述（30字内）",
      "perspective": "这个角色会从什么独特角度思考创意（20字内）"
    }
  ]
}

要求：
- 3个角色的思维方式要形成互补和张力
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

// ─── 3. 多Agent脑爆核心 ───

function buildAgentSystemPrompt(persona, intent, allPersonas) {
  const othersDesc = allPersonas
    .filter(p => p.name !== persona.name)
    .map(p => `${p.emoji} ${p.name}（${p.role}）：${p.style}`)
    .join("\n");

  return `你是「${persona.name}」，一位${persona.role}。

## 你的思维风格
${persona.style}

## 你的独特视角
${persona.perspective}

## 创作意图
${intent}

## 脑爆伙伴
${othersDesc}

## 你的行为准则
- 用你独特的视角提出想法，大胆、有个性
- 认真倾听其他人的想法，可以借鉴、挑战、升级
- 如果觉得某个想法好，说出好在哪里并帮它变得更好
- 如果觉得某个想法有问题，直接指出并提出替代方案
- 可以请求生成概念图来可视化你的创意想法
- 说话要有个性和感染力，不要干巴巴的

## 输出格式（严格JSON）
{
  "message": "你的发言内容（自然语言，有个性）",
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

    // 将历史转为LLM对话格式
    for (const msg of history) {
      if (msg.agent === persona.name) {
        chatMessages.push({
          role: "assistant",
          content: JSON.stringify({ message: msg.message, imageRequest: null }),
        });
      } else {
        const content = msg.imageUrl
          ? `${msg.agentEmoji} ${msg.agent}：${msg.message}\n[生成了一张图片]`
          : `${msg.agentEmoji} ${msg.agent}：${msg.message}`;
        chatMessages.push({ role: "user", content });
      }
    }

    // 加上本轮已发言的agent
    for (const msg of roundMessages) {
      const content = msg.imageUrl
        ? `${msg.agentEmoji} ${msg.agent}：${msg.message}\n[生成了一张图片]`
        : `${msg.agentEmoji} ${msg.agent}：${msg.message}`;
      chatMessages.push({ role: "user", content });
    }

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

    // 如果有图片请求，生成图片
    if (parsed.imageRequest) {
      try {
        onMessage && onMessage({ ...msg, imageStatus: "generating" });
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
    }

    roundMessages.push(msg);
    onMessage && onMessage(msg);
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
  return parseJSON(raw);
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
  const result = parseJSON(raw);

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
 * @param {Array} params.personas - 角色列表 [{name, emoji, role, style, perspective}]
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

    // 最终整合
    onEvent?.({ type: "synthesizing" });
    const finalResult = await synthesizeFinal(intent, history, apiConfig);
    onEvent?.({ type: "final", result: finalResult });

    return { history, finalResult };
  } catch (error) {
    onEvent?.({ type: "error", error: error.message });
    throw error;
  }
}
