import React, { useState, useEffect, useCallback, useRef } from 'react'
import TEMPLATES from './data/worldTemplates'
import { simulateTick } from './api/claude'
import WorldSelect from './components/WorldSelect'
import TopBar from './components/TopBar'
import WorldMap from './components/WorldMap'
import ObserverPanel from './components/ObserverPanel'
import DialoguePanel from './components/DialoguePanel'

function initializeNPCs(template) {
  return template.npcs.map(npc => ({
    ...npc,
    memories: [],
    relationships: {},
    action: '',
    thought: '',
  }))
}

export default function App() {
  const [phase, setPhase] = useState('select') // 'select' | 'running'
  const [template, setTemplate] = useState(null)
  const [npcs, setNpcs] = useState([])
  const [events, setEvents] = useState([])
  const [dialogues, setDialogues] = useState([])
  const [tick, setTick] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [selectedNPC, setSelectedNPC] = useState(null)
  const [pendingIntervention, setPendingIntervention] = useState(null)
  const [error, setError] = useState(null)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('dreamina_api_key') || '')

  const busyRef = useRef(false)

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('dreamina_api_key', apiKey)
    }
  }, [apiKey])

  const handleSelectTemplate = useCallback((tmpl) => {
    setTemplate(tmpl)
    setNpcs(initializeNPCs(tmpl))
    setEvents([])
    setDialogues([])
    setTick(1)
    setIsPlaying(false)
    setSelectedNPC(null)
    setPendingIntervention(null)
    setError(null)
    setPhase('running')
  }, [])

  const handleBack = useCallback(() => {
    setIsPlaying(false)
    setPhase('select')
    setTemplate(null)
    setSelectedNPC(null)
  }, [])

  const advanceDay = useCallback(async () => {
    if (busyRef.current || !template || !apiKey) return

    busyRef.current = true
    setIsBusy(true)
    setError(null)

    try {
      const interventionText = pendingIntervention
        ? template.interventions.find(i => i.id === pendingIntervention)?.description || null
        : null

      const result = await simulateTick(apiKey, template, npcs, tick, interventionText)

      setNpcs(prev => {
        const updated = [...prev]
        for (const npcUpdate of result.npcs) {
          const idx = updated.findIndex(n => n.id === npcUpdate.id)
          if (idx === -1) continue
          const npc = { ...updated[idx] }

          if (npcUpdate.act) npc.action = npcUpdate.act
          if (npcUpdate.reg) npc.region = npcUpdate.reg
          if (npcUpdate.th) npc.thought = npcUpdate.th
          if (npcUpdate.mood) npc.mood = npcUpdate.mood
          if (npcUpdate.mv !== undefined) npc.moodValue = npcUpdate.mv

          if (npcUpdate.mem) {
            npc.memories = [...npc.memories, `第${tick}天: ${npcUpdate.mem}`].slice(-15)
          }

          if (npcUpdate.rc && Array.isArray(npcUpdate.rc)) {
            const rels = { ...npc.relationships }
            for (const change of npcUpdate.rc) {
              const existing = rels[change.t] || { sentiment: 0, notes: '' }
              const newSentiment = Math.max(-10, Math.min(10, existing.sentiment + (change.d || 0)))
              rels[change.t] = {
                sentiment: newSentiment,
                notes: change.w || existing.notes,
              }
            }
            npc.relationships = rels
          }

          updated[idx] = npc
        }
        return updated
      })

      if (result.sum) {
        setEvents(prev => [{ tick, text: result.sum }, ...prev])
      }

      if (result.talks && Array.isArray(result.talks)) {
        const newDialogues = result.talks.map(t => ({
          tick,
          from: t.f,
          to: t.t,
          content: t.s,
        }))
        setDialogues(prev => [...newDialogues, ...prev].slice(0, 50))
      }

      setPendingIntervention(null)
      setTick(prev => prev + 1)
    } catch (err) {
      console.error('Simulation error:', err)
      setError(err.message || '模拟出错')
      setIsPlaying(false)
    } finally {
      busyRef.current = false
      setIsBusy(false)
    }
  }, [template, npcs, tick, pendingIntervention, apiKey])

  // Auto-play loop
  useEffect(() => {
    if (!isPlaying) return
    const timer = setInterval(() => {
      if (!busyRef.current) {
        advanceDay()
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [isPlaying, advanceDay])

  if (phase === 'select') {
    return (
      <div className="app">
        <WorldSelect
          templates={TEMPLATES}
          onSelect={handleSelectTemplate}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <TopBar
        template={template}
        tick={tick}
        isPlaying={isPlaying}
        isBusy={isBusy}
        onTogglePlay={() => setIsPlaying(p => !p)}
        onAdvance={advanceDay}
        onBack={handleBack}
        error={error}
      />
      <div className="intervention-bar">
        <span className="intervention-label">🌩️ 天命：</span>
        {template.interventions.map(iv => (
          <button
            key={iv.id}
            className={`intervention-btn ${pendingIntervention === iv.id ? 'active' : ''}`}
            onClick={() => setPendingIntervention(pendingIntervention === iv.id ? null : iv.id)}
            title={iv.description}
            disabled={isBusy}
          >
            {iv.emoji} {iv.name}
          </button>
        ))}
        {pendingIntervention && (
          <span className="intervention-hint">（将在下一天生效）</span>
        )}
      </div>
      <div className="main-layout">
        <div className="left-panel">
          <WorldMap
            regions={template.regions}
            npcs={npcs}
            selectedNPC={selectedNPC}
            onSelectNPC={setSelectedNPC}
          />
          <DialoguePanel
            dialogues={dialogues}
            npcs={npcs}
          />
        </div>
        <div className="right-panel">
          <ObserverPanel
            npcs={npcs}
            events={events}
            selectedNPC={selectedNPC}
            onSelectNPC={setSelectedNPC}
          />
        </div>
      </div>
    </div>
  )
}
