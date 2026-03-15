/**
 * 世界构建进度页 — 显示构建师的工作进度
 */
import React, { useEffect, useState, useRef } from "react";
import { useStore } from "../../store/useStore.jsx";
import ProgressBar from "../common/ProgressBar.jsx";

// 构建步骤定义
const BUILD_STEP_DEFS = [
  { id: "init", label: "初始化世界引擎", icon: "&#9881;" },
  { id: "locations", label: "生成世界地点", icon: "&#127758;" },
  { id: "npcs", label: "创建 NPC 灵魂", icon: "&#129302;" },
  { id: "relationships", label: "编织关系网络", icon: "&#129309;" },
  { id: "resources", label: "配置有限资源", icon: "&#128176;" },
  { id: "schedule", label: "设定时间轴", icon: "&#9200;" },
  { id: "director", label: "唤醒导演系统", icon: "&#127916;" },
  { id: "ready", label: "世界构建完成", icon: "&#10024;" },
];

export default function BuildingProgress() {
  const { npcs, worldConfig, setCurrentPage, buildSteps, setBuildSteps, buildProgress, setBuildProgress } = useStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedNpcs, setCompletedNpcs] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    // 模拟构建过程
    let step = 0;
    const totalSteps = BUILD_STEP_DEFS.length;

    const advance = () => {
      if (step >= totalSteps) {
        clearInterval(timerRef.current);
        // 延迟后跳转到运行时
        setTimeout(() => setCurrentPage("runtime"), 800);
        return;
      }

      setCurrentStep(step);
      setBuildProgress(Math.round(((step + 1) / totalSteps) * 100));

      // NPC 创建步骤时，逐个显示 NPC
      if (BUILD_STEP_DEFS[step].id === "npcs" && npcs.length > 0) {
        npcs.forEach((npc, i) => {
          setTimeout(() => {
            setCompletedNpcs((prev) => [...prev, npc]);
          }, (i + 1) * 300);
        });
      }

      setBuildSteps((prev) => {
        const updated = [...prev];
        // 标记当前步骤完成
        if (step > 0) {
          updated[step - 1] = { ...BUILD_STEP_DEFS[step - 1], status: "done" };
        }
        updated[step] = { ...BUILD_STEP_DEFS[step], status: "active" };
        // 填充后续步骤
        for (let i = step + 1; i < totalSteps; i++) {
          if (!updated[i]) updated[i] = { ...BUILD_STEP_DEFS[i], status: "pending" };
        }
        return updated;
      });

      step++;
    };

    // 初始化步骤列表
    setBuildSteps(BUILD_STEP_DEFS.map((s) => ({ ...s, status: "pending" })));

    advance(); // 立即开始第一步
    timerRef.current = setInterval(advance, 1200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="building-page">
      <div className="building-page-bg" />

      <div className="building-content">
        <div className="building-header">
          <h1 className="building-title">
            <span className="building-title-icon animate-pulse-glow">&#9881;</span>
            世界构建中
          </h1>
          <p className="building-subtitle">{worldConfig?.name || "未知世界"}</p>
        </div>

        {/* 总进度条 */}
        <div className="building-progress-bar">
          <ProgressBar value={buildProgress} color="#ffd700" height={12} showPercent />
        </div>

        {/* 步骤列表 */}
        <div className="building-steps">
          {(buildSteps.length > 0 ? buildSteps : BUILD_STEP_DEFS.map((s) => ({ ...s, status: "pending" }))).map((step, i) => (
            <div
              key={step.id}
              className={`building-step ${step.status === "done" ? "building-step-done" : ""} ${step.status === "active" ? "building-step-active" : ""} ${step.status === "pending" ? "building-step-pending" : ""}`}
            >
              <div className="building-step-icon">
                {step.status === "done" ? "✓" : step.status === "active" ? (
                  <span className="animate-pulse-glow" dangerouslySetInnerHTML={{ __html: step.icon }} />
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: step.icon }} />
                )}
              </div>
              <div className="building-step-label">{step.label}</div>
              {step.status === "active" && (
                <div className="building-step-spinner">
                  <span className="narrative-loading-dots">
                    <span /><span /><span />
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* NPC 逐个出现 */}
        {completedNpcs.length > 0 && (
          <div className="building-npc-reveal">
            <div className="building-npc-reveal-title">角色已就位</div>
            <div className="building-npc-reveal-grid">
              {completedNpcs.map((npc) => (
                <div key={npc.id} className="building-npc-card animate-fade-in">
                  <span className="building-npc-emoji">{npc.emoji}</span>
                  <span className="building-npc-name">{npc.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
