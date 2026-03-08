import React from 'react'

export default function TopBar({ template, tick, isPlaying, isBusy, onTogglePlay, onAdvance, onBack, error }) {
  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <button className="back-btn" onClick={onBack} title="返回选择">
          ← 返回
        </button>
        <span className="world-title">
          {template.emoji} {template.name}
        </span>
      </div>

      <div className="top-bar-center">
        <span className="tick-display">
          第 <strong>{tick}</strong> 天
        </span>
        {isBusy && <span className="busy-indicator">⟳ 推演中...</span>}
        {error && <span className="error-indicator" title={error}>⚠ 出错</span>}
      </div>

      <div className="top-bar-right">
        <button
          className="control-btn"
          onClick={onAdvance}
          disabled={isBusy || isPlaying}
          title="手动推进一天"
        >
          ▶ 下一天
        </button>
        <button
          className={`control-btn ${isPlaying ? 'playing' : ''}`}
          onClick={onTogglePlay}
          disabled={isBusy && !isPlaying}
          title={isPlaying ? '暂停' : '自动推进'}
        >
          {isPlaying ? '⏸ 暂停' : '⏩ 自动'}
        </button>
      </div>
    </div>
  )
}
