/**
 * NPC 选择栏 — 面板底部的 emoji 按钮列表
 */
import React from "react";
import { useStore } from "../../store/useStore.jsx";

export default function NpcSelector() {
  const { npcs, selectedNpcId, setSelectedNpcId } = useStore();

  return (
    <div className="npc-selector-bar">
      {/* 世界总览按钮 */}
      <button
        className={`npc-selector-btn ${selectedNpcId === null ? "active" : ""}`}
        onClick={() => setSelectedNpcId(null)}
        title="世界总览"
      >
        &#127758;
      </button>

      {/* 分隔线 */}
      <div className="w-px h-5 bg-[--color-border] mx-1" />

      {/* NPC 按钮 */}
      {npcs.map((npc) => (
        <button
          key={npc.id}
          className={`npc-selector-btn ${selectedNpcId === npc.id ? "active" : ""}`}
          onClick={() => setSelectedNpcId(selectedNpcId === npc.id ? null : npc.id)}
          title={`${npc.name} — ${npc.title}`}
        >
          {npc.emoji}
        </button>
      ))}
    </div>
  );
}
