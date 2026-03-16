/**
 * 世界创建页面 — 用户描述世界或选择预设
 */
import React, { useState } from "react";
import { useStore } from "../../store/useStore.jsx";
import { WORLD_PRESETS } from "../../sdk/index.js";
import { WorldAnalyst } from "../../agents/index.js";

// 预设列表（从 SDK 加载 + 预留更多）
const PRESET_LIST = [
  { ...WORLD_PRESETS.office, id: "office" },
  { ...WORLD_PRESETS.hogwarts, id: "hogwarts" },
  { id: "stock", emoji: "📈", label: "股市博弈", tagline: "多空对决，谁能笑到最后", placeholder: "一群性格迥异的交易员在同一个对冲基金..." },
  { id: "worldcup", emoji: "⚽", label: "世界杯", tagline: "绿茵场上的荣耀与遗憾", placeholder: "一支国家队备战世界杯决赛..." },
  { id: "mars", emoji: "🚀", label: "火星殖民", tagline: "人类文明的新篇章", placeholder: "第一批火星移民面临资源危机..." },
  { id: "school", emoji: "🏫", label: "高三冲刺", tagline: "高考倒计时100天", placeholder: "一个高三班级在高考前100天..." },
];

export default function CreateWorld() {
  const {
    worldPrompt, setWorldPrompt,
    apiConfig, setApiConfig,
    setCurrentPage, setWorldAnalysis,
    setWorldConfig, setNpcs, setRelationships,
    setSchedule, setNpcStations, setSpriteColors,
    setSelectedPreset,
  } = useStore();

  const [showApiConfig, setShowApiConfig] = useState(!apiConfig.apiKey);
  const [localApiKey, setLocalApiKey] = useState(apiConfig.apiKey || "");
  const [localBaseUrl, setLocalBaseUrl] = useState(apiConfig.baseUrl || "https://ark.cn-beijing.volces.com/api/v3/chat/completions");
  const [localModel, setLocalModel] = useState(apiConfig.model || "doubao-seed-2-0-pro-260215");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  // 选择预设世界 — 直接用预设数据进入构建
  const handlePresetSelect = (preset) => {
    if (!apiConfig.apiKey) {
      setError("请先配置 API Key");
      setShowApiConfig(true);
      return;
    }

    // 如果预设有完整数据（office/hogwarts），直接用
    if (preset.config) {
      setWorldConfig(preset.config);
      setNpcs(preset.npcs.map((npc) => ({
        ...JSON.parse(JSON.stringify(npc)),
        action: "", thought: "", decisionChain: "",
        relationships: preset.relationships[npc.id] || {},
      })));
      setRelationships(preset.relationships);
      setSchedule(preset.schedule);
      setNpcStations(preset.npcStations || {});
      setSpriteColors(preset.spriteColors || {});
      setSelectedPreset(preset.id);

      // 构建伪分析结果
      setWorldAnalysis({
        worldType: "narrative",
        perception: "virtual",
        npcCount: preset.npcs.length,
        name: preset.config.name,
        description: preset.config.description,
        npcs: preset.npcs.map((n) => ({ id: n.id, name: n.name, emoji: n.emoji, title: n.title })),
        resources: preset.config.resources,
        conflicts: preset.config.interventions?.slice(0, 3).map((i) => i.description) || [],
      });
      setCurrentPage("analysis");
    } else {
      // 非完整预设 — 用描述生成
      setWorldPrompt(preset.placeholder || preset.tagline);
    }
  };

  // V2: AI 世界分析师分析世界
  const handleAnalyze = async () => {
    if (!worldPrompt.trim()) return;
    if (!apiConfig.apiKey) {
      setError("请先配置 API Key");
      setShowApiConfig(true);
      return;
    }

    setIsAnalyzing(true);
    setError("");

    try {
      const analyst = new WorldAnalyst(apiConfig, { maxRetries: 2, timeout: 180000 });
      const analysis = await analyst.analyze(worldPrompt);

      // 存储 V2 分析结果（含完整蓝图数据，供 WorldArchitect 使用）
      setWorldAnalysis({
        ...analysis,
        // 兼容字段
        worldType: analysis.type,
        perception: analysis.perception,
        npcCount: analysis.complexity.suggestedNpcCount,
        name: analysis.worldName,
        description: analysis.worldDescription,
        npcs: [], // NPC 将由 WorldArchitect 在构建阶段生成
        resources: analysis.suggestedResources.reduce((acc, r) => {
          acc[r.id] = r;
          return acc;
        }, {}),
        conflicts: analysis.keyConflicts.map((c) => c.description),
        // V2 特有：标记需要构建阶段调用 WorldArchitect
        _needsBuild: true,
      });

      setSelectedPreset(null);
      setCurrentPage("analysis");
    } catch (e) {
      setError(e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 保存 API 配置
  const handleSaveApi = () => {
    if (!localApiKey.trim() || !localModel.trim()) return;
    const cfg = { apiKey: localApiKey.trim(), baseUrl: localBaseUrl.trim(), model: localModel.trim() };
    setApiConfig(cfg);
    setShowApiConfig(false);
    setError("");
  };

  return (
    <div className="create-world-page">
      {/* 背景装饰 */}
      <div className="create-world-bg" />

      <div className="create-world-content">
        {/* 标题区 */}
        <div className="create-world-hero">
          <div className="create-world-star">&#10022;</div>
          <h1 className="create-world-title">Dreamina</h1>
          <p className="create-world-subtitle">创造你的世界，观察生命的涌现</p>
        </div>

        {/* 输入区 */}
        <div className="create-world-input-area">
          <textarea
            className="create-world-textarea"
            placeholder="描述你想创造的世界... 例如：一个三国时期的谋士学院，六位来自不同派系的谋士争夺军师之位..."
            value={worldPrompt}
            onChange={(e) => setWorldPrompt(e.target.value)}
            rows={4}
            disabled={isAnalyzing}
          />
          <div className="create-world-input-actions">
            <button
              className="btn-pokemon btn-pokemon-secondary text-xs"
              onClick={() => setShowApiConfig(!showApiConfig)}
            >
              {showApiConfig ? "收起配置" : "API 配置"}
            </button>
            <button
              className="btn-pokemon btn-pokemon-primary"
              onClick={handleAnalyze}
              disabled={!worldPrompt.trim() || isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <span className="animate-pulse-glow">&#9670;</span> 分析世界中...
                </>
              ) : (
                "开始分析"
              )}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="create-world-error">
            {error}
          </div>
        )}

        {/* API 配置折叠区 */}
        {showApiConfig && (
          <div className="create-world-api-config animate-fade-in">
            <div className="create-world-api-title">API 配置</div>
            <div className="create-world-api-fields">
              <div>
                <label className="text-xs text-[--color-text-dim] block mb-1">API Key *</label>
                <input
                  type="password"
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  placeholder="你的 API 密钥"
                  className="create-world-input"
                />
              </div>
              <div>
                <label className="text-xs text-[--color-text-dim] block mb-1">模型 *</label>
                <input
                  type="text"
                  value={localModel}
                  onChange={(e) => setLocalModel(e.target.value)}
                  placeholder="如 doubao-seed-2-0-pro-260215"
                  className="create-world-input"
                />
              </div>
              <div>
                <label className="text-xs text-[--color-text-dim] block mb-1">API 地址</label>
                <input
                  type="text"
                  value={localBaseUrl}
                  onChange={(e) => setLocalBaseUrl(e.target.value)}
                  className="create-world-input text-xs font-mono"
                />
              </div>
              <button className="btn-pokemon btn-pokemon-primary w-full" onClick={handleSaveApi}>
                保存配置
              </button>
            </div>
          </div>
        )}

        {/* 预设世界 */}
        <div className="create-world-presets">
          <div className="create-world-presets-label">或选择预设世界</div>
          <div className="create-world-presets-grid">
            {PRESET_LIST.map((preset) => (
              <button
                key={preset.id}
                className="create-world-preset-card"
                onClick={() => handlePresetSelect(preset)}
                disabled={isAnalyzing}
              >
                <div className="create-world-preset-emoji">{preset.emoji}</div>
                <div className="create-world-preset-label">{preset.label}</div>
                <div className="create-world-preset-tagline">{preset.tagline}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
