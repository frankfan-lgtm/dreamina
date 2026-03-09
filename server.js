import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3456;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(__dirname, "dist")));

app.post("/api/claude", async (req, res) => {
  const { systemPrompt, userPrompt, apiKey } = req.body;

  if (!systemPrompt || !userPrompt) {
    return res.status(400).json({ error: "缺少 systemPrompt 或 userPrompt" });
  }

  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(400).json({ error: "缺少 API Key，请在界面输入或设置 ANTHROPIC_API_KEY 环境变量" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API 错误:", response.status, err);
      return res.status(response.status).json({
        error: `API 调用失败 (${response.status}): ${err}`,
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: "API 返回内容为空" });
    }

    res.json({ text });
  } catch (err) {
    console.error("请求失败:", err.message);
    res.status(500).json({ error: `请求失败: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`\n🌌 创世模拟器已启动！`);
  console.log(`👉 打开浏览器访问: http://localhost:${PORT}`);
  console.log(`\n支持方式：界面输入 API Key 或设置 ANTHROPIC_API_KEY 环境变量\n`);
});
