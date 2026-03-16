# Dreamina 项目配置

## LLM API 配置

- **模型名称**: `doubao-seed-2-0-lite-260215` (豆包/火山引擎)
- **备选模型**: `doubao-seed-2-0-pro-260215`
- **图像生成模型**: `doubao-seedream-5.0-lite`
- **API Key**: `94090db7-6585-460e-a8ff-7830c1516624`
- **API 地址**: `https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- **服务商**: 火山引擎 (Volcano Engine / ByteDance)

## 配置位置

- 后端默认值: `server.js` (第 10-12 行硬编码)
- 前端默认值: `src/store/useStore.jsx` (DEFAULT_CONFIG)
- 前端 UI: `src/components/create/CreateWorld.jsx`
- API Key 和地址写死，前端 UI 只允许用户改模型名称

## 开发

- 启动: `node server.js` (默认端口 3456，可通过 PORT 环境变量修改)
- 支持的 API 地址白名单: ark.cn-beijing.volces.com, api.openai.com, api.anthropic.com, api.deepseek.com
