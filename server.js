import express from "express";
import { execFile } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3457;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(__dirname, "dist")));

app.post("/api/claude", (req, res) => {
  const { systemPrompt, userPrompt } = req.body;

  if (!systemPrompt || !userPrompt) {
    return res.status(400).json({ error: "缺少 systemPrompt 或 userPrompt" });
  }

  // 将 prompt 写入临时文件，避免 shell 转义问题
  const promptFile = join(tmpdir(), `claude-prompt-${Date.now()}.txt`);
  const fullPrompt = `[System Instructions]\n${systemPrompt}\n\n[User Request]\n${userPrompt}`;
  writeFileSync(promptFile, fullPrompt, "utf-8");

  const env = { ...process.env };
  delete env.CLAUDECODE;

  const args = [
    "-y", "@anthropic-ai/claude-code",
    "--print",
    "--model", "claude-sonnet-4-6",
    "--max-turns", "1",
    "--output-format", "text",
    fullPrompt,
  ];

  execFile("npx", args, { timeout: 120000, maxBuffer: 1024 * 1024, env }, (error, stdout, stderr) => {
    // 清理临时文件
    try { unlinkSync(promptFile); } catch {}

    if (error) {
      console.error("Claude CLI 错误:", error.message);
      if (stderr) console.error("stderr:", stderr);
      return res.status(500).json({
        error: `Claude CLI 调用失败: ${stderr || error.message}`,
      });
    }
    res.json({ text: stdout });
  });
});

app.listen(PORT, () => {
  console.log(`\n🌌 创世模拟器已启动！`);
  console.log(`👉 打开浏览器访问: http://localhost:${PORT}`);
  console.log(`\n使用你的 Claude Max 会员认证，无需 API Key\n`);
});
