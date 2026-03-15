/**
 * 运行时主界面布局容器
 * 左侧叙事流 + 右侧透视面板 + 顶部状态栏 + 底部时间条
 */
import React, { useEffect, useRef, useCallback } from "react";
import { useStore } from "../../store/useStore.jsx";
import TopBar from "./TopBar.jsx";
import TimeBar from "./TimeBar.jsx";
import NarrativeStream from "./NarrativeStream.jsx";
import InspectorPanel from "../panel/InspectorPanel.jsx";
import { simulateTick, applyResult, getAgent } from "../../engine/SimulationAdapter.js";

// 每个 tick 的时间间隔 3 小时: 7→10→13→16→19→22→下一天7
const TICK_HOURS = [7, 10, 13, 16, 19, 22];

function getNextTime(current) {
  const idx = TICK_HOURS.indexOf(current.hour);
  if (idx === -1 || idx >= TICK_HOURS.length - 1) {
    return { day: current.day + 1, hour: TICK_HOURS[0] };
  }
  return { day: current.day, hour: TICK_HOURS[idx + 1] };
}

export default function SimulationRuntime() {
  const {
    worldConfig, npcs, setNpcs, apiConfig,
    gameTime, setGameTime,
    isRunning, setIsRunning,
    speed,
    appendNarrative, appendNarratives,
    setIsNarrativeLoading,
    pendingIntervention, setPendingIntervention,
    schedule,
  } = useStore();

  const isSimulatingRef = useRef(false);
  const runningRef = useRef(isRunning);
  runningRef.current = isRunning;
  const npcsRef = useRef(npcs);
  npcsRef.current = npcs;
  const gameTimeRef = useRef(gameTime);
  gameTimeRef.current = gameTime;

  // 执行一个 tick
  const executeTick = useCallback(async () => {
    if (isSimulatingRef.current) return;
    const currentNpcs = npcsRef.current;
    const currentGameTime = gameTimeRef.current;
    if (!worldConfig || currentNpcs.length === 0) return;

    isSimulatingRef.current = true;
    setIsNarrativeLoading(true);

    try {
      // 添加章节分隔
      const timeStr = `第${currentGameTime.day}天 ${String(currentGameTime.hour).padStart(2, "0")}:00`;
      const scheduleItem = schedule?.find((s) => s.hour === currentGameTime.hour);
      appendNarrative({
        type: "chapter",
        time: `${timeStr} ${scheduleItem?.label || ""}`,
      });

      // 干预事件
      const intervention = pendingIntervention;
      if (intervention) {
        const ev = worldConfig.interventions?.find((i) => i.id === intervention);
        if (ev) {
          appendNarrative({
            type: "event",
            emoji: ev.emoji,
            text: `【天命】${ev.name}: ${ev.description}`,
          });
        }
        setPendingIntervention(null);
      }

      // 调用模拟引擎
      const result = await simulateTick(apiConfig, worldConfig, currentNpcs, currentGameTime, intervention);

      // 应用结果到 NPC 状态
      const updatedNpcs = applyResult([...currentNpcs.map((n) => ({ ...n }))], result);
      // 合并 V2 Agent 的记忆和决策链数据（供面板展示）
      for (const npc of updatedNpcs) {
        const agent = getAgent(npc.id);
        if (agent) {
          const agentState = agent.getState();
          npc.memories = agentState.memories;
          npc.decisionChain = agentState.decisionChain;
          npc.personality = agentState.personality;
        }
      }
      setNpcs(updatedNpcs);

      // 构建叙事条目 — 优先使用V2导演叙事，降级到V1兼容格式
      const entries = [];

      if (result.director?.narrative?.length > 0) {
        // V2 导演叙事：直接使用导演编排的叙事序列
        for (const item of result.director.narrative) {
          switch (item.type) {
            case "narration":
              entries.push({ type: "narration", text: item.text });
              break;
            case "dialogue":
              entries.push({
                type: "dialogue",
                from: item.from,
                to: item.to,
                text: item.content,
                subtext: item.subtext,
              });
              break;
            case "info_gap":
              entries.push({
                type: "info_gap",
                text: item.description,
                details: item.involvedNpcs?.join(" & ") || "",
              });
              break;
            case "thought":
              entries.push({
                type: "thought",
                npcId: item.npcId,
                text: item.text,
              });
              break;
            default:
              entries.push({ type: "narration", text: item.text || item.description || "" });
          }
        }

        // 张力提示（高等级的）
        if (result.director.tensions) {
          for (const tension of result.director.tensions) {
            if (tension.level >= 4) {
              entries.push({
                type: "info_gap",
                text: `${tension.between.join(" vs ")} — ${tension.about}`,
                details: `张力等级: ${tension.level}/5`,
              });
            }
          }
        }
      } else {
        // V1 降级：从结构化字段构建叙事
        if (result.narrations) {
          for (const narration of result.narrations) {
            entries.push({ type: "narration", text: narration });
          }
        }
        if (result.talks) {
          for (const talk of result.talks) {
            entries.push({
              type: "dialogue",
              from: talk.f,
              to: talk.t,
              text: talk.s,
              subtext: talk.subtext,
            });
          }
        }
        if (result.sum) {
          entries.push({ type: "narration", text: result.sum });
        }
        if (result.npcs) {
          for (const npcResult of result.npcs) {
            if (npcResult.th) {
              entries.push({
                type: "thought",
                npcId: npcResult.id,
                text: npcResult.th,
              });
            }
          }
        }
        if (result.tensions) {
          for (const tension of result.tensions) {
            if (tension.level >= 4) {
              entries.push({
                type: "info_gap",
                text: `${tension.between.join(" vs ")} — ${tension.about}`,
                details: `张力等级: ${tension.level}/5`,
              });
            }
          }
        }
      }

      appendNarratives(entries);

      // 推进时间（函数式更新，避免闭包读取旧值）
      setGameTime(prev => getNextTime(prev));

    } catch (err) {
      console.error("Tick 执行失败:", err);
      appendNarrative({
        type: "event",
        emoji: "&#9888;",
        text: `模拟出错: ${err.message}`,
      });
      setIsRunning(false);
    } finally {
      isSimulatingRef.current = false;
      setIsNarrativeLoading(false);
    }
  }, [worldConfig, apiConfig, schedule, pendingIntervention]);

  // 自动运行循环
  useEffect(() => {
    if (!isRunning) return;

    const interval = setTimeout(() => {
      if (runningRef.current) {
        executeTick();
      }
    }, 500 / speed); // 速度控制

    return () => clearTimeout(interval);
  }, [isRunning, gameTime, speed, executeTick]);

  return (
    <div className="simulation-layout">
      <TopBar />
      <NarrativeStream />
      <InspectorPanel />
      <TimeBar />
    </div>
  );
}
