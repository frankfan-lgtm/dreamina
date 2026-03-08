import React from 'react'

export default function WorldSelect({ templates, onSelect, apiKey, onApiKeyChange }) {
  return (
    <div className="world-select">
      <div className="select-header">
        <h1 className="title">创世模拟器</h1>
        <p className="subtitle">选择一个世界，观察文明的涌现</p>
      </div>

      <div className="api-key-section">
        <label className="api-key-label">
          🔑 Anthropic API Key
          <input
            type="password"
            className="api-key-input"
            value={apiKey}
            onChange={e => onApiKeyChange(e.target.value)}
            placeholder="sk-ant-..."
          />
        </label>
        {!apiKey && <p className="api-key-hint">需要API Key才能启动模拟</p>}
      </div>

      <div className="template-grid">
        {templates.map(tmpl => (
          <button
            key={tmpl.id}
            className="template-card"
            onClick={() => onSelect(tmpl)}
            disabled={!apiKey}
          >
            <div className="template-emoji">{tmpl.emoji}</div>
            <h2 className="template-name">{tmpl.name}</h2>
            <p className="template-tagline">{tmpl.tagline}</p>
            <div className="template-meta">
              <span>{tmpl.regions.length} 个区域</span>
              <span>·</span>
              <span>{tmpl.npcs.length} 个角色</span>
            </div>
            <div className="template-npcs">
              {tmpl.npcs.map(npc => (
                <span key={npc.id} className="template-npc-emoji" title={npc.name}>
                  {npc.emoji}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <p className="footer-text">
        AI驱动的生态缸 — 搭好缸、放进鱼，趴在玻璃前看它们自己活
      </p>
    </div>
  )
}
