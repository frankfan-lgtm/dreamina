import React, { useState, useEffect, useRef, useCallback } from "react";
import { WORLD_CONFIG, NPCS, INITIAL_RELATIONSHIPS, SCHEDULE_TEMPLATE } from "./world.js";
import { simulateTick, applyResult } from "./engine.js";

// ─── 工具函数 ───
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function moodColor(val) {
  if (val >= 70) return "#5a9868";
  if (val >= 40) return "#c08850";
  return "#a85050";
}

function relColor(val) {
  if (val > 30) return "#5a9868";
  if (val > 0) return "#7a9860";
  if (val > -30) return "#c08850";
  return "#a85050";
}

function barStr(val, max = 100) {
  const pct = Math.round((val / max) * 100);
  return `${pct}%`;
}

const STORAGE_KEY = "dreamina_api_config";

// ─── 初始化NPC状态 ───
function initNpcs() {
  return NPCS.map((npc) => ({
    ...JSON.parse(JSON.stringify(npc)),
    action: "",
    thought: "",
    decisionChain: "",
    relationships: INITIAL_RELATIONSHIPS[npc.id] || {},
  }));
}

// ─── API设置页 ───
function ApiSetupScreen({ config, onSave }) {
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || "https://ark.cn-beijing.volces.com/api/v3/chat/completions");
  const [model, setModel] = useState(config.model || "doubao-seed-2-0-pro-260215");
  const canSave = apiKey.trim() && model.trim();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="text-5xl mb-4 pixel-text">🏢</div>
      <h1 className="text-2xl font-bold text-accent mb-2">像素办公室</h1>
      <p className="text-text-dim mb-1 text-sm">AI 世界模拟引擎 — 观察生命的涌现</p>
      <p className="text-text-dim mb-8 text-xs">首次使用需要配置 API</p>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4">
        <div>
          <label className="text-xs text-text-dim block mb-1">API Key *</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="你的 API 密钥"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none" />
        </div>
        <div>
          <label className="text-xs text-text-dim block mb-1">模型 / 接入点 ID *</label>
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
            placeholder="如 doubao-seed-2-0-pro-260215"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none" />
        </div>
        <div>
          <label className="text-xs text-text-dim block mb-1">API 地址</label>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none font-mono text-xs" />
          <p className="text-xs text-text-dim mt-1">默认火山引擎 ARK，兼容 OpenAI 格式</p>
        </div>
        <button onClick={() => canSave && onSave({ apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() })}
          disabled={!canSave}
          className="w-full bg-accent/20 border border-accent text-accent py-2 rounded-lg text-sm hover:bg-accent/30 transition-colors cursor-pointer disabled:opacity-40">
          进入像素办公室
        </button>
      </div>
    </div>
  );
}

