/**
 * 世界分析确认页 — 展示分析结果，确认后进入构建
 */
import React from "react";
import { useStore } from "../../store/useStore.js";

export default function WorldAnalysisView() {
  const {
    worldAnalysis, worldConfig, npcs,
    setCurrentPage, resetToCreate,
  } = useStore();

  if (!worldAnalysis) return null;

  const handleStartBuild = () => {
    setCurrentPage("building");
  };

  return (
    <div className="analysis-page">
      <div className="analysis-page-bg" />

      <div className="analysis-content">
        {/* 标题 */}
        <div className="analysis-header">
          <span className="analysis-icon">&#128302;</span>
          <h1 className="analysis-title">世界分析</h1>
        </div>

        {/* 世界概览卡片 */}
        <div className="analysis-overview-card">
          <h2 className="analysis-world-name">{worldAnalysis.name}</h2>
          <p className="analysis-world-desc">{worldAnalysis.description}</p>

          <div className="analysis-meta-row">
            <div className="analysis-meta-item">
              <span className="analysis-meta-label">类型</span>
              <span className="analysis-meta-value">叙事型</span>
            </div>
            <div className="analysis-meta-divider" />
            <div className="analysis-meta-item">
              <span className="analysis-meta-label">感知</span>
              <span className="analysis-meta-value">{worldAnalysis.perception || "virtual"}</span>
            </div>
            <div className="analysis-meta-divider" />
            <div className="analysis-meta-item">
              <span className="analysis-meta-label">NPC</span>
              <span className="analysis-meta-value">{worldAnalysis.npcCount || npcs.length}个</span>
            </div>
          </div>
        </div>

        {/* 角色预览 */}
        <div className="analysis-section">
          <div className="analysis-section-title">角色预览</div>
          <div className="analysis-npc-grid">
            {(worldAnalysis.npcs || npcs).map((npc) => (
              <div key={npc.id} className="analysis-npc-card">
                <div className="analysis-npc-emoji">{npc.emoji}</div>
                <div className="analysis-npc-name">{npc.name}</div>
                <div className="analysis-npc-title">{npc.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 资源 */}
        {worldAnalysis.resources && (
          <div className="analysis-section">
            <div className="analysis-section-title">有限资源</div>
            <div className="analysis-resource-list">
              {Object.entries(worldAnalysis.resources).map(([key, res]) => (
                <div key={key} className="analysis-resource-item">
                  <span className="analysis-resource-name">{res.name}</span>
                  {res.total && (
                    <span className="analysis-resource-value">{res.current}/{res.total}</span>
                  )}
                  <span className="analysis-resource-desc">{res.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 关键冲突 */}
        {worldAnalysis.conflicts && worldAnalysis.conflicts.length > 0 && (
          <div className="analysis-section">
            <div className="analysis-section-title">潜在冲突</div>
            <div className="analysis-conflict-list">
              {worldAnalysis.conflicts.map((conflict, i) => (
                <div key={i} className="analysis-conflict-item">
                  <span className="analysis-conflict-icon">&#9889;</span>
                  <span>{conflict}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="analysis-actions">
          <button className="btn-pokemon btn-pokemon-secondary" onClick={resetToCreate}>
            返回调整
          </button>
          <button className="btn-pokemon btn-pokemon-primary analysis-build-btn" onClick={handleStartBuild}>
            &#128640; 开始构建
          </button>
        </div>
      </div>
    </div>
  );
}
