import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  res.set("ETag", `"${Date.now()}"`);
  next();
});
app.use(express.static(join(__dirname, "dist"), { etag: false, lastModified: false }));

app.post("/api/claude", async (req, res) => {
  const { systemPrompt, userPrompt, messages: chatMessages, apiKey, baseUrl, model } = req.body;

  if (!systemPrompt || (!userPrompt && !chatMessages)) {
    return res.status(400).json({ error: "缺少 systemPrompt 或 userPrompt/messages" });
  }

  const key = apiKey || process.env.API_KEY || "94090db7-6585-460e-a8ff-7830c1516624";
  if (!key) {
    return res.status(400).json({ error: "缺少 API Key" });
  }

  const url = baseUrl || process.env.API_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
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
    res.status(500).json({ error: `请求失败: ${err.message}` });
  }
});

// ─── 图片生成代理 (Seedream) ───
app.post("/api/image", async (req, res) => {
  const { prompt, apiKey, size } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "缺少 prompt" });
  }

  const key = apiKey || process.env.API_KEY || "94090db7-6585-460e-a8ff-7830c1516624";
  const url = "https://ark.cn-beijing.volces.com/api/v3/images/generations";

  const requestBody = {
    model: "doubao-seedream-4-5-251128",
    prompt,
    size: size || "16:9",
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
    res.status(500).json({ error: `图片请求失败: ${err.message}` });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🌌 创世模拟器已启动！`);
  console.log(`👉 打开浏览器访问: http://localhost:${PORT}`);
  console.log(`\n支持火山引擎 / OpenAI 兼容 API\n`);
});
