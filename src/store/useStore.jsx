/**
 * 全局状态管理 — React Context + useState
 * 不依赖外部状态管理库
 */
import React, { createContext, useContext, useState, useCallback, useRef } from "react";

const StoreContext = createContext(null);

// 本地存储 key
const STORAGE_KEY = "dreamina_api_config";

// 读取已保存的 API 配置
function loadApiConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { apiKey: "94090db7-6585-460e-a8ff-7830c1516624", baseUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions", model: "doubao-seed-2-0-lite-260215" };
}

export function StoreProvider({ children }) {
  // ─── 页面导航 ───
  const [currentPage, setCurrentPage] = useState("create"); // create | analysis | building | runtime

  // ─── API 配置 ───
  const [apiConfig, setApiConfigState] = useState(loadApiConfig);
  const setApiConfig = useCallback((cfg) => {
    setApiConfigState(cfg);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
  }, []);

  // ─── 世界描述（用户输入或选择预设） ───
  const [worldPrompt, setWorldPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(null);

  // ─── 世界分析结果 ───
  const [worldAnalysis, setWorldAnalysis] = useState(null);

  // ─── 世界配置（构建完成后） ───
  const [worldConfig, setWorldConfig] = useState(null);
  const [npcs, setNpcs] = useState([]);
  const [relationships, setRelationships] = useState({});
  const [schedule, setSchedule] = useState([]);
  const [npcStations, setNpcStations] = useState({});
  const [spriteColors, setSpriteColors] = useState({});

  // ─── 构建进度 ───
  const [buildSteps, setBuildSteps] = useState([]);
  const [buildProgress, setBuildProgress] = useState(0);

  // ─── 运行时状态 ───
  const [gameTime, setGameTime] = useState({ day: 1, hour: 7 });
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [directorMode, setDirectorMode] = useState("auto"); // auto | manual | off

  // ─── 叙事历史 ───
  const [narrativeHistory, setNarrativeHistory] = useState([]);
  const [isNarrativeLoading, setIsNarrativeLoading] = useState(false);

  // ─── 面板状态 ───
  const [selectedNpcId, setSelectedNpcId] = useState(null);

  // ─── 干预事件 ───
  const [pendingIntervention, setPendingIntervention] = useState(null);

  // ─── 追加叙事条目 ───
  const appendNarrative = useCallback((entry) => {
    setNarrativeHistory((prev) => [...prev, entry]);
  }, []);

  // ─── 批量追加叙事 ───
  const appendNarratives = useCallback((entries) => {
    setNarrativeHistory((prev) => [...prev, ...entries]);
  }, []);

  // ─── 更新单个 NPC ───
  const updateNpc = useCallback((npcId, updater) => {
    setNpcs((prev) =>
      prev.map((npc) => (npc.id === npcId ? (typeof updater === "function" ? updater(npc) : { ...npc, ...updater }) : npc))
    );
  }, []);

  // ─── 重置到创建页 ───
  const resetToCreate = useCallback(() => {
    setCurrentPage("create");
    setWorldAnalysis(null);
    setWorldConfig(null);
    setNpcs([]);
    setRelationships({});
    setNarrativeHistory([]);
    setSelectedNpcId(null);
    setGameTime({ day: 1, hour: 7 });
    setIsRunning(false);
    setBuildSteps([]);
    setBuildProgress(0);
  }, []);

  const value = {
    // 页面
    currentPage, setCurrentPage,
    // API
    apiConfig, setApiConfig,
    // 世界描述
    worldPrompt, setWorldPrompt,
    selectedPreset, setSelectedPreset,
    // 分析
    worldAnalysis, setWorldAnalysis,
    // 世界数据
    worldConfig, setWorldConfig,
    npcs, setNpcs,
    relationships, setRelationships,
    schedule, setSchedule,
    npcStations, setNpcStations,
    spriteColors, setSpriteColors,
    // 构建
    buildSteps, setBuildSteps,
    buildProgress, setBuildProgress,
    // 运行时
    gameTime, setGameTime,
    isRunning, setIsRunning,
    speed, setSpeed,
    directorMode, setDirectorMode,
    // 叙事
    narrativeHistory, setNarrativeHistory,
    isNarrativeLoading, setIsNarrativeLoading,
    appendNarrative, appendNarratives,
    // 面板
    selectedNpcId, setSelectedNpcId,
    // 干预
    pendingIntervention, setPendingIntervention,
    // NPC
    updateNpc,
    // 重置
    resetToCreate,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore 必须在 StoreProvider 内使用");
  return ctx;
}
