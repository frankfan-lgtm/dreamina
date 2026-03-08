import React, { useRef, useEffect } from 'react'

export default function DialoguePanel({ dialogues, npcs }) {
  const containerRef = useRef(null)

  const getNpc = (id) => npcs.find(n => n.id === id)

  return (
    <div className="dialogue-panel">
      <h3 className="panel-title">💬 众生之声</h3>
      <div className="dialogue-list" ref={containerRef}>
        {dialogues.length === 0 ? (
          <p className="empty-text">还没有对话发生...</p>
        ) : (
          dialogues.map((dlg, i) => {
            const fromNpc = getNpc(dlg.from)
            const toNpc = getNpc(dlg.to)
            return (
              <div key={i} className="dialogue-item">
                <span className="dialogue-tick">第{dlg.tick}天</span>
                <span className="dialogue-from">
                  {fromNpc?.emoji || '?'}{fromNpc?.name || dlg.from}
                </span>
                <span className="dialogue-arrow">→</span>
                <span className="dialogue-to">
                  {toNpc?.emoji || '?'}{toNpc?.name || dlg.to}
                </span>
                <span className="dialogue-content">"{dlg.content}"</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
