---
name: deploy
description: 构建、提交、推送代码，并输出本地运行指令。每次代码改动后想要体验时使用。
---

# Deploy Skill — 一键发布体验

当用户想要体验最新代码时，执行以下流程：

## 流程

### 1. 构建
```bash
cd /home/user/dreamina && npx vite build
```
验证构建成功，检查 dist/index.html 包含最新代码。

### 2. 提交
将所有改动（包括 dist/index.html）添加到 git 并提交：
- `git add -A`
- 用清晰的 commit message 提交
- 不要遗漏 dist/ 目录

### 3. 推送
```bash
git push -u origin claude/integrate-external-api-WTx6B
```
如果推送失败，重试最多4次（指数退避 2s/4s/8s/16s）。

### 4. 输出本地运行指令

推送成功后，输出以下内容供用户复制到本地终端：

```
------- 在你本地终端执行 -------

# 如果还没 clone 过：
git clone https://github.com/frankfan-lgtm/dreamina.git
cd dreamina

# 拉取最新代码：
git checkout claude/integrate-external-api-WTx6B
git pull origin claude/integrate-external-api-WTx6B

# 安装依赖（首次或依赖变化时）：
npm install

# 启动：
node server.js

# 浏览器打开 http://localhost:3456
-----------------------------------
```

### 5. 确认
告诉用户代码已推送到 GitHub，在本地终端执行上面的命令即可体验。
