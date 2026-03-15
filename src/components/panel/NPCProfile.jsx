/**
 * NPC 档案面板 — Tab 切换多个子面板
 * 灵魂 / 目标 / 记忆 / 技能 / 状态 / 关系 / 决策
 */
import React, { useState } from "react";
import { useStore } from "../../store/useStore.jsx";
import ProgressBar from "../common/ProgressBar.jsx";
import RadarChart from "../common/RadarChart.jsx";

const TABS = [
  { id: "soul", label: "灵魂" },
  { id: "goals", label: "目标" },
  { id: "memory", label: "记忆" },
  { id: "skills", label: "技能" },
  { id: "status", label: "状态" },
  { id: "relations", label: "关系" },
  { id: "decision", label: "决策" },
];

// ─── 灵魂 Tab ───
function SoulTab({ npc }) {
  if (!npc.gene) return <div className="text-xs text-[--color-text-dim]">无基因数据</div>;

  // 构建雷达图数据 — 取核心驱力
  const driveData = npc.gene.core_drives || {};
  const cogData = npc.gene.cognitive_style || {};
  const talentData = npc.gene.talent_genes || {};

  return (
    <div className="space-y-4">
      {/* 核心驱力雷达图 */}
      <div>
        <div className="text-xs text-[--color-accent] font-bold mb-2">核心驱力</div>
        <RadarChart data={driveData} size={160} color="#ffd700" />
      </div>

      {/* 认知风格 */}
      <div>
        <div className="text-xs text-[--color-accent] font-bold mb-2">认知风格</div>
        <div className="space-y-2">
          {Object.entries(cogData).map(([key, val]) => (
            <div key={key}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-[--color-text-dim]">{key}</span>
                <span className="text-[--color-text]">{val.toFixed(2)}</span>
              </div>
              <ProgressBar value={val * 100} color="#a78bfa" height={4} />
            </div>
          ))}
        </div>
      </div>

      {/* 天赋基因 */}
      <div>
        <div className="text-xs text-[--color-accent] font-bold mb-2">天赋基因</div>
        <RadarChart data={talentData} size={160} color="#22c55e" />
      </div>

      {/* 情绪基线 */}
      <div>
        <div className="text-xs text-[--color-accent] font-bold mb-2">情绪基线</div>
        <div className="space-y-2">
          {Object.entries(npc.gene.emotional_baseline || {}).map(([key, val]) => (
            <div key={key}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-[--color-text-dim]">{key}</span>
                <span className="text-[--color-text]">{val.toFixed(2)}</span>
              </div>
              <ProgressBar value={val * 100} color="#f97316" height={4} />
            </div>
          ))}
        </div>
      </div>

      {/* 突变历史 */}
      {npc.gene.mutation_log && npc.gene.mutation_log.length > 0 && (
        <div>
          <div className="text-xs text-[--color-accent] font-bold mb-2">基因突变历史</div>
          <div className="space-y-1">
            {npc.gene.mutation_log.map((m, i) => (
              <div key={i} className="text-xs text-[--color-text-dim] poke-card">
                {typeof m === "string" ? m : JSON.stringify(m)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 性格倾向 */}
      {npc.personality?.tendencies && (
        <div>
          <div className="text-xs text-[--color-accent] font-bold mb-2">行为倾向</div>
          <div className="space-y-1">
            {Object.entries(npc.personality.tendencies).map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-[--color-text-dim]">{k}:</span>{" "}
                <span className="text-[--color-text]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 目标 Tab ───
function GoalsTab({ npc }) {
  if (!npc.goals) return null;

  const sortedGoals = Object.entries(npc.goals).sort((a, b) => b[1].priority - a[1].priority);

  return (
    <div className="space-y-3">
      <div className="text-xs text-[--color-text-dim] mb-2">按优先级排序（高 &#8594; 低）</div>
      {sortedGoals.map(([name, goal]) => {
        const color = goal.satisfaction >= 70 ? "#22c55e" : goal.satisfaction >= 40 ? "#ffd700" : "#e94560";
        return (
          <div key={name} className="poke-card">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-[--color-text]">
                {goal.priority >= 4 ? "&#10071;" : ""} {name}
              </span>
              <span className="text-xs text-[--color-text-dim]">优先级 {goal.priority}</span>
            </div>
            <ProgressBar value={goal.satisfaction} color={color} height={6} showPercent label="满足度" />
            <div className="text-xs text-[--color-text-dim] mt-1">{goal.desc}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 记忆 Tab ───
function MemoryTab({ npc }) {
  const memories = npc.memories || {};

  const renderMemoryList = (title, items, icon) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-3">
        <div className="text-xs text-[--color-accent] font-bold mb-1">{icon} {title}</div>
        <div className="space-y-1">
          {items.map((m, i) => (
            <div key={i} className="memory-item text-xs text-[--color-text]">
              {typeof m === "string" ? m : m.content || JSON.stringify(m)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderMemoryList("长期记忆（人生信条）", memories.long, "&#128218;")}
      {renderMemoryList("中期记忆（近期重要事件）", memories.medium, "&#128221;")}
      {renderMemoryList("短期记忆（刚发生的事）", memories.short, "&#128173;")}
      {(!memories.long?.length && !memories.medium?.length && !memories.short?.length) && (
        <div className="text-xs text-[--color-text-dim]">记忆库为空</div>
      )}
    </div>
  );
}

// ─── 技能 Tab ───
function SkillsTab({ npc }) {
  if (!npc.skills) return null;

  const sortedSkills = Object.entries(npc.skills).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-2">
      {sortedSkills.map(([name, level]) => {
        const color = level >= 8 ? "#ffd700" : level >= 5 ? "#22c55e" : "#9ca3af";
        return (
          <div key={name}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-[--color-text]">{name}</span>
              <span className="text-[--color-text-dim]">Lv.{level}</span>
            </div>
            <ProgressBar value={level} max={10} color={color} height={5} />
          </div>
        );
      })}
    </div>
  );
}

// ─── 状态 Tab ───
function StatusTab({ npc }) {
  const state = npc.state || {};

  const gauges = [
    { label: "情绪", value: state.moodValue || 50, color: (state.moodValue || 50) >= 70 ? "#22c55e" : (state.moodValue || 50) >= 40 ? "#ffd700" : "#e94560", extra: state.mood },
    { label: "压力", value: state.pressure || 0, color: (state.pressure || 0) > 70 ? "#e94560" : (state.pressure || 0) > 40 ? "#ffd700" : "#22c55e" },
    { label: "精力", value: state.energy || 50, color: (state.energy || 50) >= 60 ? "#3b82f6" : (state.energy || 50) >= 30 ? "#ffd700" : "#e94560" },
  ];

  return (
    <div className="space-y-4">
      {/* 仪表盘 */}
      {gauges.map((g) => (
        <div key={g.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[--color-text]">{g.label}</span>
            <span className="text-[--color-text-dim]">
              {g.value}/100 {g.extra ? `(${g.extra})` : ""}
            </span>
          </div>
          <ProgressBar value={g.value} color={g.color} height={8} />
        </div>
      ))}

      {/* 其他信息 */}
      <div className="poke-card">
        <div className="text-xs space-y-1">
          {state.salary && (
            <div><span className="text-[--color-text-dim]">薪资:</span> <span className="text-[--color-text]">{state.salary.toLocaleString()}</span></div>
          )}
          {state.performance && (
            <div><span className="text-[--color-text-dim]">绩效:</span> <span className="text-[--color-accent] font-bold">{state.performance}</span></div>
          )}
        </div>
      </div>

      {/* 当前行动 */}
      {npc.action && (
        <div className="poke-card">
          <div className="text-xs text-[--color-accent] font-bold mb-1">&#127916; 当前行动</div>
          <div className="text-xs text-[--color-text]">{npc.action}</div>
        </div>
      )}
    </div>
  );
}

// ─── 关系 Tab ───
function RelationsTab({ npc, allNpcs }) {
  if (!npc.relationships || Object.keys(npc.relationships).length === 0) {
    return <div className="text-xs text-[--color-text-dim]">暂无关系数据</div>;
  }

  const entries = Object.entries(npc.relationships)
    .map(([targetId, rel]) => {
      const target = allNpcs.find((n) => n.id === targetId);
      return target ? { target, rel } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.rel.inner - a.rel.inner);

  return (
    <div className="space-y-2">
      {entries.map(({ target, rel }) => {
        const gap = Math.abs((rel.inner || 0) - (rel.outer || 0));
        const hasDeception = gap > 15;

        return (
          <div key={target.id} className={`poke-card ${hasDeception ? "relation-deception" : ""}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">{target.emoji}</span>
              <span className="text-xs font-bold text-[--color-text]">{target.name}</span>
              {hasDeception && <span className="text-xs text-[--color-negative]">&#128064; 城府</span>}
            </div>
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-[--color-text-dim]">内心: </span>
                <span style={{ color: rel.inner > 0 ? "#22c55e" : rel.inner < 0 ? "#e94560" : "#9ca3af" }}>
                  {rel.inner > 0 ? "+" : ""}{rel.inner}
                </span>
              </div>
              <div>
                <span className="text-[--color-text-dim]">表面: </span>
                <span style={{ color: rel.outer > 0 ? "#22c55e" : rel.outer < 0 ? "#e94560" : "#9ca3af" }}>
                  {rel.outer > 0 ? "+" : ""}{rel.outer}
                </span>
              </div>
            </div>
            {rel.notes && (
              <div className="text-xs text-[--color-text-dim] mt-1">{rel.notes}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 决策 Tab ───
function DecisionTab({ npc }) {
  if (!npc.decisionChain) {
    return <div className="text-xs text-[--color-text-dim]">暂无决策记录</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-[--color-accent] font-bold mb-1">&#129504; 最近推理链</div>
      <div className="poke-card">
        <div className="text-xs text-[--color-text] leading-relaxed whitespace-pre-wrap">
          {npc.decisionChain}
        </div>
      </div>

      {npc.thought && (
        <>
          <div className="text-xs text-[--color-accent] font-bold mb-1">&#128173; 内心独白</div>
          <div className="poke-card">
            <div className="text-xs text-[--color-text] italic leading-relaxed">{npc.thought}</div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── 主组件 ───
export default function NPCProfile() {
  const { npcs, selectedNpcId } = useStore();
  const [activeTab, setActiveTab] = useState("soul");

  const npc = npcs.find((n) => n.id === selectedNpcId);
  if (!npc) return <div className="p-4 text-xs text-[--color-text-dim]">NPC 未找到</div>;

  const TabContent = {
    soul: SoulTab,
    goals: GoalsTab,
    memory: MemoryTab,
    skills: SkillsTab,
    status: StatusTab,
    relations: RelationsTab,
    decision: DecisionTab,
  }[activeTab];

  return (
    <div className="npc-profile">
      {/* NPC 头部 */}
      <div className="npc-profile-header">
        <span className="npc-profile-emoji">{npc.emoji}</span>
        <div>
          <div className="npc-profile-name">{npc.name}</div>
          <div className="npc-profile-title">{npc.title} | {npc.age}岁</div>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="npc-profile-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`npc-profile-tab ${activeTab === tab.id ? "npc-profile-tab-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="npc-profile-content">
        {TabContent && <TabContent npc={npc} allNpcs={npcs} />}
      </div>
    </div>
  );
}
