/**
 * 顶部状态栏 — 世界名称、时间、播放控制、导演开关、天命按钮
 */
import React, { useState } from "react";
import { useStore } from "../../store/useStore.js";

export default function TopBar() {
  const {
    worldConfig, gameTime, isRunning, setIsRunning,
    speed, setSpeed, directorMode, setDirectorMode,
    pendingIntervention, setPendingIntervention,
    resetToCreate,
  } = useStore();

  const [showInterventions, setShowInterventions] = useState(false);

  const timeStr = `第${gameTime.day}天 ${String(gameTime.hour).padStart(2, "0")}:00`;

  const interventions = worldConfig?.interventions || [];

  return (
    <div className="sim-header">
      {/* 左侧：世界名称 + 时间 */}
      <div className="flex items-center gap-3">
        <button
          className="text-xs text-[--color-text-dim] hover:text-[--color-accent] transition-colors"
          onClick={resetToCreate}
          title="返回创建页"
        >
          &#9666;
        </button>
        <span className="text-sm font-bold text-[--color-accent]">
          &#10022; {worldConfig?.name || "未知世界"}
        </span>
        <span className="text-xs text-[--color-text-dim] font-mono">{timeStr}</span>
      </div>

      {/* 中间：播放控制 */}
      <div className="flex items-center gap-2">
        <button
          className="btn-pokemon btn-pokemon-primary text-xs px-2 py-0.5"
          onClick={() => setIsRunning(!isRunning)}
        >
          {isRunning ? "⏸" : "▶"} {isRunning ? "暂停" : "运行"}
        </button>
        <select
          className="speed-select"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>

      {/* 右侧：导演模式 + 天命 */}
      <div className="flex items-center gap-2">
        {/* 导演模式 */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-[--color-text-dim]">&#127916; 导演:</span>
          <select
            className="speed-select"
            value={directorMode}
            onChange={(e) => setDirectorMode(e.target.value)}
          >
            <option value="auto">自动</option>
            <option value="manual">手动</option>
            <option value="off">关闭</option>
          </select>
        </div>

        {/* 天命按钮 */}
        <div className="relative">
          <button
            className="btn-pokemon btn-pokemon-danger text-xs"
            onClick={() => setShowInterventions(!showInterventions)}
          >
            &#9889; 天命
          </button>

          {/* 干预事件下拉 */}
          {showInterventions && interventions.length > 0 && (
            <div className="intervention-dropdown animate-fade-in">
              {interventions.map((ev) => (
                <button
                  key={ev.id}
                  className="intervention-option"
                  onClick={() => {
                    setPendingIntervention(ev.id);
                    setShowInterventions(false);
                  }}
                >
                  <span>{ev.emoji}</span>
                  <div>
                    <div className="text-xs font-bold text-[--color-text]">{ev.name}</div>
                    <div className="text-xs text-[--color-text-dim]">{ev.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
