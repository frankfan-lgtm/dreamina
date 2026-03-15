/**
 * 通用进度条组件 — 像素风格
 */
import React from "react";

export default function ProgressBar({ value = 0, max = 100, color = "#ffd700", height = 8, label, showPercent = false }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-[--color-text-dim]">{label}</span>
          {showPercent && <span className="text-xs text-[--color-text-dim]">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className="w-full rounded-sm border border-[--color-border] overflow-hidden"
        style={{ height, background: "#0e1119" }}
      >
        <div
          className="h-full rounded-sm transition-all duration-500"
          style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? 2 : 0 }}
        />
      </div>
    </div>
  );
}
