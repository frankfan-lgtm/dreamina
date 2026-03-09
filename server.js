import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3456;

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(express.static(join(__dirname, "dist")));

app.post("/api/claude", async (req, res) => {
  const { systemPrompt, userPrompt, apiKey, baseUrl, model } = req.body;

  if (!systemPrompt || !userPrompt) {
    return res.status(400).json({ error: "缺少 systemPrompt 或 userPrompt" });
  }

  const key = apiKey || process.env.API_KEY || "94090db7-6585-460e-a8ff-7830c1516624";
  if (!key) {
    return res.status(400).json({ error: "缺少 API Key" });
  }

  const url = baseUrl || process.env.API_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  const modelId = model || process.env.API_MODEL || "doubao-seed-2-0-pro-260215";

  if (!modelId) {
    return res.status(400).json({ error: "缺少模型/接入点 ID，请在界面设置中输入（如 ep-xxxxx 或 doubao-pro-32k）" });
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
          { role: "user", content: userPrompt },
        ],
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🌌 创世模拟器已启动！`);
  console.log(`👉 打开浏览器访问: http://localhost:${PORT}`);
  console.log(`\n支持火山引擎 / OpenAI 兼容 API\n`);
});
