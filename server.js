import express from "express";
import { spawn } from "child_process";
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

  const fullPrompt = `[System Instructions]\n${systemPrompt}\n\n[User Request]\n${userPrompt}`;

  const env = { ...process.env };
  delete env.CLAUDECODE;

  const child = spawn("claude", [
    "--print",
    "--model", "claude-sonnet-4-6",
    "--max-turns", "1",
    "--output-format", "text",
  ], {
    env,
    timeout: 120000,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (data) => { stdout += data.toString(); });
  child.stderr.on("data", (data) => { stderr += data.toString(); });

  // Send prompt via stdin
  child.stdin.write(fullPrompt);
  child.stdin.end();

  child.on("close", (code) => {
    if (code !== 0) {
      console.error("Claude CLI 错误, exit code:", code);
      if (stderr) console.error("stderr:", stderr);
      return res.status(500).json({
        error: `Claude CLI 调用失败: ${stderr || `exit code ${code}`}`,
      });
    }
    res.json({ text: stdout });
  });

  child.on("error", (err) => {
    console.error("Claude CLI spawn 错误:", err.message);
    res.status(500).json({ error: `无法启动 Claude CLI: ${err.message}` });
  });
});

app.listen(PORT, () => {
  console.log(`\n🌌 创世模拟器已启动！`);
  console.log(`👉 API 服务运行在: http://localhost:${PORT}`);
  console.log(`\n使用你的 Claude Max 会员认证，无需 API Key\n`);
});
