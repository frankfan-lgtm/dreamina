import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;

app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  res.set("ETag", `"${Date.now()}"`);
  next();
});

app.post("/api/claude", async (req, res) => {
  const { systemPrompt, userPrompt, messages: chatMessages, apiKey, baseUrl, model } = req.body;

  if (!systemPrompt || (!userPrompt && !chatMessages)) {
    return res.status(400).json({ error: "缺少 systemPrompt 或 userPrompt/messages" });
  }

  const key = apiKey || process.env.API_KEY;
  if (!key) {
    return res.status(400).json({ error: "缺少 API Key，请在界面设置中输入或设置环境变量 API_KEY" });
  }

  const url = baseUrl || process.env.API_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

  const ALLOWED_HOSTS = ["ark.cn-beijing.volces.com", "api.openai.com", "api.anthropic.com", "api.deepseek.com"];
  try {
    const urlObj = new URL(url);
    if (!ALLOWED_HOSTS.some(h => urlObj.hostname === h || urlObj.hostname.endsWith("." + h))) {
      return res.status(400).json({ error: "不支持的 API 地址" });
    }
  } catch {
    return res.status(400).json({ error: "无效的 API 地址" });
  }

  const modelId = model || process.env.API_MODEL || "deepseek-v3-2-251201";

  if (!modelId) {
    return res.status(400).json({ error: "缺少模型/接入点 ID，请在界面设置中输入（如 ep-xxxxx 或 doubao-pro-32k）" });
  }

  // 支持两种格式：单轮(userPrompt) 或 多轮(messages数组)
  let apiMessages;
  if (chatMessages && Array.isArray(chatMessages)) {
    apiMessages = [
      { role: "system", content: systemPrompt },
      ...chatMessages,
    ];
  } else {
    apiMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: apiMessages,
        max_tokens: 4096,
        temperature: 0.8,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("API 错误:", response.status, err);
      return res.status(response.status).json({
        error: `API 调用失败 (${response.status}): ${err}`,
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      console.error("API 返回:", JSON.stringify(data));
      return res.status(500).json({ error: "API 返回内容为空" });
    }

    res.json({ text });
  } catch (err) {
    console.error("请求失败:", err.message);
    return res.status(500).json({ error: `请求失败: ${err.message}` });
  }
});

// ─── VLM 图片理解代理 (Doubao-Seed-2.0-lite) ───
// 图片在服务端直接构建多模态消息，避免 base64 数据通过客户端传输超过 body 限制
app.post("/api/vlm", async (req, res) => {
  const { systemPrompt, textContent, imageUrl, apiKey } = req.body;

  if (!systemPrompt || !textContent) {
    return res.status(400).json({ error: "缺少 systemPrompt 或 textContent" });
  }

  const key = apiKey || process.env.API_KEY;
  if (!key) {
    return res.status(400).json({ error: "缺少 API Key，请在界面设置中输入或设置环境变量 API_KEY" });
  }

  const url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  const modelId = "Doubao-Seed-2.0-lite";

  // 构建多模态用户消息
  const userContent = [{ type: "text", text: textContent }];
  if (imageUrl) {
    userContent.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[VLM API] 错误:", response.status, err.slice(0, 500));
      return res.status(response.status).json({
        error: `VLM调用失败 (${response.status}): ${err.slice(0, 200)}`,
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      console.error("[VLM API] 返回内容为空:", JSON.stringify(data).slice(0, 500));
      return res.status(500).json({ error: "VLM返回内容为空" });
    }

    res.json({ text });
  } catch (err) {
    console.error("[VLM API] 请求失败:", err.message);
    return res.status(500).json({ error: `VLM请求失败: ${err.message}` });
  }
});

// ─── 图片生成代理 (Seedream) ───
app.post("/api/image", async (req, res) => {
  const { prompt, apiKey, size } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "缺少 prompt" });
  }

  const key = apiKey || process.env.API_KEY;
  if (!key) {
    return res.status(400).json({ error: "缺少 API Key，请在界面设置中输入或设置环境变量 API_KEY" });
  }
  const url = "https://ark.cn-beijing.volces.com/api/v3/images/generations";

  const requestBody = {
    model: "doubao-seedream-4-5-251128",
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
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120000),
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

// 静态文件服务放在 API 路由之后
app.use(express.static(join(__dirname, "dist"), { etag: false, lastModified: false }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🌌 创世模拟器已启动！`);
  console.log(`👉 打开浏览器访问: http://localhost:${PORT}`);
  console.log(`\n支持火山引擎 / OpenAI 兼容 API\n`);
});
