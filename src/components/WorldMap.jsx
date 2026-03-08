import React from 'react'

function getMoodColor(moodValue) {
  if (moodValue >= 7) return '#5a9868'
  if (moodValue >= 4) return '#c08850'
  return '#a85050'
}

export default function WorldMap({ regions, npcs, selectedNPC, onSelectNPC }) {
  return (
    <div className="world-map">
      <div className="region-grid">
        {regions.map(region => {
          const npcsHere = npcs.filter(n => n.region === region.id)
          return (
            <div key={region.id} className="region-card">
              <div className="region-header">
                <span className="region-emoji">{region.emoji}</span>
                <span className="region-name">{region.name}</span>
              </div>
              <div className="region-npcs">
                {npcsHere.length === 0 && (
                  <span className="region-empty">空</span>
                )}
                {npcsHere.map(npc => (
                  <button
                    key={npc.id}
                    className={`npc-chip ${selectedNPC === npc.id ? 'selected' : ''}`}
                    onClick={() => onSelectNPC(selectedNPC === npc.id ? null : npc.id)}
                    title={`${npc.name} - ${npc.mood}`}
                  >
                    <span className="npc-chip-emoji">{npc.emoji}</span>
                    <span className="npc-chip-name">{npc.name}</span>
                    <span
                      className="mood-dot"
                      style={{ backgroundColor: getMoodColor(npc.moodValue) }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
