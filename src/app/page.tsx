'use client'
import { useEffect, useState, useCallback } from 'react'
import GoalCard from '@/components/GoalCard'
import GoalModal from '@/components/GoalModal'

type Sphere = { id: string; name: string; emoji: string; color: string; sort_order: number }
type Task = { id: string; title: string; done: number }
type Goal = {
  id: string; sphere_id: string; title: string; description: string | null
  deadline: string | null; status: string; priority: string
  energizer: string | null; blocker: string | null; energy_level: string | null
  burnout_signal: string | null; ideal_week_slot: string | null
  tasks: Task[]
}
type AgentCheckin = {
  agent: { id: string; name: string; meaning: string; emoji: string; sphereName: string; color: string; subtitle: string; sphereId: string }
  checkin: { message: string; questions: string[]; suggestions: string[]; created_at: string } | null
}

const AGENTS = [
  { id: 'praan', name: 'Praan', meaning: 'Life Force', emoji: '💪', sphereId: 'health', sphereName: 'Health', subtitle: 'fitness, sleep, nutrition', color: '#fecdd3' },
  { id: 'arjun', name: 'Arjun', meaning: 'Focused Achiever', emoji: '🚀', sphereId: 'career', sphereName: 'Career', subtitle: 'work, projects, skills', color: '#fef08a' },
  { id: 'lakshmi', name: 'Lakshmi', meaning: 'Prosperity', emoji: '💰', sphereId: 'finances', sphereName: 'Finances', subtitle: 'savings, investments', color: '#bbf7d0' },
  { id: 'vidya', name: 'Vidya', meaning: 'Knowledge', emoji: '📚', sphereId: 'learning', sphereName: 'Learning', subtitle: 'books, courses, ideas', color: '#bfdbfe' },
  { id: 'kala', name: 'Kala', meaning: 'Art & Craft', emoji: '🎨', sphereId: 'creative', sphereName: 'Creative', subtitle: 'writing, art, side projects', color: '#e9d5ff' },
  { id: 'mitra', name: 'Mitra', meaning: 'Companion', emoji: '🫂', sphereId: 'relationships', sphereName: 'Relationships', subtitle: 'family, friends, dating', color: '#fed7aa' },
  { id: 'ananda', name: 'Ananda', meaning: 'Bliss', emoji: '🧘', sphereId: 'wellbeing', sphereName: 'Wellbeing', subtitle: 'mindfulness, therapy, joy', color: '#a7f3d0' },
  { id: 'griha', name: 'Griha', meaning: 'Home', emoji: '🏡', sphereId: 'home', sphereName: 'Home & Life', subtitle: 'errands, travel, admin', color: '#d9f99d' },
]