// ─── 像素地图区块 ───
function PixelMap({ locations, npcs, selectedNPC, onSelectNPC }) {
  return (
    <div className="pixel-map">
      {locations.map((loc) => {
        const present = npcs.filter((n) => n.region === loc.id);
        return (
          <div key={loc.id} className="pixel-room" style={{ "--room-color": loc.color }}>
            <div className="pixel-room-label">
              <span>{loc.emoji}</span>
              <span>{loc.name}</span>
            </div>
            <div className="pixel-room-floor">
              {present.map((npc) => (
                <button key={npc.id}
                  onClick={() => onSelectNPC(npc.id === selectedNPC ? null : npc.id)}
                  className={`pixel-npc ${npc.id === selectedNPC ? "selected" : ""}`}
                  title={`${npc.name} - ${npc.state.mood}`}>
                  <span className="pixel-npc-sprite">{npc.emoji}</span>
                  <span className="pixel-npc-name">{npc.name}</span>
                  {npc.thought && (
                    <div className="pixel-bubble thought">
                      💭 {npc.thought.length > 15 ? npc.thought.slice(0, 15) + "..." : npc.thought}
                    </div>
                  )}
                  {npc.action && !npc.thought && (
                    <div className="pixel-bubble action">
                      {npc.action.length > 15 ? npc.action.slice(0, 15) + "..." : npc.action}
                    </div>
                  )}
                  <div className="pixel-npc-bars">
                    <div className="mini-bar" title={`情绪 ${npc.state.moodValue}`}>
                      <div className="mini-bar-fill" style={{ width: barStr(npc.state.moodValue), backgroundColor: moodColor(npc.state.moodValue) }} />
                    </div>
                  </div>
                </button>
              ))}
              {present.length === 0 && <span className="pixel-empty">· · ·</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 对话流（气泡）───
function DialogueStream({ dialogues, npcs }) {
  const npcMap = {};
  for (const n of npcs) npcMap[n.id] = n;
  if (dialogues.length === 0) return <div className="text-center text-text-dim py-2 text-xs">等待世界运转...</div>;

  return (
    <div className="space-y-1 max-h-36 overflow-y-auto">
      {[...dialogues].reverse().slice(0, 20).map((d, i) => {
        const from = npcMap[d.from];
        const to = npcMap[d.to];
        return (
          <div key={i} className="text-xs animate-fade-in flex gap-1 items-start">
            <span className="text-text-dim shrink-0">[{d.day}d {d.hour}h]</span>
            <span className="shrink-0">{from?.emoji}{from?.name}</span>
            <span className="text-text-dim">→</span>
            <span className="shrink-0">{to?.emoji}{to?.name}</span>
            <span className="text-accent">"{d.content}"</span>
            {d.subtext && <span className="text-text-dim italic">({d.subtext})</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── 世界仪表盘（右侧默认）───
function WorldDashboard({ world, npcs, events, tensions, gameTime }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="text-center">
        <div className="text-xl mb-1">🏢 {world.name}</div>
        <div className="text-xs text-text-dim">第{gameTime.day}天 {String(gameTime.hour).padStart(2, "0")}:00</div>
      </div>

      {/* 资源仪表盘 */}
      <div>
        <div className="panel-section-title">📊 有限资源</div>
        <div className="space-y-2">
          {Object.entries(world.resources).map(([key, res]) => (
            <div key={key} className="bg-bg rounded px-2 py-1.5 border border-border">
              <div className="flex justify-between text-xs">
                <span>{res.name}</span>
                {res.total && <span className="text-accent">{res.current}/{res.total}</span>}
              </div>
              {res.total && (
                <div className="w-full h-1.5 bg-border rounded mt-1">
                  <div className="h-full rounded transition-all" style={{
                    width: `${(res.current / res.total) * 100}%`,
                    backgroundColor: res.current < res.total * 0.5 ? "#a85050" : "#5a9868"
                  }} />
                </div>
              )}
              <div className="text-[10px] text-text-dim mt-0.5">{res.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 张力热力图 */}
      {tensions.length > 0 && (
        <div>
          <div className="panel-section-title">🔥 张力热力图</div>
          <div className="space-y-1">
            {tensions.map((t, i) => {
              const a = npcs.find((n) => n.id === t.between[0]);
              const b = npcs.find((n) => n.id === t.between[1]);
              return (
                <div key={i} className="bg-bg rounded px-2 py-1 border border-border text-xs flex items-center gap-2">
                  <span>{a?.emoji}{a?.name}</span>
                  <span className="text-negative">{"⚡".repeat(Math.min(t.level, 5))}</span>
                  <span>{b?.emoji}{b?.name}</span>
                  <span className="text-text-dim ml-auto">{t.about}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 事件流 */}
      <div>
        <div className="panel-section-title">📜 事件编年史</div>
        {events.length === 0 ? (
          <div className="text-xs text-text-dim text-center py-4">世界尚未开始...</div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {[...events].reverse().map((ev, i) => (
              <div key={i} className="text-xs bg-bg rounded px-2 py-1.5 border border-border animate-fade-in">
                <span className="text-accent font-semibold">D{ev.day} {ev.hour}h</span> {ev.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 世界规则 */}
      <div>
        <div className="panel-section-title">📋 世界规则</div>
        <div className="space-y-1">
          {world.rules.map((rule, i) => (
            <div key={i} className="text-[10px] text-text-dim">· {rule}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── NPC档案面板（7个tab）───
function NPCPanel({ npc, allNpcs }) {
  const [tab, setTab] = useState("soul");
  const tabs = [
    { id: "soul", label: "灵魂", icon: "🧬" },
    { id: "goals", label: "目标", icon: "🎯" },
    { id: "memory", label: "记忆", icon: "🧠" },
    { id: "skills", label: "技能", icon: "⚡" },
    { id: "state", label: "状态", icon: "📊" },
    { id: "relations", label: "关系", icon: "🤝" },
    { id: "decision", label: "决策", icon: "💡" },
  ];

  return (
    <div className="animate-fade-in flex flex-col h-full">
      {/* NPC头部 */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <span className="text-3xl">{npc.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-accent">{npc.name}</div>
          <div className="text-xs text-text-dim">{npc.title} | {npc.age}岁</div>
          <div className="text-xs text-text-dim mt-0.5 truncate">{npc.state.mood} | 压力{npc.state.pressure} | 精力{npc.state.energy}</div>
        </div>
      </div>

      {/* Tab栏 */}
      <div className="flex gap-0.5 py-2 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-2 py-1 rounded text-[10px] cursor-pointer transition-all whitespace-nowrap ${
              tab === t.id ? "bg-accent/20 text-accent" : "text-text-dim hover:text-accent"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab内容 */}
      <div className="flex-1 overflow-y-auto pt-3 space-y-3">
        {tab === "soul" && <SoulTab npc={npc} />}
        {tab === "goals" && <GoalsTab npc={npc} />}
        {tab === "memory" && <MemoryTab npc={npc} />}
        {tab === "skills" && <SkillsTab npc={npc} />}
        {tab === "state" && <StateTab npc={npc} />}
        {tab === "relations" && <RelationsTab npc={npc} allNpcs={allNpcs} />}
        {tab === "decision" && <DecisionTab npc={npc} />}
      </div>
    </div>
  );
}

// ── 灵魂/基因 Tab ──
function SoulTab({ npc }) {
  const { gene, personality } = npc;
  return (
    <div className="space-y-3">
      <div className="text-xs text-text-dim">{npc.background}</div>

      <div>
        <div className="panel-section-title">核心驱力</div>
        {Object.entries(gene.core_drives).map(([k, v]) => (
          <GeneBar key={k} label={k} value={v} />
        ))}
      </div>

      <div>
        <div className="panel-section-title">认知风格</div>
        {Object.entries(gene.cognitive_style).map(([k, v]) => (
          <GeneBar key={k} label={k} value={v} />
        ))}
      </div>

      <div>
        <div className="panel-section-title">天赋基因</div>
        {Object.entries(gene.talent_genes).map(([k, v]) => (
          <GeneBar key={k} label={k} value={v} color="#c08850" />
        ))}
      </div>

      <div>
        <div className="panel-section-title">情绪基线</div>
        {Object.entries(gene.emotional_baseline).map(([k, v]) => (
          <GeneBar key={k} label={k} value={v} color="#8868a0" />
        ))}
      </div>

      {gene.mutation_log.length > 0 && (
        <div>
          <div className="panel-section-title">🔀 突变历史</div>
          {gene.mutation_log.map((m, i) => (
            <div key={i} className="text-[10px] bg-bg rounded px-2 py-1 border border-border mb-1">
              <span className="text-accent">D{m.tick}</span> {m.trait}: {m.from.toFixed(2)}→{m.to.toFixed(2)} — {m.reason}
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="panel-section-title">成长经历</div>
        {personality.origin.map((o, i) => (
          <div key={i} className="text-[10px] bg-bg rounded px-2 py-1 border border-border mb-1">
            <span className="text-accent">{o.age}</span> {o.event}
            <div className="text-text-dim mt-0.5">→ {o.expression}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="panel-section-title">行为倾向</div>
        {Object.entries(personality.tendencies).map(([k, v]) => (
          <div key={k} className="text-[10px] mb-1">
            <span className="text-text-dim">{k}：</span>{v}
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneBar({ label, value, color = "#5a9868" }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[10px] text-text-dim w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-border rounded overflow-hidden">
        <div className="h-full rounded transition-all duration-500"
          style={{ width: `${value * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] w-8 text-right">{value.toFixed(2)}</span>
    </div>
  );
}

// ── 目标 Tab ──
function GoalsTab({ npc }) {
  const sorted = Object.entries(npc.goals).sort((a, b) => b[1].priority - a[1].priority);
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-text-dim">目标优先级由基因核心驱力决定，满足度受环境影响</div>
      {sorted.map(([name, goal]) => (
        <div key={name} className="bg-bg rounded px-2 py-2 border border-border">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold">{goal.priority >= 4 ? "❗" : "  "} {name}</span>
            <span className="text-[10px] text-accent">优先级 {goal.priority}/5</span>
          </div>
          <div className="w-full h-2 bg-border rounded mt-1.5 overflow-hidden">
            <div className="h-full rounded transition-all duration-500" style={{
              width: `${goal.satisfaction}%`,
              backgroundColor: goal.satisfaction > 60 ? "#5a9868" : goal.satisfaction > 30 ? "#c08850" : "#a85050"
            }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-text-dim">{goal.desc}</span>
            <span className="text-[10px]">{goal.satisfaction}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 记忆 Tab ──
function MemoryTab({ npc }) {
  const { memories } = npc;
  return (
    <div className="space-y-3">
      <div>
        <div className="panel-section-title">💭 短期记忆（当天）</div>
        {(!memories.short || memories.short.length === 0)
          ? <div className="text-[10px] text-text-dim">暂无</div>
          : [...memories.short].reverse().map((m, i) => (
            <div key={i} className="text-[10px] bg-bg rounded px-2 py-1 border border-border mb-1">{m}</div>
          ))}
      </div>
      <div>
        <div className="panel-section-title">📝 中期记忆（近期重要事件）</div>
        {(!memories.medium || memories.medium.length === 0)
          ? <div className="text-[10px] text-text-dim">暂无</div>
          : [...memories.medium].reverse().map((m, i) => (
            <div key={i} className="text-[10px] bg-bg rounded px-2 py-1 border border-border mb-1">{m}</div>
          ))}
      </div>
      <div>
        <div className="panel-section-title">📚 长期记忆（永久）</div>
        {(!memories.long || memories.long.length === 0)
          ? <div className="text-[10px] text-text-dim">暂无</div>
          : memories.long.map((m, i) => (
            <div key={i} className="text-[10px] bg-bg rounded px-2 py-1 border border-accent/30 mb-1 text-accent/80">{m}</div>
          ))}
      </div>
    </div>
  );
}

// ── 技能 Tab ──
function SkillsTab({ npc }) {
  const talents = npc.gene.talent_genes;
  const skillEntries = Object.entries(npc.skills).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-text-dim">技能上限由天赋基因决定（虚线），当前水平由实践决定</div>
      {skillEntries.map(([name, level]) => {
        // 尝试找到对应天赋来显示天花板
        let ceiling = 10;
        if (name === "编程" || name === "数据分析") ceiling = Math.round(talents.逻辑天赋 * 10);
        else if (name === "沟通" || name === "演讲") ceiling = Math.round(talents.语言天赋 * 10);
        else if (name === "向上管理" || name === "人际关系") ceiling = Math.round((talents.共情天赋 + talents.语言天赋) / 2 * 10);
        else if (name === "管理") ceiling = Math.round(talents.领导力天赋 * 10);
        else if (name === "摸鱼" || name === "甩锅") ceiling = Math.round(talents.适应力天赋 * 10);

        return (
          <div key={name} className="mb-2">
            <div className="flex justify-between text-xs">
              <span>{name}</span>
              <span>{level}/10</span>
            </div>
            <div className="relative w-full h-3 bg-border rounded mt-0.5 overflow-visible">
              <div className="absolute h-full rounded transition-all duration-500"
                style={{ width: `${(level / 10) * 100}%`, backgroundColor: "#5a9868" }} />
              <div className="absolute h-full border-r-2 border-dashed border-accent/50"
                style={{ width: `${(ceiling / 10) * 100}%` }}
                title={`天赋天花板: ${ceiling}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 状态 Tab ──
function StateTab({ npc }) {
  const { state } = npc;
  const gauges = [
    { label: "情绪", value: state.moodValue, desc: state.mood, color: moodColor(state.moodValue), warn: state.moodValue < 30 },
    { label: "压力", value: state.pressure, desc: state.pressure > 80 ? "⚠️ 临界" : "", color: state.pressure > 80 ? "#a85050" : state.pressure > 50 ? "#c08850" : "#5a9868", warn: state.pressure > 80 },
    { label: "精力", value: state.energy, desc: state.energy < 30 ? "⚠️ 耗竭" : "", color: state.energy < 30 ? "#a85050" : "#5a9868", warn: state.energy < 30 },
  ];

  return (
    <div className="space-y-3">
      {gauges.map((g) => (
        <div key={g.label} className={`bg-bg rounded px-3 py-2 border ${g.warn ? "border-negative" : "border-border"}`}>
          <div className="flex justify-between text-xs">
            <span>{g.label}</span>
            <span style={{ color: g.color }}>{g.value}/100 {g.desc}</span>
          </div>
          <div className="w-full h-3 bg-border rounded mt-1.5 overflow-hidden">
            <div className="h-full rounded transition-all duration-500" style={{ width: `${g.value}%`, backgroundColor: g.color }} />
          </div>
        </div>
      ))}

      <div className="bg-bg rounded px-3 py-2 border border-border">
        <div className="flex justify-between text-xs">
          <span>薪资</span>
          <span className="text-accent">¥{state.salary?.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-bg rounded px-3 py-2 border border-border">
        <div className="flex justify-between text-xs">
          <span>绩效</span>
          <span className={`font-bold ${
            state.performance === "S" ? "text-positive" :
            state.performance === "A" ? "text-accent" :
            state.performance === "C" ? "text-negative" : "text-text-dim"
          }`}>{state.performance || "待定"}</span>
        </div>
      </div>

      {/* 情绪基线参考 */}
      <div>
        <div className="panel-section-title">情绪基线（基因决定）</div>
        <div className="text-[10px] text-text-dim space-y-0.5">
          <div>焦虑倾向: {npc.gene.emotional_baseline.焦虑倾向} — {npc.gene.emotional_baseline.焦虑倾向 > 0.6 ? "同等压力下更容易焦虑" : "抗焦虑能力较强"}</div>
          <div>韧性: {npc.gene.emotional_baseline.韧性} — {npc.gene.emotional_baseline.韧性 > 0.6 ? "能扛住持续压力" : "持续高压下容易崩溃"}</div>
          <div>敏感度: {npc.gene.emotional_baseline.敏感度} — {npc.gene.emotional_baseline.敏感度 > 0.6 ? "对外界刺激反应强烈" : "比较迟钝"}</div>
        </div>
      </div>
    </div>
  );
}

// ── 关系 Tab ──
function RelationsTab({ npc, allNpcs }) {
  const rels = npc.relationships || {};
  if (Object.keys(rels).length === 0) return <div className="text-xs text-text-dim">暂无关系数据</div>;

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-text-dim">内心真实态度 vs 外在表现 — 差值越大越"城府深"</div>
      {Object.entries(rels).map(([tid, rel]) => {
        const target = allNpcs.find((n) => n.id === tid);
        if (!target) return null;
        const gap = Math.abs(rel.inner - rel.outer);
        return (
          <div key={tid} className="bg-bg rounded px-2 py-2 border border-border">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs">{target.emoji} {target.name}</span>
              {gap > 20 && <span className="text-[10px] text-negative">🎭 城府深</span>}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-dim w-8">内心</span>
                <div className="flex-1 h-2 bg-border rounded overflow-hidden relative">
                  <div className="absolute inset-0 flex">
                    <div className="w-1/2 border-r border-bg/30" />
                  </div>
                  <div className="h-full rounded transition-all"
                    style={{
                      width: `${(rel.inner + 100) / 2}%`,
                      backgroundColor: relColor(rel.inner),
                      marginLeft: rel.inner < 0 ? `${(rel.inner + 100) / 2}%` : "50%",
                      ...(rel.inner < 0 ? { marginLeft: `${(rel.inner + 100) / 2}%`, width: `${50 - (rel.inner + 100) / 2}%` } : { marginLeft: "50%", width: `${(rel.inner) / 2}%` })
                    }} />
                </div>
                <span className="text-[10px] w-8 text-right" style={{ color: relColor(rel.inner) }}>
                  {rel.inner > 0 ? "+" : ""}{rel.inner}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-dim w-8">表面</span>
                <div className="flex-1 h-2 bg-border rounded overflow-hidden">
                  <div className="h-full rounded transition-all"
                    style={{
                      ...(rel.outer < 0 ? { marginLeft: `${(rel.outer + 100) / 2}%`, width: `${50 - (rel.outer + 100) / 2}%` } : { marginLeft: "50%", width: `${(rel.outer) / 2}%` })
                    }} />
                </div>
                <span className="text-[10px] w-8 text-right" style={{ color: relColor(rel.outer) }}>
                  {rel.outer > 0 ? "+" : ""}{rel.outer}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-text-dim mt-1">{rel.notes}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── 决策 Tab ──
function DecisionTab({ npc }) {
  return (
    <div className="space-y-3">
      {npc.action && (
        <div className="bg-bg rounded px-2 py-2 border border-border">
          <div className="text-[10px] text-text-dim mb-1">🎬 当前行为</div>
          <div className="text-xs">{npc.action}</div>
        </div>
      )}
      {npc.thought && (
        <div className="bg-bg rounded px-2 py-2 border border-border">
          <div className="text-[10px] text-text-dim mb-1">💭 内心独白</div>
          <div className="text-xs italic">"{npc.thought}"</div>
        </div>
      )}
      {npc.decisionChain && (
        <div className="bg-bg rounded px-2 py-2 border border-accent/30">
          <div className="text-[10px] text-text-dim mb-1">🔗 决策推理链</div>
          <div className="text-xs text-accent/80">{npc.decisionChain}</div>
        </div>
      )}
      {!npc.action && !npc.thought && !npc.decisionChain && (
        <div className="text-xs text-text-dim text-center py-4">尚无决策记录，等待世界运转...</div>
      )}
    </div>
  );
}

// ─── 底部时间条 ───
function TimeBar({ gameTime, isPlaying, isBusy, onAdvance, onTogglePlay, speed, onSpeedChange }) {
  const hourLabel = SCHEDULE_TEMPLATE.find((s) => s.hour === gameTime.hour)?.label || "";

  return (
    <div className="time-bar">
      <div className="flex items-center gap-3 flex-1">
        <span className="text-sm font-bold text-accent">
          第{gameTime.day}天 {String(gameTime.hour).padStart(2, "0")}:00
        </span>
        <span className="text-xs text-text-dim">{hourLabel}</span>

        {/* 时间进度条 */}
        <div className="flex-1 h-2 bg-border rounded overflow-hidden mx-2">
          <div className="h-full bg-accent/50 rounded transition-all duration-300"
            style={{ width: `${((gameTime.hour - 7) / 16) * 100}%` }} />
        </div>

        {isBusy && <span className="text-accent text-xs animate-pulse-glow">⟳ 推演中...</span>}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onAdvance} disabled={isBusy}
          className="px-3 py-1 rounded text-xs bg-accent/20 border border-accent text-accent hover:bg-accent/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          ▶ 下一步
        </button>
        <button onClick={onTogglePlay}
          className={`px-3 py-1 rounded text-xs border cursor-pointer ${
            isPlaying ? "bg-negative/20 border-negative text-negative" : "bg-card border-border text-text-dim hover:border-accent hover:text-accent"
          }`}>
          {isPlaying ? "⏸ 暂停" : "⏩ 自动"}
        </button>
        <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="bg-card border border-border rounded px-2 py-1 text-xs text-text-dim cursor-pointer">
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
          <option value={8}>8x</option>
        </select>
      </div>
    </div>
  );
}

// ─── 主模拟界面 ───
function SimulationScreen({ apiConfig, onSettings }) {
  const [npcs, setNpcs] = useState(initNpcs);
  const [gameTime, setGameTime] = useState({ day: 1, hour: 9 });
  const [events, setEvents] = useState([]);
  const [dialogues, setDialogues] = useState([]);
  const [tensions, setTensions] = useState([]);
  const [selectedNPC, setSelectedNPC] = useState(null);
  const [intervention, setIntervention] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState(null);
  const [showIntervention, setShowIntervention] = useState(false);
  const playRef = useRef(false);

  const world = WORLD_CONFIG;

  const advanceTick = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const result = await simulateTick(apiConfig, world, npcs, gameTime, intervention);
      const updatedNpcs = applyResult(npcs, result);
      setNpcs(updatedNpcs);

      if (result.sum) {
        setEvents((prev) => [...prev, { day: gameTime.day, hour: gameTime.hour, text: result.sum }]);
      }

      if (result.talks && Array.isArray(result.talks)) {
        const newDialogues = result.talks.map((t) => ({
          day: gameTime.day, hour: gameTime.hour,
          from: t.f, to: t.t, content: t.s, subtext: t.subtext || "",
        }));
        setDialogues((prev) => [...prev, ...newDialogues]);
      }

      if (result.tensions && Array.isArray(result.tensions)) {
        setTensions(result.tensions);
      }

      // 基因突变
      if (result.mutation) {
        // 应用突变后在事件中记录
        const mutNpc = updatedNpcs.find((n) => n.id === result.mutation.npc_id);
        if (mutNpc) {
          setEvents((prev) => [...prev, {
            day: gameTime.day, hour: gameTime.hour,
            text: `🔀 ${mutNpc.name}发生基因突变：${result.mutation.trait} ${result.mutation.old_value}→${result.mutation.new_value}（${result.mutation.reason}）`
          }]);
        }
      }

      setIntervention(null);

      // 推进时间
      setGameTime((prev) => {
        let nextHour = prev.hour + 1;
        let nextDay = prev.day;
        if (nextHour > 23) {
          nextHour = 7;
          nextDay += 1;
        }
        return { day: nextDay, hour: nextHour };
      });
    } catch (e) {
      setError(e.message);
      setIsPlaying(false);
      playRef.current = false;
    } finally {
      setIsBusy(false);
    }
  }, [apiConfig, world, npcs, gameTime, intervention, isBusy]);

  // 自动模式
  useEffect(() => { playRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => {
    if (!isPlaying) return;
    const delay = Math.max(500, 3000 / speed);
    const timer = setTimeout(() => {
      if (playRef.current && !isBusy) advanceTick();
    }, delay);
    return () => clearTimeout(timer);
  }, [isPlaying, isBusy, gameTime, advanceTick, speed]);

  const selectedNpcData = npcs.find((n) => n.id === selectedNPC);

  return (
    <div className="simulation-layout">
      {/* 左侧：地图 + 对话 */}
      <div className="simulation-main">
        {/* 顶栏 */}
        <header className="sim-header">
          <div className="flex items-center gap-3">
            <span className="text-lg">🏢 像素办公室</span>
            {error && <span className="text-negative text-xs">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowIntervention(!showIntervention)}
              className={`px-3 py-1 rounded text-xs border cursor-pointer transition-all ${
                showIntervention ? "bg-accent/20 border-accent text-accent" : "border-border text-text-dim hover:border-accent"
              }`}>
              🌩️ 天命干预
            </button>
            <button onClick={onSettings}
              className="px-3 py-1 rounded text-xs border border-border text-text-dim hover:border-accent hover:text-accent cursor-pointer">
              ⚙️
            </button>
          </div>
        </header>

        {/* 干预面板 */}
        {showIntervention && (
          <div className="intervention-bar">
            {world.interventions.map((iv) => (
              <button key={iv.id}
                onClick={() => setIntervention(intervention === iv.id ? null : iv.id)}
                title={iv.description}
                className={`px-3 py-1 rounded text-xs border cursor-pointer transition-all ${
                  intervention === iv.id ? "bg-accent/20 border-accent text-accent" : "bg-card border-border text-text-dim hover:border-accent"
                }`}>
                {iv.emoji} {iv.name}
              </button>
            ))}
            {intervention && <span className="text-xs text-accent ml-2">⚡ 下次推演时生效</span>}
          </div>
        )}

        {/* 像素地图 */}
        <div className="flex-1 overflow-y-auto p-3">
          <PixelMap locations={world.locations} npcs={npcs} selectedNPC={selectedNPC} onSelectNPC={setSelectedNPC} />
        </div>

        {/* 对话流 */}
        <div className="border-t border-border px-3 py-2 bg-card/30">
          <div className="text-[10px] text-text-dim mb-1">💬 众生之声</div>
          <DialogueStream dialogues={dialogues} npcs={npcs} />
        </div>
      </div>

      {/* 右侧面板 */}
      <aside className="simulation-panel">
        <div className="flex-1 overflow-y-auto p-3">
          {selectedNpcData ? (
            <NPCPanel npc={selectedNpcData} allNpcs={npcs} />
          ) : (
            <WorldDashboard world={world} npcs={npcs} events={events} tensions={tensions} gameTime={gameTime} />
          )}
        </div>

        {/* NPC快速选择栏 */}
        <div className="border-t border-border px-3 py-2 flex items-center justify-center gap-1">
          <button onClick={() => setSelectedNPC(null)}
            className={`px-2 py-1 rounded text-xs cursor-pointer ${!selectedNPC ? "bg-accent/20 text-accent" : "text-text-dim hover:text-accent"}`}>
            🏢
          </button>
          {npcs.map((n) => (
            <button key={n.id} onClick={() => setSelectedNPC(n.id === selectedNPC ? null : n.id)}
              title={`${n.name} - ${n.state.mood}`}
              className={`px-1.5 py-1 rounded text-base cursor-pointer transition-all ${
                n.id === selectedNPC ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-card-hover"
              }`}>
              {n.emoji}
            </button>
          ))}
        </div>
      </aside>

      {/* 底部时间条 */}
      <TimeBar gameTime={gameTime} isPlaying={isPlaying} isBusy={isBusy}
        onAdvance={advanceTick} onTogglePlay={() => setIsPlaying(!isPlaying)}
        speed={speed} onSpeedChange={setSpeed} />
    </div>
  );
}

// ─── App Root ───
export default function App() {
  const [phase, setPhase] = useState("sim"); // 默认进入模拟（如果有API配置的话）
  const [apiConfig, setApiConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const handleSaveConfig = (config) => {
    setApiConfig(config);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
    setPhase("sim");
  };

  // 只在用户主动点设置时才进设置页（server.js 已内置默认 API Key）
  if (phase === "setup") {
    return <ApiSetupScreen config={apiConfig} onSave={handleSaveConfig} />;
  }

  return (
    <SimulationScreen
      apiConfig={apiConfig}
      onSettings={() => setPhase("setup")}
    />
  );
}
