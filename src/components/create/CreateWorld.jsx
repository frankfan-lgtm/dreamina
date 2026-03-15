/**
 * 世界创建页 — 用户描述世界或选择预设
 * 包含API配置、世界描述输入、预设卡片
 */
import React, { useState, useEffect } from "react";
import { useStore } from "../../store/useStore.js";
import { WORLD_PRESETS, generateWorld } from "../../sdk/index.js";

// 预设列表（从SDK加载 + 扩展占位）
const PRESETS = [
  { id: "office", ...WORLD_PRESETS.office },
  { id: "hogwarts", ...WORLD_PRESETS.hogwarts },
  { id: "stock", emoji: "📈", label: "股市博弈", tagline: "多空对决，贪婪与恐惧的博弈场", disabled: true },
  { id: "worldcup", emoji: "⚽", label: "世界杯", tagline: "32支球队的荣耀之战", disabled: true },
];

export default function CreateWorld() {
  const {
    apiConfig, setApiConfig,
    worldPrompt, setWorldPrompt,
    selectedPreset, setSelectedPreset,
    setCurrentPage, setWorldAnalysis, setWorldConfig,
    setNpcs, setRelationships, setSchedule, setNpcStations, setSpriteColors,
  } = useStore();

  const [showApiConfig, setShowApiConfig] = useState(!apiConfig.apiKey);
  const [localApi, setLocalApi] = useState({ ...apiConfig });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  // 选择预设后直接进入运行时（预设世界不需要分析和构建）
  const handlePresetSelect = (preset) => {
    if (preset.disabled) return;
    const world = WORLD_PRESETS[preset.id];
    if (!world) return;

    // 检查API配置
    if (!apiConfig.apiKey) {
      setShowApiConfig(true);
      setError("请先配置 API Key");
      return;
    }

    setSelectedPreset(preset.id);
    // 直接加载预设世界数据
    setWorldConfig(world.config);
    const initNpcs = world.npcs.map((npc) => ({
      ...JSON.parse(JSON.stringify(npc)),
      action: "",
      thought: "",
      decisionChain: "",
      relationships: world.relationships[npc.id] || {},
    }));
    setNpcs(initNpcs);
    setRelationships(world.relationships);
    setSchedule(world.schedule);
    setNpcStations(world.npcStations);
    setSpriteColors(world.spriteColors);
    // 直接跳到运行时
    setCurrentPage("runtime");
  };

  // 自定义世界 → 分析
  const handleAnalyze = async () => {
    if (!worldPrompt.trim()) return;
    if (!apiConfig.apiKey) {
      setShowApiConfig(true);
      setError("请先配置 API Key");
      return;
    }

    setIsAnalyzing(true);
    setError("");

    try {
      // 调用世界生成器
      const result = await generateWorld(worldPrompt, apiConfig);
      setWorldAnalysis(result);
      setCurrentPage("analysis");
    } catch (e) {
      setError(e.message || "分析失败");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveApiConfig = () => {
    if (!localApi.apiKey.trim() || !localApi.model.trim()) return;
    setApiConfig({
      apiKey: localApi.apiKey.trim(),
      baseUrl: localApi.baseUrl.trim(),
      model: localApi.model.trim(),
    });
    setShowApiConfig(false);
    setError("");
  };

  return (
    <div className="create-world-page">
      {/* 背景光效 */}
      <div className="create-world-glow" />

      <div className="create-world-content">
        {/* 标题区 */}
        <div className="create-world-header">
          <div className="create-world-star">✦</div>
          <h1 className="create-world-title">Dreamina</h1>
          <p className="create-world-subtitle">创造你的世界</p>
          <p className="create-world-desc">
            描述一个世界，AI 自动生成角色和规则，每个角色作为独立智能体自主行动
          </p>
        </div>

        {/* API 配置区 */}
        {showApiConfig && (
          <div className="create-api-config animate-fade-in">
            <div className="create-api-config-title">API 配置</div>
            <div className="create-api-field">
              <label>API Key *</label>
              <input
                type="password"
                value={localApi.apiKey}
                onChange={(e) => setLocalApi({ ...localApi, apiKey: e.target.value })}
                placeholder="你的 API 密钥"
              />
            </div>
            <div className="create-api-field">
              <label>模型 *</label>
              <input
                type="text"
                value={localApi.model}
                onChange={(e) => setLocalApi({ ...localApi, model: e.target.value })}
                placeholder="如 doubao-seed-2-0-pro-260215"
              />
            </div>
            <div className="create-api-field">
              <label>API 地址</label>
              <input
                type="text"
                value={localApi.baseUrl}
                onChange={(e) => setLocalApi({ ...localApi, baseUrl: e.target.value })}
                className="text-xs"
              />
              <span className="create-api-hint">默认火山引擎 ARK，兼容 OpenAI 格式</span>
            </div>
            <button className="btn-pokemon btn-pokemon-primary w-full" onClick={saveApiConfig}>
              保存配置
            </button>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="create-error animate-fade-in">{error}</div>
        )}

        {/* 输入区 */}
        <div className="create-input-area">
          <textarea
            className="create-textarea"
            value={worldPrompt}
            onChange={(e) => setWorldPrompt(e.target.value)}
            placeholder="描述你想创造的世界...&#10;&#10;例如：三国时期，曹操刚刚统一北方，与刘备、孙权形成三足鼎立。&#10;或者：一所高中，即将迎来高考，六个性格迥异的学生..."
            rows={4}
          />
          <div className="create-input-actions">
            <button
              className="btn-pokemon btn-pokemon-secondary"
              onClick={() => setShowApiConfig(!showApiConfig)}
            >
              {apiConfig.apiKey ? "⚙ 修改API" : "⚙ 配置API"}
            </button>
            <button
              className="btn-pokemon btn-pokemon-primary"
              onClick={handleAnalyze}
              disabled={!worldPrompt.trim() || isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <span className="narrative-loading-dots">
                    <span /><span /><span />
                  </span>
                  分析中...
                </>
              ) : (
                "🔮 开始分析"
              )}
            </button>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="create-divider">
          <div className="create-divider-line" />
          <span className="create-divider-text">或选择预设世界</span>
          <div className="create-divider-line" />
        </div>

        {/* 预设卡片 */}
        <div className="create-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`create-preset-card ${preset.disabled ? "disabled" : ""} ${selectedPreset === preset.id ? "active" : ""}`}
              onClick={() => handlePresetSelect(preset)}
              disabled={preset.disabled}
            >
              <div className="create-preset-emoji">{preset.emoji}</div>
              <div className="create-preset-label">{preset.label}</div>
              <div className="create-preset-tagline">{preset.tagline}</div>
              {preset.disabled && <div className="create-preset-badge">即将推出</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
