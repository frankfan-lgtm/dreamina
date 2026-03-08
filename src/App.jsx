import React, { useState, useEffect, useRef, useCallback } from "react";
import { TEMPLATES } from "./templates.js";
import { simulateTick, applyResult } from "./engine.js";

// ─── 工具函数 ───
function moodColor(val) {
  if (val >= 7) return "#5a9868";
  if (val >= 4) return "#c08850";
  return "#a85050";
}

function sentimentColor(val) {
  if (val > 0) return "#5a9868";
  if (val < 0) return "#a85050";
  return "#605868";
}

// API Key 不再需要，通过本地服务器调用 Claude CLI

// ─── 世界选择页 ───
function WorldSelectScreen({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold text-accent mb-2">🌌 选择你的世界</h1>
      <p className="text-text-dim mb-8">选择一个世界模板，开始观察文明的涌现</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="bg-card border border-border rounded-lg p-6 text-left hover:bg-card-hover hover:border-accent transition-all cursor-pointer group"
          >
            <div className="text-4xl mb-3">{t.emoji}</div>
            <div className="text-lg font-semibold text-accent group-hover:underline">
              {t.name}
            </div>
            <div className="text-sm text-text-dim mt-1 mb-3">{t.tagline}</div>
            <div className="text-xs text-text-dim leading-relaxed">{t.description}</div>
            <div className="mt-3 flex gap-1">
              {t.npcs.map((n) => (
                <span key={n.id} title={n.name} className="text-lg">
                  {n.emoji}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 地图区域卡片 ───
function RegionCard({ region, npcs, selectedNPC, onSelectNPC }) {
  const present = npcs.filter((n) => n.region === region.id);
  return (
    <div className="bg-card border border-border rounded-lg p-3 min-h-[100px]">
      <div className="text-sm text-text-dim mb-2">
        {region.emoji} {region.name}
      </div>
      <div className="flex flex-wrap gap-2">
        {present.map((npc) => (
          <button
            key={npc.id}
            onClick={() => onSelectNPC(npc.id === selectedNPC ? null : npc.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-sm cursor-pointer transition-all ${
              npc.id === selectedNPC
                ? "bg-accent/20 border border-accent"
                : "bg-bg hover:bg-card-hover border border-transparent"
            }`}
          >
            <span className="text-base">{npc.emoji}</span>
            <span>{npc.name}</span>
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: moodColor(npc.moodValue) }}
            />
          </button>
        ))}
        {present.length === 0 && (
          <span className="text-xs text-text-dim italic">空无一人</span>
        )}
      </div>
    </div>
  );
}

// ─── NPC 详情面板（跟踪视角）───
function NPCDetail({ npc, allNpcs }) {
  return (
    <div className="animate-fade-in space-y-4">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{npc.emoji}</span>
        <div>
          <div className="font-semibold text-accent">{npc.name}</div>
          <div className="text-sm text-text-dim flex items-center gap-2">
            {npc.mood}
            <div className="w-20 h-2 bg-bg rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${npc.moodValue * 10}%`,
                  backgroundColor: moodColor(npc.moodValue),
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 内心独白 */}
      {npc.thought && (
        <div className="bg-bg rounded-lg p-3 border border-border">
          <div className="text-xs text-text-dim mb-1">💭 内心独白</div>
          <div className="text-sm italic">"{npc.thought}"</div>
        </div>
      )}

      {/* 当前行为 */}
      {npc.action && (
        <div className="bg-bg rounded-lg p-3 border border-border">
          <div className="text-xs text-text-dim mb-1">🎬 当前行为</div>
          <div className="text-sm">{npc.action}</div>
        </div>
      )}

      {/* 记忆 */}
      {npc.memories && npc.memories.length > 0 && (
        <div>
          <div className="text-xs text-text-dim mb-2">🧠 记忆</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...npc.memories].reverse().map((m, i) => (
              <div key={i} className="text-xs bg-bg rounded px-2 py-1 border border-border">
                {m}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 关系 */}
      {npc.relationships && Object.keys(npc.relationships).length > 0 && (
        <div>
          <div className="text-xs text-text-dim mb-2">🤝 关系</div>
          <div className="space-y-1">
            {Object.entries(npc.relationships).map(([tid, rel]) => {
              const target = allNpcs.find((n) => n.id === tid);
              if (!target) return null;
              return (
                <div
                  key={tid}
                  className="flex items-center justify-between text-xs bg-bg rounded px-2 py-1 border border-border"
                >
                  <span>
                    {target.emoji} {target.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-text-dim">{rel.notes}</span>
                    <span
                      className="font-semibold"
                      style={{ color: sentimentColor(rel.sentiment) }}
                    >
                      {rel.sentiment > 0 ? "+" : ""}
                      {rel.sentiment}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 性格 */}
      <div>
        <div className="text-xs text-text-dim mb-1">📝 性格</div>
        <div className="text-xs leading-relaxed">{npc.personality}</div>
      </div>
    </div>
  );
}

// ─── 编年史（上帝视角）───
function Chronicle({ events }) {
  if (events.length === 0) {
    return (
      <div className="text-center text-text-dim py-8">
        <div className="text-3xl mb-2">📜</div>
        <div className="text-sm">世界尚未开始书写历史...</div>
        <div className="text-xs mt-1">点击「下一天」开始模拟</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-xs text-text-dim mb-2">📜 世界编年史</div>
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {[...events].reverse().map((ev, i) => (
          <div
            key={i}
            className="text-sm bg-bg rounded-lg px-3 py-2 border border-border animate-fade-in"
          >
            <span className="text-accent font-semibold">第{ev.tick}天</span>{" "}
            {ev.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 对话流 ───
function DialogueStream({ dialogues, npcs }) {
  const npcMap = {};
  for (const n of npcs) npcMap[n.id] = n;

  if (dialogues.length === 0) {
    return (
      <div className="text-center text-text-dim py-4 text-sm">
        还没有对话发生...
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {[...dialogues]
        .reverse()
        .slice(0, 25)
        .map((d, i) => {
          const from = npcMap[d.from];
          const to = npcMap[d.to];
          return (
            <div key={i} className="text-sm animate-fade-in">
              <span className="text-text-dim text-xs">[第{d.tick}天]</span>{" "}
              <span>{from?.emoji || "?"}{from?.name || d.from}</span>
              <span className="text-text-dim"> → </span>
              <span>{to?.emoji || "?"}{to?.name || d.to}</span>{" "}
              <span className="text-accent">"{d.content}"</span>
            </div>
          );
        })}
    </div>
  );
}

// ─── 主模拟界面 ───
function SimulationScreen({ template, apiKey, onBack }) {
  const [npcs, setNpcs] = useState(() =>
    template.npcs.map((n) => ({
      ...n,
      memories: [],
      relationships: {},
      action: "",
      thought: "",
    }))
  );
  const [tick, setTick] = useState(1);
  const [events, setEvents] = useState([]);
  const [dialogues, setDialogues] = useState([]);
  const [selectedNPC, setSelectedNPC] = useState(null);
  const [pendingIntervention, setPendingIntervention] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const playRef = useRef(false);

  const advanceDay = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const result = await simulateTick(apiKey, template, npcs, tick, pendingIntervention);
      const updatedNpcs = applyResult(npcs, result);
      setNpcs(updatedNpcs);

      if (result.sum) {
        setEvents((prev) => [...prev, { tick, text: result.sum }]);
      }

      if (result.talks && Array.isArray(result.talks)) {
        const newDialogues = result.talks.map((t) => ({
          tick,
          from: t.f,
          to: t.t,
          content: t.s,
        }));
        setDialogues((prev) => [...prev, ...newDialogues]);
      }

      setPendingIntervention(null);
      setTick((t) => t + 1);
    } catch (e) {
      setError(e.message);
      setIsPlaying(false);
      playRef.current = false;
    } finally {
      setIsBusy(false);
    }
  }, [apiKey, template, npcs, tick, pendingIntervention, isBusy]);

  // 自动模式
  useEffect(() => {
    playRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      if (playRef.current && !isBusy) {
        advanceDay();
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [isPlaying, isBusy, tick, advanceDay]);

  const selectedNpcData = npcs.find((n) => n.id === selectedNPC);

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶栏 */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-text-dim hover:text-accent transition-colors cursor-pointer"
          >
            ← 返回
          </button>
          <span className="text-lg">
            {template.emoji} {template.name}
          </span>
          <span className="text-text-dim text-sm">第{tick}天</span>
          {isBusy && (
            <span className="text-accent text-sm animate-pulse-glow">⟳ 推演中...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={advanceDay}
            disabled={isBusy}
            className="bg-accent/20 border border-accent text-accent px-4 py-1.5 rounded-lg text-sm hover:bg-accent/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ▶ 下一天
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-4 py-1.5 rounded-lg text-sm border transition-colors cursor-pointer ${
              isPlaying
                ? "bg-negative/20 border-negative text-negative"
                : "bg-card border-border text-text-dim hover:border-accent hover:text-accent"
            }`}
          >
            {isPlaying ? "⏸ 暂停" : "⏩ 自动"}
          </button>
        </div>
      </header>

      {/* 天命干预栏 */}
      <div className="border-b border-border px-4 py-2 bg-card/50 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-dim mr-1">🌩️ 天命:</span>
        {template.interventions.map((iv) => (
          <button
            key={iv.id}
            onClick={() =>
              setPendingIntervention(pendingIntervention === iv.id ? null : iv.id)
            }
            title={iv.description}
            className={`px-3 py-1 rounded-md text-xs border transition-all cursor-pointer ${
              pendingIntervention === iv.id
                ? "bg-accent/20 border-accent text-accent"
                : "bg-card border-border text-text-dim hover:border-accent hover:text-accent"
            }`}
          >
            {iv.emoji} {iv.name}
          </button>
        ))}
        {pendingIntervention && (
          <span className="text-xs text-accent ml-2">
            ⚡ 下次推演时生效
          </span>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-2 bg-negative/10 border border-negative rounded-lg px-4 py-2 text-sm text-negative">
          {error}
        </div>
      )}

      {/* 主体 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：地图 + 对话 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 地图 3×2 */}
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 gap-3">
              {template.regions.map((r) => (
                <RegionCard
                  key={r.id}
                  region={r}
                  npcs={npcs}
                  selectedNPC={selectedNPC}
                  onSelectNPC={setSelectedNPC}
                />
              ))}
            </div>
          </div>

          {/* 对话流 */}
          <div className="border-t border-border px-4 py-3 bg-card/30">
            <div className="text-xs text-text-dim mb-2">💬 众生之声</div>
            <DialogueStream dialogues={dialogues} npcs={npcs} />
          </div>
        </div>

        {/* 右侧面板 */}
        <aside className="w-80 border-l border-border bg-card/30 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {selectedNpcData ? (
              <NPCDetail npc={selectedNpcData} allNpcs={npcs} />
            ) : (
              <Chronicle events={events} />
            )}
          </div>

          {/* NPC 快速选择栏 */}
          <div className="border-t border-border px-4 py-2 flex items-center justify-center gap-1">
            <button
              onClick={() => setSelectedNPC(null)}
              className={`px-2 py-1 rounded text-xs cursor-pointer transition-all ${
                !selectedNPC
                  ? "bg-accent/20 text-accent"
                  : "text-text-dim hover:text-accent"
              }`}
            >
              📜
            </button>
            {npcs.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelectedNPC(n.id === selectedNPC ? null : n.id)}
                title={n.name}
                className={`px-1.5 py-1 rounded text-base cursor-pointer transition-all ${
                  n.id === selectedNPC
                    ? "bg-accent/20 ring-1 ring-accent"
                    : "hover:bg-card-hover"
                }`}
              >
                {n.emoji}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── App Root ───
export default function App() {
  const [phase, setPhase] = useState("select");
  const [template, setTemplate] = useState(null);

  if (phase === "select") {
    return (
      <WorldSelectScreen
        onSelect={(t) => {
          setTemplate(t);
          setPhase("running");
        }}
      />
    );
  }

  return (
    <SimulationScreen
      key={template.id}
      template={template}
      apiKey=""
      onBack={() => {
        setTemplate(null);
        setPhase("select");
      }}
    />
  );
}
