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
import { simulateTick, applyResult } from "../../engine.js";

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

  // 执行一个 tick
  const executeTick = useCallback(async () => {
    if (isSimulatingRef.current) return;
    if (!worldConfig || npcs.length === 0) return;

    isSimulatingRef.current = true;
    setIsNarrativeLoading(true);

    try {
      // 添加章节分隔
      const timeStr = `第${gameTime.day}天 ${String(gameTime.hour).padStart(2, "0")}:00`;
      const scheduleItem = schedule?.find((s) => s.hour === gameTime.hour);
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
      const result = await simulateTick(apiConfig, worldConfig, npcs, gameTime, intervention);

      // 应用结果到 NPC 状态
      const updatedNpcs = applyResult([...npcs.map((n) => ({ ...n }))], result);
      setNpcs(updatedNpcs);

      // 构建叙事条目
      const entries = [];

      // 旁白
      if (result.narrations) {
        for (const narration of result.narrations) {
          entries.push({ type: "narration", text: narration });
        }
      }

      // 对话
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

      // 摘要作为旁白
      if (result.sum) {
        entries.push({ type: "narration", text: result.sum });
      }

      // NPC 思考
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

      // 张力/冲突提示
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

      // 交错排列叙事和对话
      const interleaved = [];
      let ni = 0, di = 0;
      const narrations = entries.filter((e) => e.type === "narration");
      const dialogues = entries.filter((e) => e.type === "dialogue");
      const others = entries.filter((e) => e.type !== "narration" && e.type !== "dialogue");

      while (ni < narrations.length || di < dialogues.length) {
        if (ni < narrations.length) interleaved.push(narrations[ni++]);
        // 每段旁白后接 1-2 段对话
        if (di < dialogues.length) interleaved.push(dialogues[di++]);
        if (di < dialogues.length) interleaved.push(dialogues[di++]);
      }
      interleaved.push(...others);

      appendNarratives(interleaved);

      // 推进时间
      setGameTime(getNextTime(gameTime));

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
  }, [worldConfig, npcs, apiConfig, gameTime, schedule, pendingIntervention]);

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