export default function Dashboard() {
  const [spheres, setSpheres] = useState<Sphere[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [calConnected, setCalConnected] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [agentCheckins, setAgentCheckins] = useState<AgentCheckin[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [activeSphere, setActiveSphere] = useState<string | null>(null)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [section, setSection] = useState<'home' | 'goals'>('home')
  const [filter, setFilter] = useState<'active' | 'completed'>('active')
  const [calMsg, setCalMsg] = useState<string | null>(null)
  const [cleanupDone, setCleanupDone] = useState(false)

  const load = useCallback(async () => {
    const [goalsRes, calRes, agentsRes] = await Promise.all([
      fetch('/api/goals'),
      fetch('/api/calendar/status'),
      fetch('/api/agents/daily'),
    ])
    const { spheres: s, goals: g } = await goalsRes.json()
    const { connected } = await calRes.json()
    const checkins = await agentsRes.json()
    setSpheres(s)
    setGoals(g)
    setCalConnected(connected)
    setAgentCheckins(checkins)
  }, [])

  useEffect(() => {
    load()
    const params = new URLSearchParams(window.location.search)
    if (params.get('cal') === 'connected') setCalMsg('Google Calendar connected!')
    if (params.get('cal')) window.history.replaceState({}, '', '/')
  }, [load])

  async function runAgents() {
    setAgentsLoading(true)
    await fetch('/api/agents/daily', { method: 'POST' })
    const res = await fetch('/api/agents/daily')
    setAgentCheckins(await res.json())
    setAgentsLoading(false)
  }

  async function handleSaveGoal(data: Record<string, unknown>) {
    await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    setShowModal(false)
    load()
  }

  async function handleUpdateGoal(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/goals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    load()
  }

  async function handleDeleteGoal(id: string) {
    if (!confirm('Delete this goal?')) return
    await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    load()
  }

  async function cleanupCalendar() {
    await fetch('/api/calendar/cleanup', { method: 'POST' })
    setCleanupDone(true)
  }

  const filteredGoals = goals.filter(g => {
    if (g.status !== filter) return false
    if (activeSphere && g.sphere_id !== activeSphere) return false
    return true
  })

  const goalsBySphere = spheres.map(s => ({ ...s, goals: filteredGoals.filter(g => g.sphere_id === s.id) }))
  const goalsForSphere = (id: string) => goals.filter(g => g.sphere_id === id && g.status === 'active').length

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navigation */}
      <nav className="border-b border-zinc-800 sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold">Life OS</h1>
            <div className="flex gap-1 bg-zinc-900 rounded-lg p-0.5">
              <button onClick={() => setSection('home')}
                className={`text-sm px-3 py-1 rounded-md transition-colors ${section === 'home' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
                Home
              </button>
              <button onClick={() => setSection('goals')}
                className={`text-sm px-3 py-1 rounded-md transition-colors ${section === 'goals' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
                Goals
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!calConnected && (
              <a href="/api/auth/google" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium transition-colors">
                Connect Calendar
              </a>
            )}
            <button onClick={() => setShowModal(true)}
              className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors">
              + New goal
            </button>
          </div>
        </div>
      </nav>

      {calMsg && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="text-sm px-4 py-2 rounded-lg bg-emerald-900/50 text-emerald-300 border border-emerald-800">
            {calMsg} <button onClick={() => setCalMsg(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      {section === 'home' ? (
        <main className="max-w-6xl mx-auto px-6 py-10 space-y-12">
          {/* Hero */}
          <section className="text-center space-y-2">
            <h2 className="text-4xl font-bold tracking-tight">Your Personal Life OS</h2>
            <p className="text-zinc-400 text-lg">Goals + to-dos + daily motivation — powered by 8 AI agents</p>
          </section>

          {/* Life Spheres Grid */}
          <section>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Life Spheres</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {AGENTS.map(agent => (
                <button key={agent.id} onClick={() => { setExpandedAgent(expandedAgent === agent.id ? null : agent.id) }}
                  className="rounded-2xl p-5 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: agent.color }}>
                  <div className="text-3xl mb-2">{agent.emoji}</div>
                  <div className="font-bold text-zinc-900 text-lg">{agent.sphereName}</div>
                  <div className="text-sm text-zinc-600">{agent.subtitle}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-700 bg-white/50 px-2 py-0.5 rounded-full">
                      {agent.name} — {agent.meaning}
                    </span>
                    {goalsForSphere(agent.sphereId) > 0 && (
                      <span className="text-xs font-medium text-zinc-700 bg-white/50 px-2 py-0.5 rounded-full">
                        {goalsForSphere(agent.sphereId)} goals
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Agent Check-in (expanded) */}
          {expandedAgent && (() => {
            const agent = AGENTS.find(a => a.id === expandedAgent)
            const checkin = agentCheckins.find(c => c.agent.sphereId === agent?.sphereId)
            if (!agent) return null
            return (
              <section className="rounded-2xl border border-zinc-800 overflow-hidden" style={{ borderColor: agent.color + '40' }}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: agent.color + '15' }}>
                  <div>
                    <span className="text-lg font-bold">{agent.emoji} {agent.name}</span>
                    <span className="text-zinc-400 ml-2">— your {agent.sphereName} agent</span>
                  </div>
                  <button onClick={() => { setActiveSphere(agent.sphereId); setSection('goals') }}
                    className="text-sm bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-700">
                    View goals →
                  </button>
                </div>
                <div className="px-6 py-5">
                  {checkin?.checkin ? (
                    <div className="space-y-4">
                      <p className="text-zinc-200 leading-relaxed">{checkin.checkin.message}</p>
                      {checkin.checkin.questions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Questions for you</h4>
                          {checkin.checkin.questions.map((q, i) => (
                            <p key={i} className="text-zinc-300 text-sm mb-1">→ {q}</p>
                          ))}
                        </div>
                      )}
                      {checkin.checkin.suggestions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Suggestions</h4>
                          {checkin.checkin.suggestions.map((s, i) => (
                            <p key={i} className="text-zinc-300 text-sm mb-1">✦ {s}</p>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-zinc-600">Last check-in: {new Date(checkin.checkin.created_at).toLocaleString()}</p>
                    </div>
                  ) : (
                    <p className="text-zinc-500 italic">No check-in yet. Run your agents to hear from {agent.name}.</p>
                  )}
                </div>
              </section>
            )
          })()}

          {/* Divider arrow */}
          <div className="text-center text-zinc-600 text-xl">↓</div>

          {/* Info Cards */}
          <section>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                <div className="text-xl mb-2">🧠 8 AI Agents</div>
                <p className="text-zinc-300 text-sm leading-relaxed">Each sphere has a dedicated agent with a unique personality. They check in daily with questions, suggestions, and encouragement.</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {AGENTS.map(a => (
                    <span key={a.id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: a.color, color: '#1f2937' }}>
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                <div className="text-xl mb-2">📋 Goal Tracker</div>
                <p className="text-zinc-300 text-sm leading-relaxed">Set goals across all 8 spheres with deadlines, sub-tasks, and Ali Abdaal&apos;s Feel Good Productivity pillars — Energize, Unblock, Sustain.</p>
                <p className="text-zinc-500 text-xs mt-3">Goals auto-sync to Google Calendar.</p>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                <div className="text-xl mb-2">📬 Daily Emails</div>
                <p className="text-zinc-300 text-sm leading-relaxed">Every morning, all 8 agents generate a personalized briefing delivered straight to your Gmail. Evening wind-downs too.</p>
                <p className="text-zinc-500 text-xs mt-3">Powered by Claude + Gmail API.</p>
              </div>
            </div>
          </section>

          {/* Divider arrow */}
          <div className="text-center text-zinc-600 text-xl">↓</div>

          {/* Run Agents */}
          <section className="text-center space-y-4">
            <button onClick={runAgents} disabled={agentsLoading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20">
              {agentsLoading ? 'Agents thinking...' : '🧠 Run All Agents'}
            </button>
            <p className="text-zinc-500 text-sm">Generates check-ins from all 8 agents + sends email summary</p>
            {calConnected && !cleanupDone && (
              <button onClick={cleanupCalendar}
                className="text-xs text-zinc-500 underline hover:text-zinc-300 transition-colors">
                Remove old Ideal Week events from calendar
              </button>
            )}
            {cleanupDone && <p className="text-xs text-emerald-400">Ideal Week events removed from calendar.</p>}
          </section>

          {/* Agent Grid Summary */}
          {agentCheckins.some(c => c.checkin) && (
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Latest Check-ins</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {agentCheckins.filter(c => c.checkin).map(({ agent, checkin }) => (
                  <button key={agent.sphereId} onClick={() => setExpandedAgent(agent.id)}
                    className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-left hover:border-zinc-600 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: agent.color }}>
                        {agent.emoji}
                      </span>
                      <span className="font-semibold text-sm">{agent.name}</span>
                      <span className="text-xs text-zinc-500">— {agent.sphereName}</span>
                    </div>
                    <p className="text-sm text-zinc-300 line-clamp-2">{checkin?.message}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      ) : (
        /* Goals Section */
        <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setActiveSphere(null)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!activeSphere ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
              All spheres
            </button>
            {AGENTS.map(a => (
              <button key={a.id} onClick={() => setActiveSphere(a.sphereId === activeSphere ? null : a.sphereId)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${activeSphere === a.sphereId ? 'text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                style={activeSphere === a.sphereId ? { backgroundColor: a.color } : undefined}>
                {a.emoji} {a.sphereName}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 w-fit">
            {(['active', 'completed'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors capitalize ${filter === f ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {f}
              </button>
            ))}
          </div>

          {filteredGoals.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <div className="text-4xl mb-3">🎯</div>
              <p className="font-medium">No {filter} goals{activeSphere ? ` in ${AGENTS.find(a => a.sphereId === activeSphere)?.sphereName}` : ''}</p>
              <p className="text-sm mt-1">Add your first goal to get started</p>
              <button onClick={() => setShowModal(true)} className="mt-4 text-sm bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 font-medium">
                + New goal
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {goalsBySphere.map(sphere => sphere.goals.length > 0 && (
                <section key={sphere.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base" style={{ background: sphere.color }}>
                      {sphere.emoji}
                    </div>
                    <h2 className="font-semibold text-zinc-200 text-sm">{sphere.name}</h2>
                    <span className="text-xs text-zinc-500">{sphere.goals.length} goal{sphere.goals.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sphere.goals.map(goal => (
                      <GoalCard key={goal.id} goal={goal} onUpdate={handleUpdateGoal} onDelete={handleDeleteGoal} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      )}

      {showModal && (
        <GoalModal spheres={spheres} onClose={() => setShowModal(false)} onSave={handleSaveGoal} />
      )}
    </div>
  )
}
