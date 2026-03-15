/**
 * 世界总览面板 — 资源仪表盘、张力热力图、事件流
 */
import React from "react";
import { useStore } from "../../store/useStore.jsx";
import ProgressBar from "../common/ProgressBar.jsx";

function ResourceDashboard({ resources }) {
  if (!resources) return null;

  return (
    <div className="panel-section">
      <div className="panel-section-title">&#128200; 资源仪表盘</div>
      <div className="space-y-3">
        {Object.entries(resources).map(([key, res]) => {
          if (res.total) {
            const pct = Math.round((res.current / res.total) * 100);
            const color = pct > 60 ? "#22c55e" : pct > 30 ? "#ffd700" : "#e94560";
            return (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[--color-text]">{res.name}</span>
                  <span className="text-[--color-text-dim]">{res.current}/{res.total}</span>
                </div>
                <ProgressBar value={res.current} max={res.total} color={color} height={6} />
                <div className="text-xs text-[--color-text-dim] mt-0.5">{res.desc}</div>
              </div>
            );
          }
          return (
            <div key={key} className="text-xs">
              <span className="text-[--color-text]">{res.name}:</span>{" "}
              <span className="text-[--color-text-dim]">{res.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TensionMap({ npcs }) {
  // 简易张力热力图 — 显示 NPC 之间的关系紧张度
  const tensions = [];
  for (const npc of npcs) {
    if (!npc.relationships) continue;
    for (const [targetId, rel] of Object.entries(npc.relationships)) {
      const gap = Math.abs((rel.inner || 0) - (rel.outer || 0));
      if (gap > 10) {
        const target = npcs.find((n) => n.id === targetId);
        if (target) {
          tensions.push({
            from: npc,
            to: target,
            gap,
            inner: rel.inner,
            outer: rel.outer,
          });
        }
      }
    }
  }

  // 按城府差距排序
  tensions.sort((a, b) => b.gap - a.gap);

  return (
    <div className="panel-section">
      <div className="panel-section-title">&#128293; 张力热力图</div>
      {tensions.length === 0 ? (
        <div className="text-xs text-[--color-text-dim]">暂无明显张力</div>
      ) : (
        <div className="space-y-2">
          {tensions.slice(0, 8).map((t, i) => {
            const intensity = Math.min(1, t.gap / 50);
            return (
              <div key={i} className="tension-item" style={{ borderLeftColor: `rgba(233, 69, 96, ${0.3 + intensity * 0.7})` }}>
                <div className="flex items-center gap-1 text-xs">
                  <span>{t.from.emoji}</span>
                  <span className="text-[--color-text-dim]">&#10132;</span>
                  <span>{t.to.emoji} {t.to.name}</span>
                </div>
                <div className="flex gap-3 text-xs mt-0.5">
                  <span className="text-[--color-text-dim]">
                    内心 <span style={{ color: t.inner > 0 ? "#22c55e" : "#e94560" }}>{t.inner > 0 ? "+" : ""}{t.inner}</span>
                  </span>
                  <span className="text-[--color-text-dim]">
                    表面 <span style={{ color: t.outer > 0 ? "#22c55e" : "#e94560" }}>{t.outer > 0 ? "+" : ""}{t.outer}</span>
                  </span>
                  <span className="text-xs text-[--color-negative]">城府差 {t.gap}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventTimeline({ narrativeHistory }) {
  // 提取事件类型的叙事
  const events = narrativeHistory.filter((e) => e.type === "event" || e.type === "chapter").slice(-10);

  return (
    <div className="panel-section">
      <div className="panel-section-title">&#128220; 事件流</div>
      {events.length === 0 ? (
        <div className="text-xs text-[--color-text-dim]">等待世界运转...</div>
      ) : (
        <div className="space-y-1">
          {events.map((ev, i) => (
            <div key={i} className="text-xs text-[--color-text-dim]">
              {ev.type === "chapter" ? (
                <span className="text-[--color-accent]">{ev.time}</span>
              ) : (
                <span>{ev.emoji || "&#9679;"} {ev.text}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NpcStatusGrid({ npcs }) {
  return (
    <div className="panel-section">
      <div className="panel-section-title">&#128101; 进化总览</div>
      <div className="npc-status-grid">
        {npcs.map((npc) => {
          const moodColor = (npc.state?.moodValue || 50) >= 70 ? "#22c55e" : (npc.state?.moodValue || 50) >= 40 ? "#ffd700" : "#e94560";
          return (
            <div key={npc.id} className="npc-status-mini">
              <span className="text-sm">{npc.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[--color-text] truncate">{npc.name}</div>
                <div className="text-xs text-[--color-text-dim]">{npc.state?.mood || "平静"}</div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <div className="w-8 h-1.5 rounded-sm overflow-hidden" style={{ background: "#0e1119" }}>
                  <div className="h-full rounded-sm" style={{ width: `${npc.state?.moodValue || 50}%`, background: moodColor }} />
                </div>
                <div className="w-8 h-1.5 rounded-sm overflow-hidden" style={{ background: "#0e1119" }}>
                  <div className="h-full rounded-sm" style={{ width: `${npc.state?.energy || 50}%`, background: "#3b82f6" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WorldOverview() {
  const { worldConfig, npcs, narrativeHistory } = useStore();

  return (
    <div className="panel-scroll">
      <ResourceDashboard resources={worldConfig?.resources} />
      <NpcStatusGrid npcs={npcs} />
      <TensionMap npcs={npcs} />
      <EventTimeline narrativeHistory={narrativeHistory} />
    </div>
  );
}
