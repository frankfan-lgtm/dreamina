import express from "express";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3456;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(__dirname, "dist")));

app.post("/api/claude", (req, res) => {
  const { systemPrompt, userPrompt } = req.body;

  if (!systemPrompt || !userPrompt) {
    return res.status(400).json({ error: "缺少 systemPrompt 或 userPrompt" });
  }

  const fullPrompt = `${userPrompt}`;

  execFile(
    "claude",
    [
      "--print",
      "--model", "claude-sonnet-4-20250514",
      "--max-turns", "1",
      "--output-format", "text",
      "-s", systemPrompt,
      fullPrompt,
    ],
    { timeout: 60000, maxBuffer: 1024 * 1024 },
    (error, stdout, stderr) => {
      if (error) {
        console.error("Claude CLI 错误:", error.message);
        if (stderr) console.error("stderr:", stderr);
        return res.status(500).json({
          error: `Claude CLI 调用失败: ${error.message}`,
        });
      }
      res.json({ text: stdout });
    }
  );
});

app.listen(PORT, () => {
  console.log(`\n🌌 创世模拟器已启动！`);
  console.log(`👉 打开浏览器访问: http://localhost:${PORT}`);
  console.log(`\n使用你的 Claude Max 会员认证，无需 API Key\n`);
});
