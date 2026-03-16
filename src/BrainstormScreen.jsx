import React, { useState, useRef, useEffect, useCallback } from "react";

// fadeIn keyframe 注入
if (typeof document !== "undefined" && !document.getElementById("brainstorm-keyframes")) {
  const style = document.createElement("style");
  style.id = "brainstorm-keyframes";
  style.textContent = `@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`;
  document.head.appendChild(style);
}
import {
  generatePersonas,
  singleAgentCreate,
  runBrainstorm,
} from "./brainstorm-engine.js";

// ─── 颜色系统 ───
const AGENT_COLORS = ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a29bfe", "#fd79a8"];
const BG_DARK = "#0e1119";
const BG_CARD = "#141722";
const BG_HOVER = "#1a1a30";
const BORDER = "#2a2a45";
const GOLD = "#ffd700";
const TEXT_DIM = "#9ca3af";
const TEXT_MAIN = "#e8e4d8";

// ─── 消息气泡 ───
function ChatBubble({ msg, color }) {
  return (
    <div className="mb-3 animate-fadeIn" style={{ animation: "fadeIn 0.3s ease-in" }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: 18 }}>{msg.agentEmoji}</span>
        <span className="text-sm font-bold" style={{ color }}>{msg.agent}</span>
        <span className="text-xs" style={{ color: TEXT_DIM }}>{msg.agentRole}</span>
      </div>
      <div
        className="ml-7 text-sm leading-relaxed"
        style={{ color: TEXT_MAIN, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}
      >
        {msg.message}
      </div>
      {msg.imageStatus === "generating" && !msg.imageUrl && (
        <div className="ml-7 mt-2 text-xs" style={{ color: GOLD }}>
          正在生成概念图...
        </div>
      )}
      {msg.imageUrl && (
        <div className="ml-7 mt-2">
          <img
            src={msg.imageUrl}
            alt="概念图"
            style={{
              maxWidth: 320,
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
            }}
          />
        </div>
      )}
      {msg.imageError && (
        <div className="ml-7 mt-1 text-xs" style={{ color: "#e94560" }}>
          图片生成失败: {msg.imageError}
        </div>
      )}
    </div>
  );
}

// ─── 轮次分隔线 ───
function RoundDivider({ round }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div style={{ flex: 1, height: 1, background: BORDER }} />
      <span className="text-xs" style={{ color: GOLD }}>
        第 {round} 轮
      </span>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  );
}

// ─── 主持人判断气泡 ───
function ModeratorBubble({ result }) {
  return (
    <div
      className="my-3 mx-4 p-3 text-xs rounded-lg"
      style={{
        background: "rgba(255,215,0,0.06)",
        border: "1px solid rgba(255,215,0,0.2)",
        color: TEXT_DIM,
      }}
    >
      <span style={{ color: GOLD }}>🎯 主持人：</span>
      {result.progressSummary}
      <span className="ml-2" style={{ color: result.shouldContinue ? "#4ecdc4" : "#ff6b6b" }}>
        {result.shouldContinue ? "→ 继续讨论" : "→ 达成共识！"}
      </span>
    </div>
  );
}

