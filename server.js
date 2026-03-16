import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;

// ─── 默认 API 配置（写死，页面可覆盖模型名称）───
const DEFAULT_API_KEY = "94090db7-6585-460e-a8ff-7830c1516624";
const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const DEFAULT_MODEL = "doubao-seed-2-0-lite-260215";

// ─── 允许的 API 主机白名单 ───
const ALLOWED_HOSTS = [
  "ark.cn-beijing.volces.com",
  "api.openai.com",
  "api.anthropic.com",
  "api.deepseek.com",
];

// ─── 并发限流：同时最多 10 个 LLM 请求 ───
let activeLLMRequests = 0;
const MAX_CONCURRENT_LLM = 10;

/**
 * 获取并发槽位，超出限制时等待
 * @returns {Promise<void>}
 */
function acquireLLMSlot() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("获取 LLM 并发槽位超时（30秒）"));
    }, 30000);

    const tryAcquire = () => {
      if (activeLLMRequests < MAX_CONCURRENT_LLM) {
        clearTimeout(timeout);
        activeLLMRequests++;
        resolve();
      } else {
        setTimeout(tryAcquire, 50);
      }
    };
    tryAcquire();
  });
}

function releaseLLMSlot() {
  activeLLMRequests = Math.max(0, activeLLMRequests - 1);
}

// ─── 中间件 ───
app.use(express.json({ limit: "1mb" }));

// CORS 支持
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// 禁用缓存
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  res.set("ETag", `"${Date.now()}"`);
  next();
});

// 生产环境：提供静态文件
app.use(express.static(join(__dirname, "dist"), { etag: false, lastModified: false }));

// ─── 工具函数 ───

/**
 * 校验 API 地址是否在白名单内
 */
function validateApiUrl(url) {
  try {
    const urlObj = new URL(url);
    if (!ALLOWED_HOSTS.some(h => urlObj.hostname === h || urlObj.hostname.endsWith("." + h))) {
      return { valid: false, error: "不支持的 API 地址" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "无效的 API 地址" };
  }
}

/**
 * 构造 API 消息数组，支持单轮(userPrompt)和多轮(messages)
 */
function buildApiMessages(systemPrompt, userPrompt, chatMessages) {
  if (chatMessages && Array.isArray(chatMessages)) {
    return [{ role: "system", content: systemPrompt }, ...chatMessages];
  }
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

/**
 * 带重试的 LLM 调用（非流式）
 * @param {object} params - 调用参数
 * @param {number} retries - 最大重试次数
 * @returns {Promise<string>} 返回文本内容
 */
async function callLLM({ url, key, modelId, apiMessages, maxTokens = 4096, temperature = 0.8 }, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await acquireLLMSlot();
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: apiMessages,
            max_tokens: maxTokens,
            temperature,
          }),
          signal: AbortSignal.timeout(180000),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API 调用失败 (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) {
          throw new Error("API 返回内容为空");
        }
        return text;
      } finally {
        releaseLLMSlot();
      }
    } catch (err) {
      lastError = err;
      // 最后一次尝试不再重试
      if (attempt < retries) {
        // 指数退避：200ms, 400ms
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        console.warn(`[LLM] 第 ${attempt + 1} 次重试: ${err.message}`);
      }
    }
  }
  throw lastError;
}

/**
 * 带重试的 LLM 流式调用
 * @param {object} params - 调用参数
 * @param {function} onChunk - 每收到一个文本 chunk 的回调
 * @param {number} retries - 最大重试次数
 * @returns {Promise<string>} 完整文本
 */
