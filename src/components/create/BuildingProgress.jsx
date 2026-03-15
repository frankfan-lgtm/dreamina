/**
 * 世界构建进度页 — V2 真实构建流程
 * 调用 WorldArchitect 生成世界 + initAgents 初始化多Agent
 */
import React, { useEffect, useState, useRef } from "react";
import { useStore } from "../../store/useStore.jsx";
import ProgressBar from "../common/ProgressBar.jsx";
import { WorldArchitect } from "../../agents/index.js";
import { initAgents } from "../../engine/SimulationAdapter.js";

// 构建步骤定义
const BUILD_STEP_DEFS = [
  { id: "init", label: "初始化世界引擎", icon: "&#9881;" },
  { id: "architect", label: "世界构建师生成蓝图", icon: "&#127758;" },
  { id: "npcs", label: "创建 NPC 灵魂基因", icon: "&#129302;" },
  { id: "relationships", label: "编织关系网络", icon: "&#129309;" },
  { id: "resources", label: "配置有限资源", icon: "&#128176;" },
  { id: "agents", label: "唤醒独立 Agent 意识", icon: "&#129504;" },
  { id: "director", label: "唤醒导演系统", icon: "&#127916;" },
  { id: "ready", label: "世界构建完成", icon: "&#10024;" },
];

function updateStep(setBuildSteps, stepIndex, status) {
  setBuildSteps((prev) => {
    const updated = [...prev];
    if (stepIndex > 0 && updated[stepIndex - 1]?.status === "active") {
      updated[stepIndex - 1] = { ...updated[stepIndex - 1], status: "done" };
    }
    if (updated[stepIndex]) {
      updated[stepIndex] = { ...updated[stepIndex], status };
    }
    return updated;
  });
}

export default function BuildingProgress() {
  const {
    worldAnalysis, apiConfig,
    npcs, setNpcs,
    worldConfig, setWorldConfig,
    setRelationships, setSchedule,
    setCurrentPage, buildSteps, setBuildSteps,
    buildProgress, setBuildProgress,
  } = useStore();

  const [completedNpcs, setCompletedNpcs] = useState([]);
  const [buildError, setBuildError] = useState("");
  const buildingRef = useRef(false);

  useEffect(() => {
    if (buildingRef.current) return;
    buildingRef.current = true;

    // 初始化步骤列表
    setBuildSteps(BUILD_STEP_DEFS.map((s) => ({ ...s, status: "pending" })));

    runBuild();

    async function runBuild() {
      const needsBuild = worldAnalysis?._needsBuild && !worldConfig;

      try {
        // Step 0: 初始化引擎
        updateStep(setBuildSteps, 0, "active");
        setBuildProgress(5);
        await delay(400);

        if (needsBuild) {
          // ── V2 路径：WorldArchitect 真实构建 ──

          // Step 1: 世界构建师生成蓝图
          updateStep(setBuildSteps, 0, "done");
          updateStep(setBuildSteps, 1, "active");
          setBuildProgress(15);

          const architect = new WorldArchitect(apiConfig, {
            maxRetries: 2,
            timeout: 180000,
          });
          const buildResult = await architect.buildWorld(worldAnalysis);

          setBuildProgress(40);
          updateStep(setBuildSteps, 1, "done");

          // Step 2: 创建 NPC 灵魂
          updateStep(setBuildSteps, 2, "active");

          const builtNpcs = buildResult.npcs.map((npc) => ({
            ...npc,
            location: npc.region,
            action: "",
            thought: "",
            decisionChain: "",
            relationships: buildResult.initialRelationships[npc.id] || {},
          }));

          // 逐个显示 NPC
          for (let i = 0; i < builtNpcs.length; i++) {
            await delay(300);
            setCompletedNpcs((prev) => [...prev, builtNpcs[i]]);
          }

          setNpcs(builtNpcs);
          setWorldConfig(buildResult.worldConfig);
          setRelationships(buildResult.initialRelationships);
          setBuildProgress(55);
          updateStep(setBuildSteps, 2, "done");

          // Step 3: 编织关系
          updateStep(setBuildSteps, 3, "active");
          await delay(600);
          setBuildProgress(65);
          updateStep(setBuildSteps, 3, "done");

          // Step 4: 配置资源
          updateStep(setBuildSteps, 4, "active");
          await delay(400);
          setBuildProgress(75);
          updateStep(setBuildSteps, 4, "done");

          // Step 5: 唤醒 Agent
          updateStep(setBuildSteps, 5, "active");
          initAgents(apiConfig, builtNpcs);
          await delay(500);
          setBuildProgress(85);
          updateStep(setBuildSteps, 5, "done");

          // Step 6: 唤醒导演
          updateStep(setBuildSteps, 6, "active");
          await delay(400);
          setBuildProgress(95);
          updateStep(setBuildSteps, 6, "done");

        } else {
          // ── 预设路径：世界数据已就绪，只需初始化 Agent ──

          // 快速推进前置步骤
          for (let i = 0; i <= 4; i++) {
            updateStep(setBuildSteps, i, "active");
            await delay(400);
            setBuildProgress(10 + i * 15);
            updateStep(setBuildSteps, i, "done");
          }

          // NPC 逐个显示
          if (npcs.length > 0) {
            for (let i = 0; i < npcs.length; i++) {
              await delay(200);
              setCompletedNpcs((prev) => [...prev, npcs[i]]);
            }
          }

          // Step 5: 唤醒 Agent
          updateStep(setBuildSteps, 5, "active");
          initAgents(apiConfig, npcs);
          await delay(500);
          setBuildProgress(85);
          updateStep(setBuildSteps, 5, "done");

          // Step 6: 唤醒导演
          updateStep(setBuildSteps, 6, "active");
          await delay(400);
          setBuildProgress(95);
          updateStep(setBuildSteps, 6, "done");
        }

        // Step 7: 完成
        updateStep(setBuildSteps, 7, "active");
        setBuildProgress(100);
        await delay(300);
        updateStep(setBuildSteps, 7, "done");

        // 跳转到运行时
        await delay(500);
        setCurrentPage("runtime");

      } catch (err) {
        console.error("[BuildingProgress] 构建失败:", err);
        setBuildError(err.message);
      }
    }
  }, []);

  return (
    <div className="building-page">
      <div className="building-page-bg" />

      <div className="building-content">
        <div className="building-header">
          <h1 className="building-title">
            <span className="building-title-icon animate-pulse-glow">&#9881;</span>
            {worldAnalysis?._needsBuild ? "V2 多Agent世界构建中" : "世界初始化中"}
          </h1>
          <p className="building-subtitle">{worldConfig?.name || worldAnalysis?.name || "未知世界"}</p>
        </div>

        {/* 总进度条 */}
        <div className="building-progress-bar">
          <ProgressBar value={buildProgress} color="#ffd700" height={12} showPercent />
        </div>

        {/* 步骤列表 */}
        <div className="building-steps">
          {(buildSteps.length > 0 ? buildSteps : BUILD_STEP_DEFS.map((s) => ({ ...s, status: "pending" }))).map((step) => (
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
            <div className="building-npc-reveal-title">Agent 灵魂已就位</div>
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

        {/* 构建错误 */}
        {buildError && (
          <div className="create-world-error" style={{ marginTop: "1rem" }}>
            构建失败: {buildError}
            <button
              className="btn-pokemon btn-pokemon-secondary"
              style={{ marginLeft: "1rem" }}
              onClick={() => setCurrentPage("analysis")}
            >
              返回调整
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
