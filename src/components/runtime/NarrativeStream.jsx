/**
 * 叙事流组件 — 左侧主区域
 * 渲染导演输出的叙事内容，支持多种类型
 * 流式追加新内容，自动滚动
 */
import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/useStore.jsx";

// 叙事条目类型:
// narration  — 旁白（灰色斜体）
// dialogue   — 对话（带说话人和潜台词）
// info_gap   — 信息差高亮（金色边框）
// thought    — NPC思考（虚线框）
// event      — 系统事件/干预
// chapter    — 章节分隔
// image      — 场景插图

function NarrativeEntry({ entry, npcs }) {
  const getNpcName = (id) => {
    const npc = npcs.find((n) => n.id === id);
    return npc ? `${npc.emoji} ${npc.name}` : id;
  };

  switch (entry.type) {
    case "chapter":
      return (
        <div className="narrative-chapter-header">
          <div className="narrative-chapter-line" />
          <span className="narrative-chapter-time">{entry.time}</span>
          <div className="narrative-chapter-line" />
        </div>
      );

    case "narration":
      return (
        <div className="narrative-narration">
          <div className="narrative-narration-text">{entry.text}</div>
        </div>
      );

    case "dialogue":
      return (
        <div className={`narrative-dialogue ${entry.isInfoGap ? "narrative-info-gap" : ""}`}>
          <div className="narrative-dialogue-header">
            <span className="narrative-dialogue-from">{getNpcName(entry.from)}</span>
            {entry.to && (
              <>
                <span className="narrative-dialogue-arrow">&#10132;</span>
                <span className="narrative-dialogue-to">{getNpcName(entry.to)}</span>
              </>
            )}
          </div>
          <div className="narrative-dialogue-content">{entry.text || entry.content}</div>
          {entry.subtext && (
            <div className="narrative-dialogue-subtext">
              &#128173; {entry.subtext}
            </div>
          )}
        </div>
      );

    case "info_gap":
      return (
        <div className="narrative-info-gap-card">
          <div className="narrative-info-gap-badge">&#128064; 信息差</div>
          <div className="narrative-info-gap-text">{entry.text || entry.description}</div>
          {entry.details && (
            <div className="narrative-info-gap-details">{entry.details}</div>
          )}
        </div>
      );

    case "thought":
      return (
        <div className="narrative-thought">
          <div className="narrative-thought-header">
            <span>{getNpcName(entry.npcId)}</span>
            <span className="narrative-thought-tag">内心</span>
          </div>
          <div className="narrative-thought-text">{entry.text}</div>
        </div>
      );

    case "event":
      return (
        <div className="narrative-event">
          <span>{entry.emoji || "&#9889;"}</span>
          <span>{entry.text}</span>
        </div>
      );

    default:
      return (
        <div className="narrative-narration">
          <div className="narrative-narration-text">{entry.text || JSON.stringify(entry)}</div>
        </div>
      );
  }
}

// 骨架屏
function NarrativeSkeleton() {
  return (
    <div className="narrative-skeleton">
      <div className="narrative-skeleton-line" />
      <div className="narrative-skeleton-line" />
      <div className="narrative-skeleton-line" />
      <div className="narrative-skeleton-line" />
    </div>
  );
}

export default function NarrativeStream() {
  const { narrativeHistory, npcs, isNarrativeLoading, isRunning } = useStore();
  const scrollRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [narrativeHistory, autoScroll]);

  // 检测用户是否手动滚动
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="narrative-column">
      <div className="narrative-header">
        <span>&#128214; 叙事流</span>
        <span className="text-xs text-[--color-text-dim]">
          {narrativeHistory.length} 条
          {isRunning && <span className="ml-1 animate-pulse-glow">&#9679; LIVE</span>}
        </span>
      </div>

      <div className="narrative-stream" ref={scrollRef} onScroll={handleScroll}>
        {narrativeHistory.length === 0 && !isNarrativeLoading && (
          <div className="narrative-empty">
            <div className="narrative-empty-icon">&#10022;</div>
            <div className="narrative-empty-text">世界正在酝酿中...</div>
            <div className="narrative-empty-hint">点击顶部 "运行" 按钮开始模拟</div>
          </div>
        )}

        {narrativeHistory.map((entry, i) => (
          <NarrativeEntry key={i} entry={entry} npcs={npcs} />
        ))}

        {isNarrativeLoading && <NarrativeSkeleton />}
      </div>

      {/* 底部快速滚动到最新 */}
      {!autoScroll && narrativeHistory.length > 0 && (
        <button
          className="narrative-scroll-btn"
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
        >
          &#8595; 跳到最新
        </button>
      )}
    </div>
  );
}
