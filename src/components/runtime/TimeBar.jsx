/**
 * 底部时间条 — 播放/暂停、进度条、速度选择
 */
import React from "react";
import { useStore } from "../../store/useStore.jsx";

// 一天 6 个 tick: 7,10,13,16,19,22
const HOURS = [7, 10, 13, 16, 19, 22];
const DAY_START = 7;
const DAY_END = 22;
const DAY_SPAN = DAY_END - DAY_START; // 15 小时

export default function TimeBar() {
  const { gameTime, isRunning, setIsRunning, speed, setSpeed, schedule } = useStore();

  // 计算进度
  const hourProgress = Math.max(0, Math.min(1, (gameTime.hour - DAY_START) / DAY_SPAN));

  // 获取当前时段标签
  const currentSchedule = schedule?.find((s) => s.hour === gameTime.hour);
  const scheduleLabel = currentSchedule?.label || "";

  return (
    <div className="time-bar">
      {/* 播放/暂停 */}
      <button
        className="btn-pokemon btn-pokemon-primary text-xs px-2 py-0.5"
        onClick={() => setIsRunning(!isRunning)}
      >
        {isRunning ? "⏸" : "▶"}
      </button>

      {/* 时间线轨道 */}
      <div className="timeline-track">
        <div className="timeline-fill" style={{ width: `${hourProgress * 100}%` }} />
        <div className="timeline-markers">
          {HOURS.map((h) => {
            const pos = ((h - DAY_START) / DAY_SPAN) * 100;
            return (
              <React.Fragment key={h}>
                <div className="timeline-marker" style={{ left: `${pos}%` }} />
                <span className="timeline-hour-label" style={{ left: `${pos}%` }}>
                  {h}:00
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 当前时间 */}
      <span className="text-xs text-[--color-accent] font-bold font-mono whitespace-nowrap">
        Day {gameTime.day} {String(gameTime.hour).padStart(2, "0")}:00
      </span>

      {/* 速度 */}
      <select className="speed-select" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
        <option value={0.5}>0.5x</option>
        <option value={1}>1x</option>
        <option value={2}>2x</option>
        <option value={4}>4x</option>
      </select>

      {/* 时段标签 */}
      {scheduleLabel && (
        <span className="text-xs text-[--color-text-dim] hidden md:inline">{scheduleLabel}</span>
      )}
    </div>
  );
}