async function callLLMStream({ url, key, modelId, apiMessages, maxTokens = 4096, temperature = 0.8 }, onChunk, retries = 0) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await acquireLLMSlot();
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: apiMessages,
            max_tokens: maxTokens,
            temperature,
            stream: true,
          }),
          signal: AbortSignal.timeout(120000), // 流式超时更长
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API 调用失败 (${response.status}): ${errText}`);
        }

        // 解析 SSE 流
        let fullText = "";
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // 保留最后一行（可能不完整）
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                onChunk(delta);
              }
            } catch {
              // 忽略无法解析的行
            }
          }
        }

        return fullText;
      } finally {
        releaseLLMSlot();
      }
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        console.warn(`[LLM Stream] 第 ${attempt + 1} 次重试: ${err.message}`);
      }
    }
  }
  throw lastError;
}

/**
 * 从请求体中提取并校验公共 LLM 参数
 */
function extractLLMParams(body) {
  const { systemPrompt, userPrompt, messages: chatMessages, apiKey, baseUrl, model } = body;

  if (!systemPrompt || (!userPrompt && !chatMessages)) {
    return { error: "缺少 systemPrompt 或 userPrompt/messages" };
  }

  const key = apiKey || DEFAULT_API_KEY;
  if (!key) {
    return { error: "缺少 API Key" };
  }

  const url = baseUrl || DEFAULT_BASE_URL;
  const urlCheck = validateApiUrl(url);
  if (!urlCheck.valid) {
    return { error: urlCheck.error };
  }

  const modelId = model || DEFAULT_MODEL;
  if (!modelId) {
    return { error: "缺少模型/接入点 ID，请在界面设置中输入（如 ep-xxxxx 或 doubao-pro-32k）" };
  }

  const apiMessages = buildApiMessages(systemPrompt, userPrompt, chatMessages);

  return { url, key, modelId, apiMessages };
}

// ═══════════════════════════════════════════════
// 1. POST /api/claude — 单次 LLM 调用（保持兼容）
// ═══════════════════════════════════════════════
app.post("/api/claude", async (req, res) => {
  const params = extractLLMParams(req.body);
  if (params.error) {
    return res.status(400).json({ error: params.error });
  }

  try {
    const text = await callLLM(params);
    res.json({ text });
  } catch (err) {
    console.error("[/api/claude] 请求失败:", err.message);
    res.status(500).json({ error: `请求失败: ${err.message}` });
  }
});

// ═══════════════════════════════════════════════
// 2. POST /api/claude/batch — 并行 LLM 调用
// ═══════════════════════════════════════════════
app.post("/api/claude/batch", async (req, res) => {
  const { requests } = req.body;

  if (!Array.isArray(requests) || requests.length === 0) {
    return res.status(400).json({ error: "requests 必须是非空数组" });
  }

  if (requests.length > 20) {
    return res.status(400).json({ error: "单次批量请求最多 20 个" });
  }

  // 并行执行所有请求
  const results = await Promise.all(
    requests.map(async (reqItem) => {
      const { id, systemPrompt, messages: chatMessages, apiKey, baseUrl, model, userPrompt } = reqItem;

      // 校验参数
      const params = extractLLMParams({
        systemPrompt,
        userPrompt,
        messages: chatMessages,
        apiKey,
        baseUrl,
        model,
      });

      if (params.error) {
        return { id, text: null, error: params.error };
      }

      try {
        const text = await callLLM(params);
        return { id, text };
      } catch (err) {
        console.error(`[/api/claude/batch] 请求 ${id} 失败:`, err.message);
        return { id, text: null, error: err.message };
      }
    })
  );

  res.json({ results });
});

// ═══════════════════════════════════════════════
// 3. POST /api/claude/stream — SSE 流式推送
// ═══════════════════════════════════════════════
app.post("/api/claude/stream", async (req, res) => {
  const params = extractLLMParams(req.body);
  if (params.error) {
    return res.status(400).json({ error: params.error });
  }

  // 设置 SSE 响应头
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // 禁用 nginx 缓冲
  });
  res.flushHeaders();

  // 客户端断开时的清理标记
  let clientDisconnected = false;
  req.on("close", () => {
    clientDisconnected = true;
  });

  try {
    const fullText = await callLLMStream(params, (chunk) => {
      if (!clientDisconnected) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    });

    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify({ done: true, full_text: fullText })}\n\n`);
      res.end();
    }
  } catch (err) {
    console.error("[/api/claude/stream] 流式请求失败:", err.message);
    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// ═══════════════════════════════════════════════
// 4. GET /api/simulation/stream — 世界模拟 SSE 事件流
// ═══════════════════════════════════════════════

// 事件总线：按 worldId 管理订阅者
const simulationSubscribers = new Map(); // worldId -> Set<res>

/**
 * 向指定世界的所有订阅者广播事件
 * @param {string} worldId - 世界 ID
 * @param {string} eventType - 事件类型 (npc_action, npc_speech, npc_thought, narration, info_gap, tension_update, resource_change, time_tick)
 * @param {object} data - 事件数据
 */
export function broadcastSimulationEvent(worldId, eventType, data) {
  const subscribers = simulationSubscribers.get(worldId);
  if (!subscribers || subscribers.size === 0) return;

  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const subscriberRes of subscribers) {
    try {
      subscriberRes.write(payload);
    } catch {
      // 写入失败时移除该订阅者
      subscribers.delete(subscriberRes);
    }
  }
}

