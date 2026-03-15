/**
 * 世界分析确认页 — 展示 V2 WorldAnalyst 分析结果
 */
import React from "react";
import { useStore } from "../../store/useStore.jsx";

export default function WorldAnalysisView() {
  const {
    worldAnalysis, worldConfig, npcs,
    setCurrentPage, resetToCreate,
  } = useStore();

  if (!worldAnalysis) return null;

  const handleStartBuild = () => {
    setCurrentPage("building");
  };

  // V2 分析数据
  const isV2 = !!worldAnalysis._needsBuild;

  return (
    <div className="analysis-page">
      <div className="analysis-page-bg" />

      <div className="analysis-content">
        {/* 标题 */}
        <div className="analysis-header">
          <span className="analysis-icon">&#128302;</span>
          <h1 className="analysis-title">
            {isV2 ? "V2 世界分析蓝图" : "世界分析"}
          </h1>
        </div>

        {/* 世界概览卡片 */}
        <div className="analysis-overview-card">
          <h2 className="analysis-world-name">{worldAnalysis.name || worldAnalysis.worldName}</h2>
          <p className="analysis-world-desc">{worldAnalysis.description || worldAnalysis.worldDescription}</p>

          <div className="analysis-meta-row">
            <div className="analysis-meta-item">
              <span className="analysis-meta-label">类型</span>
              <span className="analysis-meta-value">
                {worldAnalysis.type === "narrative" ? "叙事型" : worldAnalysis.type === "prediction" ? "预测型" : "混合型"}
              </span>
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
            {worldAnalysis.tone && (
              <>
                <div className="analysis-meta-divider" />
                <div className="analysis-meta-item">
                  <span className="analysis-meta-label">基调</span>
                  <span className="analysis-meta-value">{worldAnalysis.tone}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* V2: 建议地点 */}
        {worldAnalysis.suggestedLocations?.length > 0 && (
          <div className="analysis-section">
            <div className="analysis-section-title">建议地点</div>
            <div className="analysis-resource-list">
              {worldAnalysis.suggestedLocations.map((loc) => (
                <div key={loc.id} className="analysis-resource-item">
                  <span className="analysis-resource-name">{loc.name}</span>
                  <span className="analysis-resource-desc">{loc.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 角色预览（预设路径才有） */}
        {!isV2 && (worldAnalysis.npcs?.length > 0 || npcs.length > 0) && (
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
        )}

        {/* V2: NPC 数量建议 */}
        {isV2 && worldAnalysis.complexity && (
          <div className="analysis-section">
            <div className="analysis-section-title">NPC 设计建议</div>
            <div className="analysis-resource-list">
              <div className="analysis-resource-item">
                <span className="analysis-resource-name">建议 {worldAnalysis.complexity.suggestedNpcCount} 个角色</span>
                <span className="analysis-resource-desc">{worldAnalysis.complexity.reasoning}</span>
              </div>
            </div>
          </div>
        )}

        {/* 资源 */}
        {worldAnalysis.resources && Object.keys(worldAnalysis.resources).length > 0 && (
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
                  <span>{typeof conflict === "string" ? conflict : conflict.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* V2: 建议规则 */}
        {worldAnalysis.suggestedRules?.length > 0 && (
          <div className="analysis-section">
            <div className="analysis-section-title">世界规则</div>
            <div className="analysis-conflict-list">
              {worldAnalysis.suggestedRules.map((rule, i) => (
                <div key={i} className="analysis-conflict-item">
                  <span className="analysis-conflict-icon">&#128220;</span>
                  <span>{rule}</span>
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
            &#128640; {isV2 ? "V2 多Agent构建" : "开始构建"}
          </button>
        </div>
      </div>
    </div>
  );
}
