/**
 * Dreamina V2 — AI 多智能体世界模拟引擎
 * 主应用组件：页面路由 + 全局 Provider
 */
import React from "react";
import { StoreProvider, useStore } from "./store/useStore.js";
import CreateWorld from "./components/create/CreateWorld.jsx";
import WorldAnalysisView from "./components/create/WorldAnalysisView.jsx";
import BuildingProgress from "./components/create/BuildingProgress.jsx";
import SimulationRuntime from "./components/runtime/SimulationRuntime.jsx";

// ─── 页面路由（用 state 切换，不用路由库）───
function PageRouter() {
  const { currentPage } = useStore();

  switch (currentPage) {
    case "create":
      return <CreateWorld />;
    case "analysis":
      return <WorldAnalysisView />;
    case "building":
      return <BuildingProgress />;
    case "runtime":
      return <SimulationRuntime />;
    default:
      return <CreateWorld />;
  }
}

export default function App() {
  return (
    <StoreProvider>
      <PageRouter />
    </StoreProvider>
  );
}