app.get("/api/simulation/stream", (req, res) => {
  const { worldId } = req.query;

  if (!worldId) {
    return res.status(400).json({ error: "缺少 worldId 参数" });
  }

  // 设置 SSE 响应头
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  // 注册订阅者
  if (!simulationSubscribers.has(worldId)) {
    simulationSubscribers.set(worldId, new Set());
  }
  simulationSubscribers.get(worldId).add(res);

  // 发送初始连接确认
  res.write(`event: info\ndata: ${JSON.stringify({ message: "已连接世界模拟事件流", worldId })}\n\n`);

  // 发送心跳保持连接
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // 客户端断开时清理
  req.on("close", () => {
    clearInterval(heartbeat);
    const subs = simulationSubscribers.get(worldId);
    if (subs) {
      subs.delete(res);
      if (subs.size === 0) {
        simulationSubscribers.delete(worldId);
      }
    }
  });
});

// ─── 图片生成代理 (Seedream) ───
app.post("/api/image", async (req, res) => {
  const { prompt, apiKey, size, imageModel } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "缺少 prompt" });
  }

  const key = apiKey || DEFAULT_API_KEY;
  if (!key) {
    return res.status(400).json({ error: "缺少 API Key" });
  }
  const url = "https://ark.cn-beijing.volces.com/api/v3/images/generations";

  const requestBody = {
    model: imageModel || "doubao-seedream-5.0-lite",
    prompt,
    size: size || "2560x1440",
    response_format: "b64_json",
    n: 1,
  };
  console.log("[图片API] 请求:", JSON.stringify(requestBody).slice(0, 200));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[图片API] 错误:", response.status, err.slice(0, 500));
      return res.status(response.status).json({
        error: `图片生成失败 (${response.status}): ${err.slice(0, 200)}`,
      });
    }

    const data = await response.json();
    console.log("[图片API] 返回keys:", Object.keys(data), "data长度:", data.data?.length);

    // 优先取 url，其次取 b64_json
    const item = data.data?.[0];
    if (item?.url) {
      res.json({ url: item.url });
    } else if (item?.b64_json) {
      res.json({ url: `data:image/png;base64,${item.b64_json}` });
    } else {
      console.error("[图片API] 返回内容为空:", JSON.stringify(data).slice(0, 500));
      return res.status(500).json({ error: "图片API返回内容为空" });
    }
  } catch (err) {
    console.error("[图片API] 请求失败:", err.message);
    return res.status(500).json({ error: `图片请求失败: ${err.message}` });
  }
});

// ─── 启动服务器 ───
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n创世模拟器已启动！`);
  console.log(`打开浏览器访问: http://localhost:${PORT}`);
  console.log(`\n支持火山引擎 / OpenAI 兼容 API`);
  console.log(`API 端点:`);
  console.log(`  POST /api/claude        — 单次 LLM 调用`);
  console.log(`  POST /api/claude/batch   — 并行 LLM 批量调用`);
  console.log(`  POST /api/claude/stream  — SSE 流式推送`);
  console.log(`  GET  /api/simulation/stream?worldId=xxx — 世界模拟事件流`);
  console.log(`  POST /api/image         — 图片生成\n`);
});