// ─── 最终方案卡片 ───
function FinalCard({ result }) {
  if (!result) return null;
  return (
    <div
      className="p-5 rounded-lg mt-4"
      style={{
        background: "linear-gradient(135deg, #1a1a30 0%, #141722 100%)",
        border: `2px solid ${GOLD}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontSize: 20 }}>✨</span>
        <span className="font-bold text-lg" style={{ color: GOLD }}>
          {result.title}
        </span>
      </div>
      <div className="text-sm mb-3" style={{ color: "#a29bfe", fontStyle: "italic" }}>
        {result.concept}
      </div>
      <div
        className="text-sm leading-relaxed mb-4"
        style={{ color: TEXT_MAIN, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}
      >
        {result.detail}
      </div>
      {result.highlights && result.highlights.length > 0 && (
        <div className="mb-3">
          <div className="text-xs mb-2" style={{ color: GOLD }}>亮点</div>
          <div className="flex flex-wrap gap-2">
            {result.highlights.map((h, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded"
                style={{ background: "rgba(162,155,254,0.15)", color: "#a29bfe" }}
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      )}
      {result.finalImageUrl && (
        <div className="mt-3">
          <img
            src={result.finalImageUrl}
            alt="最终概念图"
            style={{
              width: "100%",
              maxWidth: 480,
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── 人设编辑器 ───
function PersonaEditor({ personas, onChange }) {
  const updatePersona = (index, field, value) => {
    const updated = [...personas];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const defaultEmojis = ["🎨", "🧪", "🔥", "💎", "🌊"];

  return (
    <div className="space-y-3">
      {personas.map((p, i) => (
        <div
          key={i}
          className="p-3 rounded-lg"
          style={{ background: BG_DARK, border: `1px solid ${BORDER}` }}
        >
          <div className="flex gap-2 mb-2">
            <input
              value={p.emoji || defaultEmojis[i] || "🧠"}
              onChange={(e) => updatePersona(i, "emoji", e.target.value)}
              className="text-center"
              style={{
                width: 40, background: "transparent", border: `1px solid ${BORDER}`,
                borderRadius: 4, fontSize: 18, outline: "none",
              }}
            />
            <input
              value={p.name || ""}
              onChange={(e) => updatePersona(i, "name", e.target.value)}
              placeholder="角色名"
              style={{
                flex: 1, background: "transparent", border: `1px solid ${BORDER}`,
                borderRadius: 4, padding: "4px 8px", fontSize: 13,
                color: TEXT_MAIN, outline: "none",
              }}
            />
            <input
              value={p.role || ""}
              onChange={(e) => updatePersona(i, "role", e.target.value)}
              placeholder="角色定位"
              style={{
                flex: 1, background: "transparent", border: `1px solid ${BORDER}`,
                borderRadius: 4, padding: "4px 8px", fontSize: 13,
                color: TEXT_MAIN, outline: "none",
              }}
            />
          </div>
          <input
            value={p.style || ""}
            onChange={(e) => updatePersona(i, "style", e.target.value)}
            placeholder="思维和表达风格描述"
            style={{
              width: "100%", background: "transparent", border: `1px solid ${BORDER}`,
              borderRadius: 4, padding: "4px 8px", fontSize: 12,
              color: TEXT_DIM, outline: "none", marginBottom: 4,
            }}
          />
          <input
            value={p.perspective || ""}
            onChange={(e) => updatePersona(i, "perspective", e.target.value)}
            placeholder="独特视角"
            style={{
              width: "100%", background: "transparent", border: `1px solid ${BORDER}`,
              borderRadius: 4, padding: "4px 8px", fontSize: 12,
              color: TEXT_DIM, outline: "none",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── 对话面板 (左或右) ───
function ChatPanel({ title, icon, messages, roundMarkers, moderatorResults, finalResult, status, isRunning }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, moderatorResults, finalResult]);

  // 按轮次组织消息
  const renderMessages = () => {
    const elements = [];
    let currentRound = 0;

    for (const msg of messages) {
      if (msg._round && msg._round !== currentRound) {
        currentRound = msg._round;
        elements.push(<RoundDivider key={`round-${currentRound}`} round={currentRound} />);
      }
      const colorIdx = msg._agentIndex || 0;
      elements.push(
        <ChatBubble
          key={`msg-${elements.length}`}
          msg={msg}
          color={AGENT_COLORS[colorIdx % AGENT_COLORS.length]}
        />
      );
      // 检查这轮后是否有主持人判断
      const modResult = moderatorResults.find(
        (m) => m.round === currentRound && msg === messages.filter(m2 => m2._round === currentRound).slice(-1)[0]
      );
      if (modResult) {
        elements.push(
          <ModeratorBubble key={`mod-${modResult.round}`} result={modResult.result} />
        );
      }
    }

    return elements;
  };

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden"
      style={{
        background: BG_CARD,
        border: `1px solid ${BORDER}`,
        flex: 1,
        minWidth: 0,
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span className="text-sm font-bold" style={{ color: GOLD }}>{title}</span>
        {isRunning && (
          <span className="text-xs ml-auto" style={{ color: "#4ecdc4" }}>
            ● {status || "进行中..."}
          </span>
        )}
        {!isRunning && messages.length > 0 && (
          <span className="text-xs ml-auto" style={{ color: TEXT_DIM }}>
            已完成
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 && !isRunning && (
          <div className="text-sm text-center py-8" style={{ color: TEXT_DIM }}>
            等待开始...
          </div>
        )}
        {renderMessages()}
        {finalResult && <FinalCard result={finalResult} />}
      </div>
    </div>
  );
}

// ─── 主组件 ───
export default function BrainstormScreen({ apiConfig, onBack }) {
  // 阶段: input → persona → running → done
  const [stage, setStage] = useState("input");
  const [intent, setIntent] = useState("");

  // 人设
  const [personaMode, setPersonaMode] = useState("auto"); // auto | manual
  const [personas, setPersonas] = useState([
    { name: "", emoji: "🎨", role: "", style: "", perspective: "" },
    { name: "", emoji: "🧪", role: "", style: "", perspective: "" },
    { name: "", emoji: "🔥", role: "", style: "", perspective: "" },
  ]);
  const [isGeneratingPersonas, setIsGeneratingPersonas] = useState(false);

  // 多Agent脑爆状态
  const [multiMessages, setMultiMessages] = useState([]);
  const [multiModResults, setMultiModResults] = useState([]);
  const [multiFinal, setMultiFinal] = useState(null);
  const [multiStatus, setMultiStatus] = useState("");
  const [multiRunning, setMultiRunning] = useState(false);

  // 单Agent状态
  const [singleMessages, setSingleMessages] = useState([]);
  const [singleFinal, setSingleFinal] = useState(null);
  const [singleRunning, setSingleRunning] = useState(false);

  // 控制
  const controlRef = useRef({ shouldStop: false, forceConverge: false });
  const mountedRef = useRef(true);

  // 组件卸载时停止脑爆
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      controlRef.current.shouldStop = true;
    };
  }, []);

  // 投票
  const [vote, setVote] = useState(null);

  // 示例创意意图
  const examples = [
    "帮我想一个适合抖音的短视频创意，主题是独居生活",
    "我想做一个科幻微短剧的故事大纲",
    "帮我策划一个让人眼前一亮的产品发布会创意",
    "设计一组有传播力的社交媒体海报概念",
  ];

  // 自动生成人设
  const handleGeneratePersonas = async () => {
    if (!intent.trim()) return;
    setIsGeneratingPersonas(true);
    try {
      const generated = await generatePersonas(intent, apiConfig);
      setPersonas(generated);
      setPersonaMode("auto");
    } catch (e) {
      alert("人设生成失败: " + e.message);
    } finally {
      setIsGeneratingPersonas(false);
    }
  };

  // 开始脑爆
  const handleStart = async () => {
    // 验证API配置
    if (!apiConfig?.apiKey) {
      alert("请先在设置中配置API密钥");
      return;
    }

    // 验证人设
    const validPersonas = personas.filter(
      (p) => p.name && p.role && p.style
    );
    if (validPersonas.length < 2) {
      alert("至少需要2个完整的角色（名字、定位、风格）");
      return;
    }

    setStage("running");
    controlRef.current = { shouldStop: false, forceConverge: false };

    // 并行启动单Agent和多Agent
    const singlePromise = runSingleAgent();
    const multiPromise = runMultiAgent(validPersonas);

    await Promise.allSettled([singlePromise, multiPromise]);
    if (mountedRef.current) setStage("done");
  };

  // 单Agent流程
  const runSingleAgent = async () => {
    setSingleRunning(true);
    setSingleMessages([]);
    setSingleFinal(null);
    try {
      const result = await singleAgentCreate(intent, apiConfig, (event) => {
        if (event.type === "start") {
          setSingleMessages([{
            agent: "创意专家",
            agentEmoji: "🧠",
            agentRole: "全能创意策划",
            message: "正在思考创意方案...",
            _round: 1,
            _agentIndex: 0,
          }]);
        }
      });
      setSingleMessages([{
        agent: "创意专家",
        agentEmoji: "🧠",
        agentRole: "全能创意策划",
        message: result,
        _round: 1,
        _agentIndex: 0,
      }]);
      setSingleFinal({ title: "单Agent方案", concept: "", detail: result, highlights: [] });
    } catch (e) {
      setSingleMessages([{
        agent: "系统",
        agentEmoji: "⚠️",
        agentRole: "",
        message: "出错了: " + e.message,
        _round: 1,
        _agentIndex: 0,
      }]);
    } finally {
      setSingleRunning(false);
    }
  };

  // 多Agent流程
  const runMultiAgent = async (validPersonas) => {
    setMultiRunning(true);
    setMultiMessages([]);
    setMultiModResults([]);
    setMultiFinal(null);
    setMultiStatus("脑爆中...");

    try {
      await runBrainstorm({
        intent,
        personas: validPersonas,
        apiConfig,
        control: controlRef.current,
        onEvent: (event) => {
          if (!mountedRef.current) return;
          switch (event.type) {
            case "round_start":
              setMultiStatus(`第${event.round}轮讨论中...`);
              break;
            case "agent_message": {
              const enriched = {
                ...event.message,
                _round: event.round,
                _agentIndex: validPersonas.findIndex(
                  (p) => p.name === event.message.agent
                ),
              };
              // imageStatus="done" 替换之前的 "generating" 消息
              if (event.message.imageStatus === "done") {
                setMultiMessages((prev) => {
                  const idx = prev.findLastIndex(
                    (m) => m.agent === event.message.agent && m._round === event.round && m.imageStatus === "generating"
                  );
                  if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = enriched;
                    return updated;
                  }
                  return [...prev, enriched];
                });
              } else {
                setMultiMessages((prev) => [...prev, enriched]);
              }
              break;
            }
            case "moderator":
              setMultiModResults((prev) => [...prev, { round: event.round, result: event.result }]);
              break;
            case "synthesizing":
              setMultiStatus("整合最终方案...");
              break;
            case "final":
              setMultiFinal(event.result);
              setMultiStatus("完成");
              break;
          }
        },
      });
    } catch (e) {
      setMultiMessages((prev) => [
        ...prev,
        {
          agent: "系统",
          agentEmoji: "⚠️",
          agentRole: "",
          message: "出错了: " + e.message,
          _round: 0,
          _agentIndex: 0,
        },
      ]);
    } finally {
      setMultiRunning(false);
    }
  };

  // ─── 渲染：输入阶段 ───
  if (stage === "input" || stage === "persona") {
    return (
      <div
        className="flex flex-col items-center min-h-screen p-8"
        style={{
          background: "radial-gradient(ellipse at center, #2a2a45 0%, #1a1a2e 65%, #0e1119 100%)",
        }}
      >
        {/* 返回按钮 */}
        <div className="w-full max-w-3xl mb-6">
          <button
            onClick={onBack}
            className="text-xs cursor-pointer"
            style={{ color: TEXT_DIM }}
            onMouseEnter={(e) => (e.currentTarget.style.color = GOLD)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_DIM)}
          >
            ← 返回首页
          </button>
        </div>

        <div className="text-5xl mb-4">🧠</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: GOLD }}>
          创意脑爆
        </h1>
        <p className="mb-8 text-sm" style={{ color: TEXT_DIM }}>
          多个AI创意人围绕你的想法展开脑爆，碰撞出更好的创意
        </p>

        <div className="w-full max-w-3xl space-y-6">
          {/* 创作意图 */}
          <div
            className="p-5 rounded-lg"
            style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}
          >
            <div className="text-sm mb-3" style={{ color: GOLD }}>
              你的创作意图
            </div>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="描述你想要创作的内容..."
              rows={3}
              style={{
                width: "100%", background: BG_DARK, border: `1px solid ${BORDER}`,
                borderRadius: 4, padding: "10px 14px", fontSize: 14,
                color: TEXT_MAIN, outline: "none", resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            {/* 示例 */}
            <div className="flex flex-wrap gap-2 mt-3">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setIntent(ex)}
                  className="text-xs cursor-pointer transition-all"
                  style={{
                    background: "rgba(255,215,0,0.06)",
                    border: "1px solid rgba(255,215,0,0.15)",
                    borderRadius: 12, padding: "4px 10px",
                    color: TEXT_DIM,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,215,0,0.4)";
                    e.currentTarget.style.color = GOLD;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,215,0,0.15)";
                    e.currentTarget.style.color = TEXT_DIM;
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* 人设选择 */}
          {intent.trim() && (
            <div
              className="p-5 rounded-lg"
              style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}
            >
              <div className="text-sm mb-3" style={{ color: GOLD }}>
                脑爆角色
              </div>

              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => {
                    setPersonaMode("auto");
                    handleGeneratePersonas();
                  }}
                  disabled={isGeneratingPersonas}
                  className="cursor-pointer transition-all text-sm"
                  style={{
                    background: personaMode === "auto" ? "rgba(255,215,0,0.12)" : "transparent",
                    border: `1px solid ${personaMode === "auto" ? GOLD : BORDER}`,
                    borderRadius: 6, padding: "8px 16px",
                    color: personaMode === "auto" ? GOLD : TEXT_DIM,
                    opacity: isGeneratingPersonas ? 0.6 : 1,
                  }}
                >
                  {isGeneratingPersonas ? "⟳ AI生成中..." : "🤖 AI自动生成角色"}
                </button>
                <button
                  onClick={() => setPersonaMode("manual")}
                  className="cursor-pointer transition-all text-sm"
                  style={{
                    background: personaMode === "manual" ? "rgba(255,215,0,0.12)" : "transparent",
                    border: `1px solid ${personaMode === "manual" ? GOLD : BORDER}`,
                    borderRadius: 6, padding: "8px 16px",
                    color: personaMode === "manual" ? GOLD : TEXT_DIM,
                  }}
                >
                  ✏️ 手动设定角色
                </button>
              </div>

              {/* 人设预览/编辑 */}
              {personas[0]?.name ? (
                <div>
                  {personaMode === "auto" ? (
                    // 自动模式：展示生成结果，可微调
                    <div className="space-y-2">
                      {personas.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-3 rounded"
                          style={{ background: BG_DARK }}
                        >
                          <span style={{ fontSize: 22 }}>{p.emoji}</span>
                          <div>
                            <div className="text-sm font-bold" style={{ color: AGENT_COLORS[i] }}>
                              {p.name}
                              <span className="font-normal ml-2" style={{ color: TEXT_DIM }}>
                                {p.role}
                              </span>
                            </div>
                            <div className="text-xs" style={{ color: TEXT_DIM }}>
                              {p.style}
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => setPersonaMode("manual")}
                        className="text-xs cursor-pointer mt-2"
                        style={{ color: TEXT_DIM }}
                      >
                        想微调？点击切换到手动编辑
                      </button>
                    </div>
                  ) : (
                    <PersonaEditor personas={personas} onChange={setPersonas} />
                  )}
                </div>
              ) : personaMode === "manual" ? (
                <PersonaEditor personas={personas} onChange={setPersonas} />
              ) : (
                <div className="text-sm text-center py-4" style={{ color: TEXT_DIM }}>
                  点击上方按钮生成角色
                </div>
              )}
            </div>
          )}

          {/* 开始按钮 */}
          {intent.trim() && personas.filter(p => p.name && p.role && p.style).length >= 2 && (
            <button
              onClick={handleStart}
              className="w-full cursor-pointer transition-all text-base font-bold py-4 rounded-lg"
              style={{
                background: "linear-gradient(135deg, #ffd700 0%, #ff6b6b 100%)",
                border: "none",
                color: "#0e1119",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              🚀 开始脑爆 — 单Agent vs 多Agent 对决
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── 渲染：运行/完成阶段（左右对比） ───
  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: BG_DARK }}
    >
      {/* 顶部栏 */}
      <div
        className="flex items-center gap-4 px-6 py-3"
        style={{ borderBottom: `1px solid ${BORDER}`, background: BG_CARD }}
      >
        <button
          onClick={onBack}
          className="text-xs cursor-pointer"
          style={{ color: TEXT_DIM }}
          onMouseEnter={(e) => (e.currentTarget.style.color = GOLD)}
          onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_DIM)}
        >
          ← 返回
        </button>
        <span className="text-sm" style={{ color: GOLD }}>🧠 创意脑爆</span>
        <span className="text-xs flex-1 truncate" style={{ color: TEXT_DIM }}>
          {intent}
        </span>
        {(multiRunning || singleRunning) && (
          <div className="flex gap-2">
            <button
              onClick={() => { controlRef.current.forceConverge = true; }}
              className="text-xs cursor-pointer px-3 py-1 rounded"
              style={{
                background: "rgba(255,215,0,0.1)",
                border: `1px solid rgba(255,215,0,0.3)`,
                color: GOLD,
              }}
            >
              够了，收敛吧
            </button>
            <button
              onClick={() => { controlRef.current.shouldStop = true; }}
              className="text-xs cursor-pointer px-3 py-1 rounded"
              style={{
                background: "rgba(233,69,96,0.1)",
                border: `1px solid rgba(233,69,96,0.3)`,
                color: "#e94560",
              }}
            >
              停止
            </button>
          </div>
        )}
      </div>

      {/* 左右对比面板 */}
      <div className="flex flex-col md:flex-row flex-1 gap-3 p-4" style={{ minHeight: 0 }}>
        {/* 左：单Agent */}
        <ChatPanel
          title="单Agent"
          icon="🧠"
          messages={singleMessages}
          roundMarkers={[]}
          moderatorResults={[]}
          finalResult={singleFinal}
          status="思考中..."
          isRunning={singleRunning}
        />

        {/* 右：多Agent */}
        <ChatPanel
          title={`多Agent脑爆 (${personas.filter(p => p.name).length}人)`}
          icon="🔥"
          messages={multiMessages}
          roundMarkers={[]}
          moderatorResults={multiModResults}
          finalResult={multiFinal}
          status={multiStatus}
          isRunning={multiRunning}
        />
      </div>

      {/* 投票栏 */}
      {stage === "done" && !vote && (
        <div
          className="flex items-center justify-center gap-6 py-4"
          style={{ borderTop: `1px solid ${BORDER}`, background: BG_CARD }}
        >
          <span className="text-sm" style={{ color: TEXT_DIM }}>
            哪个创意更好？
          </span>
          <button
            onClick={() => setVote("single")}
            className="cursor-pointer px-6 py-2 rounded-lg text-sm font-bold transition-all"
            style={{
              background: "rgba(78,205,196,0.1)",
              border: "2px solid #4ecdc4",
              color: "#4ecdc4",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(78,205,196,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(78,205,196,0.1)")}
          >
            👈 单Agent更好
          </button>
          <button
            onClick={() => setVote("multi")}
            className="cursor-pointer px-6 py-2 rounded-lg text-sm font-bold transition-all"
            style={{
              background: "rgba(255,215,0,0.1)",
              border: "2px solid #ffd700",
              color: "#ffd700",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,215,0,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,215,0,0.1)")}
          >
            多Agent更好 👉
          </button>
          <button
            onClick={() => setVote("tie")}
            className="cursor-pointer px-4 py-2 rounded-lg text-xs transition-all"
            style={{
              background: "transparent",
              border: `1px solid ${BORDER}`,
              color: TEXT_DIM,
            }}
          >
            差不多
          </button>
        </div>
      )}
      {vote && (
        <div
          className="flex items-center justify-center py-3"
          style={{ borderTop: `1px solid ${BORDER}`, background: BG_CARD }}
        >
          <span className="text-sm" style={{ color: GOLD }}>
            ✅ 你投了「{vote === "single" ? "单Agent" : vote === "multi" ? "多Agent" : "差不多"}」—— 感谢反馈！
          </span>
          <button
            onClick={onBack}
            className="ml-4 text-xs cursor-pointer px-4 py-1 rounded"
            style={{ border: `1px solid ${BORDER}`, color: TEXT_DIM }}
          >
            再来一次
          </button>
        </div>
      )}
    </div>
  );
}
