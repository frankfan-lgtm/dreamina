import express from "express";
import { exec } from "child_process";
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

  // 用环境变量传递 prompt，避免命令行转义问题
  const env = {
    ...process.env,
    CLAUDE_SYSTEM_PROMPT: systemPrompt,
    CLAUDE_USER_PROMPT: userPrompt,
  };

  exec(
    'npx -y @anthropic-ai/claude-code --print --model claude-sonnet-4-20250514 --max-turns 1 --output-format text -s "$CLAUDE_SYSTEM_PROMPT" "$CLAUDE_USER_PROMPT"',
    { timeout: 120000, maxBuffer: 1024 * 1024, env, shell: "/bin/bash" },
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
