import React from 'react'

function getMoodColor(moodValue) {
  if (moodValue >= 7) return '#5a9868'
  if (moodValue >= 4) return '#c08850'
  return '#a85050'
}

function NPCDetail({ npc, allNpcs, onClose }) {
  return (
    <div className="npc-detail">
      <div className="npc-detail-header">
        <span className="npc-detail-emoji">{npc.emoji}</span>
        <div>
          <h3 className="npc-detail-name">{npc.name}</h3>
          <span className="npc-detail-mood" style={{ color: getMoodColor(npc.moodValue) }}>
            {npc.mood}
          </span>
          <div className="mood-bar-container">
            <div
              className="mood-bar"
              style={{
                width: `${npc.moodValue * 10}%`,
                backgroundColor: getMoodColor(npc.moodValue),
              }}
            />
          </div>
        </div>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {npc.thought && (
        <div className="npc-section">
          <h4>💭 内心独白</h4>
          <p className="npc-thought">{npc.thought}</p>
        </div>
      )}

      {npc.action && (
        <div className="npc-section">
          <h4>🎬 当前行为</h4>
          <p>{npc.action}</p>
        </div>
      )}

      <div className="npc-section">
        <h4>🧠 记忆</h4>
        {npc.memories.length === 0 ? (
          <p className="empty-text">尚无记忆</p>
        ) : (
          <ul className="memory-list">
            {[...npc.memories].reverse().map((mem, i) => (
              <li key={i}>{mem}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="npc-section">
        <h4>🤝 关系</h4>
        {Object.keys(npc.relationships).length === 0 ? (
          <p className="empty-text">尚未建立关系</p>
        ) : (
          <div className="relationship-list">
            {Object.entries(npc.relationships).map(([targetId, rel]) => {
              const target = allNpcs.find(n => n.id === targetId)
              if (!target) return null
              return (
                <div key={targetId} className="relationship-item">
                  <span className="rel-emoji">{target.emoji}</span>
                  <span className="rel-name">{target.name}</span>
                  <span
                    className="rel-sentiment"
                    style={{ color: rel.sentiment >= 0 ? '#5a9868' : '#a85050' }}
                  >
                    {rel.sentiment > 0 ? '+' : ''}{rel.sentiment}
                  </span>
                  <span className="rel-notes">{rel.notes}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="npc-section">
        <h4>📝 性格</h4>
        <p className="personality-text">{npc.personality}</p>
      </div>
    </div>
  )
}

function Chronicle({ events }) {
  return (
    <div className="chronicle">
      <h3 className="panel-title">📜 世界编年史</h3>
      {events.length === 0 ? (
        <p className="empty-text">世界刚刚诞生，还没有历史...</p>
      ) : (
        <ul className="event-list">
          {events.map((evt, i) => (
            <li key={i} className="event-item">
              <span className="event-tick">第{evt.tick}天</span>
              <span className="event-text">{evt.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ObserverPanel({ npcs, events, selectedNPC, onSelectNPC }) {
  const selectedNPCData = selectedNPC ? npcs.find(n => n.id === selectedNPC) : null

  return (
    <div className="observer-panel">
      {selectedNPCData ? (
        <NPCDetail
          npc={selectedNPCData}
          allNpcs={npcs}
          onClose={() => onSelectNPC(null)}
        />
      ) : (
        <Chronicle events={events} />
      )}

      <div className="npc-quick-bar">
        {npcs.map(npc => (
          <button
            key={npc.id}
            className={`npc-quick-btn ${selectedNPC === npc.id ? 'selected' : ''}`}
            onClick={() => onSelectNPC(selectedNPC === npc.id ? null : npc.id)}
            title={`${npc.name} - ${npc.mood}`}
          >
            {npc.emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
