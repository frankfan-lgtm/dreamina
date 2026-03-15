/**
 * 右侧透视面板容器 — 根据 selectedNpcId 切换世界总览 / NPC 档案
 */
import React from "react";
import { useStore } from "../../store/useStore.js";
import WorldOverview from "./WorldOverview.jsx";
import NPCProfile from "./NPCProfile.jsx";
import NpcSelector from "./NpcSelector.jsx";

export default function InspectorPanel() {
  const { selectedNpcId, npcs } = useStore();

  const selectedNpc = selectedNpcId ? npcs.find((n) => n.id === selectedNpcId) : null;

  return (
    <div className="inspector-panel">
      {/* 面板标题 */}
      <div className="panel-header-pokemon">
        {selectedNpc ? (
          <span>{selectedNpc.emoji} {selectedNpc.name} 档案</span>
        ) : (
          <span>&#128270; 世界透视</span>
        )}
      </div>

      {/* 内容区 */}
      <div className="inspector-panel-body">
        {selectedNpcId ? <NPCProfile /> : <WorldOverview />}
      </div>

      {/* 底部 NPC 选择栏 */}
      <NpcSelector />
    </div>
  );
}
