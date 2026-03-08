import React, { useState } from "react";

export default function App() {
  const [phase, setPhase] = useState("select"); // "select" | "running"

  return (
    <div className="min-h-screen bg-bg text-text font-serif">
      {phase === "select" ? (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <h1 className="text-4xl font-bold text-accent mb-2">🌌 创世模拟器</h1>
          <p className="text-text-dim mb-8">选择一个世界，观察文明的涌现</p>
          <div className="grid grid-cols-2 gap-4 max-w-2xl w-full">
            {[
              { emoji: "🏢", name: "职场暗战", tagline: "互联网公司的权力游戏" },
              { emoji: "🏝️", name: "荒岛求生", tagline: "文明崩塌后的人性试炼" },
              { emoji: "👑", name: "宫斗风云", tagline: "深宫之中无真情" },
              { emoji: "🌿", name: "原始部落", tagline: "文明的第一缕曙光" },
            ].map((t, i) => (
              <button
                key={i}
                onClick={() => setPhase("running")}
                className="bg-card border border-border rounded-lg p-6 text-left hover:bg-card-hover hover:border-accent transition-all cursor-pointer"
              >
                <div className="text-3xl mb-2">{t.emoji}</div>
                <div className="text-lg font-semibold text-accent">{t.name}</div>
                <div className="text-sm text-text-dim mt-1">{t.tagline}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-2xl mb-4">🌍 世界运行中...</p>
            <button
              onClick={() => setPhase("select")}
              className="text-accent hover:underline cursor-pointer"
            >
              ← 返回选择
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
