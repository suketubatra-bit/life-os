'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
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
type Trip = {
  id: string; origin: string; destination: string
  depart_date: string; return_date: string | null
  target_price: number | null; currency: string; notes: string | null
  status: 'watching' | 'booked' | 'archived'
  latest_price: number | null; latest_link: string | null; latest_checked_at: string | null
}
type TravelDeal = {
  tripId: string; route: string; price: string; rawPrice: number
  belowTarget: boolean; dropFromLast: number | null; airline: string | null; link: string | null
}
type YatraCheckin = {
  agent: { name: string; emoji: string; color: string; sphereName: string; meaning: string }
  checkin: { message: string; questions: string[]; suggestions: string[]; created_at: string } | null
}

function fmtMoney(amount: number, currency = 'INR') {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount) }
  catch { return `${currency} ${amount.toLocaleString()}` }
}

const AGENTS = [
  { id: 'praan',   name: 'Zara',   meaning: 'Radiance',    emoji: '💪', sphereId: 'health',        sphereName: 'Health',       subtitle: 'fitness, sleep, nutrition',    color: '#fecdd3' },
  { id: 'arjun',   name: 'Dev',    meaning: 'Rising',      emoji: '🚀', sphereId: 'career',        sphereName: 'Career',       subtitle: 'work, projects, skills',       color: '#fef08a' },
  { id: 'lakshmi', name: 'Neel',   meaning: 'Sapphire',    emoji: '💰', sphereId: 'finances',      sphereName: 'Finances',     subtitle: 'savings, investments',         color: '#bbf7d0' },
  { id: 'vidya',   name: 'Aarav',  meaning: 'Wisdom',      emoji: '📚', sphereId: 'learning',      sphereName: 'Learning',     subtitle: 'books, courses, ideas',        color: '#bfdbfe' },
  { id: 'kala',    name: 'Arya',   meaning: 'Noble Fire',  emoji: '🎨', sphereId: 'creative',      sphereName: 'Creative',     subtitle: 'writing, art, side projects',  color: '#e9d5ff' },
  { id: 'mitra',   name: 'Anaya',  meaning: 'Compassion',  emoji: '🫂', sphereId: 'relationships', sphereName: 'Relationships',subtitle: 'family, friends, dating',      color: '#fed7aa' },
  { id: 'ananda',  name: 'Tara',   meaning: 'Inner Light', emoji: '🧘', sphereId: 'wellbeing',     sphereName: 'Wellbeing',    subtitle: 'mindfulness, therapy, joy',    color: '#a7f3d0' },
  { id: 'griha',   name: 'Vihaan', meaning: 'New Dawn',    emoji: '🏡', sphereId: 'home',          sphereName: 'Home & Life',  subtitle: 'errands, travel, admin',       color: '#d9f99d' },
]

/* ─── Star field canvas ─────────────────────────────────────── */
function StarField() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    let raf: number
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const pts = Array.from({ length: 160 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.3 + 0.2,
      o: Math.random() * 0.45 + 0.06,
      v: Math.random() * 0.00008 + 0.00002,
      ph: Math.random() * 6.28,
    }))

    let t = 0
    function tick() {
      ctx.clearRect(0, 0, c.width, c.height)
      t++
      for (const p of pts) {
        const alpha = p.o * (0.55 + 0.45 * Math.sin(t * 0.018 + p.ph))
        ctx.beginPath()
        ctx.arc(p.x * c.width, p.y * c.height, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`
        ctx.fill()
        p.y += p.v
        if (p.y > 1) { p.y = 0; p.x = Math.random() }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />
}

/* ─── 3-D tilt agent orb ────────────────────────────────────── */
type AgentOrbProps = {
  agent: typeof AGENTS[number]
  goalCount: number
  hasCheckin: boolean
  isSelected: boolean
  onClick: () => void
}

function AgentOrb({ agent, goalCount, hasCheckin, isSelected, onClick }: AgentOrbProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const [rot, setRot] = useState({ x: 0, y: 0 })
  const [hover, setHover] = useState(false)

  const onMove = (e: React.MouseEvent) => {
    if (!wrap.current) return
    const r = wrap.current.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    setRot({ x: ny * -20, y: nx * 20 })
  }

  const scale = isSelected ? 1.06 : hover ? 1.03 : 1
  const easing = hover
    ? 'transform 0.08s ease-out, box-shadow 0.12s, background 0.12s, border-color 0.12s'
    : 'transform 0.55s cubic-bezier(0.23,1,0.32,1), box-shadow 0.4s, background 0.4s, border-color 0.4s'

  return (
    <div
      ref={wrap}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setRot({ x: 0, y: 0 }) }}
      onClick={onClick}
      className="cursor-pointer select-none"
      style={{ perspective: '700px' }}
    >
      <div
        style={{
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg) scale(${scale})`,
          transition: easing,
          transformStyle: 'preserve-3d',
          borderRadius: 20,
          padding: '22px 14px 18px',
          textAlign: 'center',
          background: isSelected
            ? `radial-gradient(ellipse at 38% 22%, ${agent.color}44, ${agent.color}0a 65%)`
            : hover
              ? `radial-gradient(ellipse at 38% 22%, ${agent.color}26, transparent 65%)`
              : `radial-gradient(ellipse at 38% 22%, ${agent.color}12, transparent 70%)`,
          border: `1px solid ${
            isSelected ? agent.color + '70' : hover ? agent.color + '38' : 'rgba(255,255,255,0.07)'
          }`,
          boxShadow: isSelected
            ? `0 0 50px ${agent.color}30, 0 20px 60px rgba(0,0,0,0.65), inset 0 1px 0 ${agent.color}22`
            : hover
              ? `0 0 18px ${agent.color}18, 0 12px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`
              : `0 2px 14px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* Glowing emoji sphere — lifted via translateZ */}
        <div style={{
          width: 62, height: 62, borderRadius: '50%',
          margin: '0 auto 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
          background: `radial-gradient(circle at 33% 28%, ${agent.color}ff, ${agent.color}99)`,
          boxShadow: `0 6px 22px ${agent.color}55, 0 2px 6px rgba(0,0,0,0.28), inset 0 -2px 4px rgba(0,0,0,0.12)`,
          transform: 'translateZ(26px)',
        }}>
          {agent.emoji}
        </div>

        <p style={{
          fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.92)',
          margin: '0 0 3px', letterSpacing: '0.01em',
          transform: 'translateZ(16px)',
        }}>
          {agent.sphereName}
        </p>

        <p style={{
          fontSize: 10.5, color: agent.color, opacity: 0.82,
          margin: 0, fontWeight: 500, letterSpacing: '0.04em',
          transform: 'translateZ(11px)',
        }}>
          {agent.name}
        </p>

        <div style={{
          marginTop: 12, display: 'flex', justifyContent: 'center', gap: 5,
          transform: 'translateZ(13px)', flexWrap: 'wrap',
        }}>
          {goalCount > 0 && (
            <span style={{
              fontSize: 9.5, fontWeight: 600, lineHeight: 1,
              padding: '3px 8px', borderRadius: 20,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.55)',
            }}>
              {goalCount} goal{goalCount !== 1 ? 's' : ''}
            </span>
          )}
          {hasCheckin && (
            <span style={{
              fontSize: 9.5, lineHeight: 1,
              padding: '3px 7px', borderRadius: 20,
              background: agent.color + '22',
              border: `1px solid ${agent.color}44`,
              color: agent.color,
            }}>✓ briefed</span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Dashboard ─────────────────────────────────────────────── */
export default function Dashboard() {
  const [spheres, setSpheres] = useState<Sphere[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [calConnected, setCalConnected] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [agentCheckins, setAgentCheckins] = useState<AgentCheckin[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [activeSphere, setActiveSphere] = useState<string | null>(null)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [section, setSection] = useState<'home' | 'goals' | 'travel'>('home')
  const [filter, setFilter] = useState<'active' | 'completed'>('active')
  const [calMsg, setCalMsg] = useState<string | null>(null)
  const [cleanupDone, setCleanupDone] = useState(false)
  const [trips, setTrips] = useState<Trip[]>([])
  const [yatra, setYatra] = useState<YatraCheckin | null>(null)
  const [deals, setDeals] = useState<TravelDeal[]>([])
  const [checkingPrices, setCheckingPrices] = useState(false)
  const [tripForm, setTripForm] = useState({
    origin: '', destination: '', depart_date: '', return_date: '', target_price: '', notes: '',
  })

  const load = useCallback(async () => {
    const [goalsRes, calRes, agentsRes] = await Promise.all([
      fetch('/api/goals'),
      fetch('/api/calendar/status'),
      fetch('/api/agents/daily'),
    ])
    const { spheres: s, goals: g } = await goalsRes.json()
    const { connected } = await calRes.json()
    const checkins = await agentsRes.json()
    setSpheres(s); setGoals(g); setCalConnected(connected); setAgentCheckins(checkins)
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
    setShowModal(false); load()
  }

  async function handleUpdateGoal(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/goals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    load()
  }

  async function handleDeleteGoal(id: string) {
    if (!confirm('Delete this goal?')) return
    await fetch(`/api/goals/${id}`, { method: 'DELETE' }); load()
  }

  async function cleanupCalendar() {
    await fetch('/api/calendar/cleanup', { method: 'POST' }); setCleanupDone(true)
  }

  const loadTravel = useCallback(async () => {
    const [tripsRes, yatraRes] = await Promise.all([fetch('/api/trips'), fetch('/api/trips/check')])
    setTrips(await tripsRes.json()); setYatra(await yatraRes.json())
  }, [])

  useEffect(() => { if (section === 'travel') loadTravel() }, [section, loadTravel])

  async function addTrip(e: React.FormEvent) {
    e.preventDefault()
    if (!tripForm.origin || !tripForm.destination || !tripForm.depart_date) return
    await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tripForm) })
    setTripForm({ origin: '', destination: '', depart_date: '', return_date: '', target_price: '', notes: '' })
    loadTravel()
  }

  async function deleteTrip(id: string) {
    if (!confirm('Stop watching this trip?')) return
    await fetch(`/api/trips/${id}`, { method: 'DELETE' }); loadTravel()
  }

  async function checkPrices() {
    setCheckingPrices(true)
    const res = await fetch('/api/trips/check', { method: 'POST' })
    const data = await res.json()
    setDeals(data.deals ?? [])
    await loadTravel()
    setCheckingPrices(false)
  }

  const filteredGoals = goals.filter(g => {
    if (g.status !== filter) return false
    if (activeSphere && g.sphere_id !== activeSphere) return false
    return true
  })

  const goalsBySphere = spheres.map(s => ({ ...s, goals: filteredGoals.filter(g => g.sphere_id === s.id) }))
  const goalsForSphere = (id: string) => goals.filter(g => g.sphere_id === id && g.status === 'active').length
  const lastRun = agentCheckins.find(c => c.checkin)?.checkin?.created_at

  /* shared input style */
  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#fff', outline: 'none',
    boxSizing: 'border-box', colorScheme: 'dark',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#040410', color: '#fff', position: 'relative', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <StarField />

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        button:focus-visible, a:focus-visible { outline: 2px solid rgba(139,92,246,0.6); outline-offset: 2px; }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── NAV ──────────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(4,4,16,0.8)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 17 }}>🧠</span>
                <span style={{
                  fontSize: 14, fontWeight: 800, letterSpacing: '0.02em',
                  background: 'linear-gradient(130deg, #a78bfa, #60a5fa)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>Life OS</span>
              </div>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: 3, border: '1px solid rgba(255,255,255,0.06)' }}>
                {(['home', 'goals', 'travel'] as const).map(s => (
                  <button key={s} onClick={() => setSection(s)} style={{
                    fontSize: 12, padding: '5px 13px', borderRadius: 8,
                    border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
                    background: section === s ? 'rgba(255,255,255,0.11)' : 'transparent',
                    color: section === s ? '#fff' : 'rgba(255,255,255,0.38)',
                  }}>
                    {s === 'home' ? '⬡ Home' : s === 'goals' ? '◎ Goals' : '✈ Travel'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {section === 'home' && (
                <button onClick={runAgents} disabled={agentsLoading} style={{
                  fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 9,
                  border: 'none', cursor: agentsLoading ? 'wait' : 'pointer',
                  background: agentsLoading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  color: '#fff', opacity: agentsLoading ? 0.65 : 1, transition: 'all 0.2s',
                  boxShadow: agentsLoading ? 'none' : '0 4px 16px rgba(99,102,241,0.4)',
                }}>
                  {agentsLoading ? '⟳ Thinking…' : '✨ Run agents'}
                </button>
              )}
              {!calConnected && (
                <a href="/api/auth/google" style={{
                  fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 9,
                  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)',
                  textDecoration: 'none', border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  Connect Cal
                </a>
              )}
              <button onClick={() => setShowModal(true)} style={{
                fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 9,
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)',
                border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              }}>
                + Goal
              </button>
            </div>
          </div>
        </nav>

        {calMsg && (
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '12px 20px' }}>
            <div style={{ fontSize: 13, padding: '10px 16px', borderRadius: 10, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
              {calMsg}
              <button onClick={() => setCalMsg(null)} style={{ marginLeft: 10, opacity: 0.5, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', fontSize: 13 }}>✕</button>
            </div>
          </div>
        )}

        {/* ══ HOME ════════════════════════════════════════ */}
        {section === 'home' && (
          <main style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 20px', animation: 'fadeIn 0.4s ease' }}>

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <h2 style={{
                  margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(255,255,255,0.35))',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>Your life spheres</h2>
                <p style={{ margin: '5px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>
                  Click any agent to explore
                </p>
              </div>
              {lastRun && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'right', margin: 0 }}>
                  Last brief<br />
                  <span style={{ color: 'rgba(255,255,255,0.38)' }}>
                    {new Date(lastRun).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
              )}
            </div>

            {/* Agent orb grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {AGENTS.map(agent => (
                <AgentOrb
                  key={agent.id}
                  agent={agent}
                  goalCount={goalsForSphere(agent.sphereId)}
                  hasCheckin={agentCheckins.some(c => c.agent.sphereId === agent.sphereId && c.checkin)}
                  isSelected={expandedAgent === agent.id}
                  onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                />
              ))}
            </div>

            {/* ── Expanded agent panel ───────────────────── */}
            {expandedAgent && (() => {
              const agent = AGENTS.find(a => a.id === expandedAgent)
              const checkin = agentCheckins.find(c => c.agent.sphereId === agent?.sphereId)
              const sphereGoals = goals.filter(g => g.sphere_id === agent?.sphereId && g.status === 'active')
              if (!agent) return null

              return (
                <div
                  key={expandedAgent}
                  style={{
                    marginTop: 18,
                    borderRadius: 22,
                    overflow: 'hidden',
                    border: `1px solid ${agent.color}28`,
                    animation: 'slideUp 0.38s cubic-bezier(0.23,1,0.32,1)',
                    background: `radial-gradient(ellipse at 15% 0%, ${agent.color}10, transparent 55%), rgba(10,10,22,0.92)`,
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    boxShadow: `0 0 80px ${agent.color}10, 0 32px 80px rgba(0,0,0,0.6)`,
                  }}
                >
                  {/* Panel header */}
                  <div style={{
                    padding: '14px 22px',
                    borderBottom: `1px solid ${agent.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: `linear-gradient(135deg, ${agent.color}14, transparent 60%)`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', fontSize: 18,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `radial-gradient(circle at 33% 28%, ${agent.color}ff, ${agent.color}99)`,
                        boxShadow: `0 4px 18px ${agent.color}55`,
                        flexShrink: 0,
                      }}>
                        {agent.emoji}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{agent.name}</span>
                          <span style={{ fontSize: 11.5, color: agent.color, opacity: 0.7, fontStyle: 'italic' }}>{agent.meaning}</span>
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', margin: 0 }}>
                          {agent.sphereName} · {agent.subtitle}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setExpandedAgent(null)} style={{
                      fontSize: 12, padding: '4px 11px', borderRadius: 8, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.35)', transition: 'all 0.15s',
                    }}>✕</button>
                  </div>

                  {/* Panel body — two columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2">

                    {/* LEFT: AI check-in */}
                    <div style={{ padding: '22px 24px', borderRight: `1px solid ${agent.color}12` }}>
                      <p style={{
                        fontSize: 9.5, fontWeight: 800, color: agent.color,
                        textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 14px',
                      }}>
                        {agent.name}&apos;s check-in
                      </p>

                      {checkin?.checkin ? (
                        <div style={{ animation: 'fadeIn 0.35s ease 0.1s both' }}>
                          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', lineHeight: 1.68, margin: '0 0 16px' }}>
                            {checkin.checkin.message}
                          </p>

                          {checkin.checkin.suggestions.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              {checkin.checkin.suggestions.map((s, i) => (
                                <div key={i} style={{ display: 'flex', gap: 9, marginBottom: 8, alignItems: 'flex-start' }}>
                                  <span style={{ color: agent.color, fontSize: 11, flexShrink: 0, marginTop: 1.5 }}>✦</span>
                                  <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.48)', margin: 0, lineHeight: 1.6 }}>{s}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {checkin.checkin.questions.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              {checkin.checkin.questions.map((q, i) => (
                                <div key={i} style={{ display: 'flex', gap: 9, marginBottom: 6, alignItems: 'flex-start' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, flexShrink: 0, marginTop: 1.5 }}>→</span>
                                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', margin: 0, lineHeight: 1.55 }}>{q}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.14)', margin: 0 }}>
                            {new Date(checkin.checkin.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '28px 0', animation: 'fadeIn 0.3s ease' }}>
                          <p style={{ fontSize: 32, margin: '0 0 10px' }}>💤</p>
                          <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', margin: 0 }}>No check-in yet</p>
                          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.18)', margin: '5px 0 0' }}>Hit &ldquo;Run agents&rdquo; above</p>
                        </div>
                      )}
                    </div>

                    {/* RIGHT: Goals */}
                    <div style={{ padding: '22px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <p style={{
                          fontSize: 9.5, fontWeight: 800, color: agent.color,
                          textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0,
                        }}>Active goals</p>
                        <button
                          onClick={() => { setActiveSphere(agent.sphereId); setSection('goals') }}
                          style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.15s' }}
                        >
                          All →
                        </button>
                      </div>

                      {sphereGoals.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '28px 0', animation: 'fadeIn 0.3s ease 0.15s both' }}>
                          <p style={{ fontSize: 30, margin: '0 0 10px' }}>🌱</p>
                          <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.28)', margin: 0 }}>No goals here yet</p>
                          <button onClick={() => setShowModal(true)} style={{
                            marginTop: 12, fontSize: 12, color: '#818cf8',
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          }}>+ Add one</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'fadeIn 0.3s ease 0.15s both' }}>
                          {sphereGoals.map(goal => {
                            const daysLeft = goal.deadline
                              ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000)
                              : null
                            const urgent = daysLeft !== null && daysLeft <= 3
                            return (
                              <div key={goal.id} style={{
                                padding: '10px 14px', borderRadius: 12,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{
                                    fontSize: 13, color: 'rgba(255,255,255,0.86)', fontWeight: 600,
                                    margin: 0, lineHeight: 1.35,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                  }}>
                                    {goal.title}
                                  </p>
                                  {goal.description && (
                                    <p style={{
                                      fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '3px 0 0',
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                      {goal.description}
                                    </p>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  {goal.priority === 'high' && (
                                    <span style={{ fontSize: 9.5, color: '#f87171', fontWeight: 800 }}>HIGH</span>
                                  )}
                                  {daysLeft !== null && (
                                    <span style={{
                                      fontSize: 10.5, fontWeight: 700,
                                      color: urgent ? '#f87171' : daysLeft <= 7 ? '#fbbf24' : 'rgba(255,255,255,0.22)',
                                    }}>
                                      {daysLeft <= 0 ? 'overdue' : `${daysLeft}d`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          <button onClick={() => setShowModal(true)} style={{
                            fontSize: 11.5, color: 'rgba(255,255,255,0.22)',
                            background: 'none', border: '1px dashed rgba(255,255,255,0.1)',
                            borderRadius: 10, padding: '8px', cursor: 'pointer', marginTop: 2,
                            transition: 'all 0.15s',
                          }}>
                            + Add goal in {agent.sphereName}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Calendar utilities */}
            {(calConnected || cleanupDone) && (
              <div style={{ textAlign: 'center', marginTop: 28, fontSize: 11 }}>
                {calConnected && !cleanupDone && (
                  <button onClick={cleanupCalendar} style={{ color: 'rgba(255,255,255,0.18)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}>
                    Remove old Ideal Week events
                  </button>
                )}
                {cleanupDone && <p style={{ color: '#34d399' }}>Ideal Week events removed.</p>}
              </div>
            )}
          </main>
        )}

        {/* ══ GOALS ══════════════════════════════════════ */}
        {section === 'goals' && (
          <main style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px', animation: 'fadeIn 0.3s ease' }}>
            {/* Sphere filter pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
              <button onClick={() => setActiveSphere(null)} style={{
                fontSize: 11.5, padding: '5px 13px', borderRadius: 20, cursor: 'pointer', fontWeight: 600,
                background: !activeSphere ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.06)',
                color: !activeSphere ? '#050410' : 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.15s',
              }}>All spheres</button>
              {AGENTS.map(a => (
                <button key={a.id} onClick={() => setActiveSphere(a.sphereId === activeSphere ? null : a.sphereId)} style={{
                  fontSize: 11.5, padding: '5px 13px', borderRadius: 20, cursor: 'pointer', fontWeight: 600,
                  background: activeSphere === a.sphereId ? a.color : 'rgba(255,255,255,0.06)',
                  color: activeSphere === a.sphereId ? '#050410' : 'rgba(255,255,255,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.15s',
                }}>{a.emoji} {a.sphereName}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 3, width: 'fit-content', marginBottom: 26, border: '1px solid rgba(255,255,255,0.07)' }}>
              {(['active', 'completed'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  fontSize: 12, padding: '5px 15px', borderRadius: 9, cursor: 'pointer', fontWeight: 600,
                  border: 'none', transition: 'all 0.15s', textTransform: 'capitalize',
                  background: filter === f ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: filter === f ? '#fff' : 'rgba(255,255,255,0.32)',
                }}>{f}</button>
              ))}
            </div>

            {filteredGoals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '72px 0', color: 'rgba(255,255,255,0.28)' }}>
                <div style={{ fontSize: 42, marginBottom: 14 }}>🎯</div>
                <p style={{ fontWeight: 600, margin: '0 0 5px', fontSize: 15 }}>No {filter} goals{activeSphere ? ` in ${AGENTS.find(a => a.sphereId === activeSphere)?.sphereName}` : ''}</p>
                <p style={{ fontSize: 13, margin: '0 0 18px' }}>Add your first goal to get started</p>
                <button onClick={() => setShowModal(true)} style={{
                  fontSize: 13, fontWeight: 700, padding: '9px 20px', borderRadius: 11, cursor: 'pointer',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none',
                  boxShadow: '0 4px 18px rgba(99,102,241,0.4)',
                }}>+ New goal</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
                {goalsBySphere.map(sphere => sphere.goals.length > 0 && (
                  <section key={sphere.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, background: sphere.color }}>
                        {sphere.emoji}
                      </div>
                      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.68)', margin: 0 }}>{sphere.name}</h2>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.24)' }}>{sphere.goals.length} goal{sphere.goals.length !== 1 ? 's' : ''}</span>
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

        {/* ══ TRAVEL ═════════════════════════════════════ */}
        {section === 'travel' && (
          <main style={{ maxWidth: 920, margin: '0 auto', padding: '28px 20px', animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* Yatra header */}
            <section style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(165,243,252,0.14)' }}>
              <div style={{
                padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'radial-gradient(ellipse at 18% 50%, rgba(165,243,252,0.08), transparent 55%)',
                borderBottom: yatra?.checkin ? '1px solid rgba(165,243,252,0.1)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: '#a5f3fc', boxShadow: '0 4px 18px rgba(165,243,252,0.28)', flexShrink: 0 }}>
                    ✈️
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 2px', color: '#fff' }}>
                      Yatra <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.32)' }}>— Journey</span>
                    </h2>
                    <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.32)', margin: 0 }}>Your travel agent · tracks fares & sends price alerts</p>
                  </div>
                </div>
                <button onClick={checkPrices} disabled={checkingPrices} style={{
                  fontSize: 12.5, fontWeight: 700, padding: '7px 16px', borderRadius: 10, border: 'none',
                  cursor: checkingPrices ? 'wait' : 'pointer',
                  background: checkingPrices ? 'rgba(8,145,178,0.35)' : 'linear-gradient(135deg,#06b6d4,#0891b2)',
                  color: '#fff', opacity: checkingPrices ? 0.6 : 1, transition: 'all 0.2s',
                  boxShadow: checkingPrices ? 'none' : '0 4px 14px rgba(6,182,212,0.32)',
                }}>
                  {checkingPrices ? 'Checking…' : 'Check prices'}
                </button>
              </div>
              {yatra?.checkin && (
                <div style={{ padding: '18px 24px', background: 'rgba(4,4,16,0.5)' }}>
                  <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.68, margin: '0 0 12px' }}>{yatra.checkin.message}</p>
                  {yatra.checkin.suggestions.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {yatra.checkin.suggestions.map((s, i) => (
                        <p key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', margin: '0 0 6px' }}>✦ {s}</p>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.16)', margin: 0 }}>Last check: {new Date(yatra.checkin.created_at).toLocaleString()}</p>
                </div>
              )}
            </section>

            {/* Deal alerts */}
            {deals.length > 0 && (
              <section>
                <h3 style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Latest fares</h3>
                {deals.map(d => (
                  <div key={d.tripId} style={{
                    borderRadius: 13, padding: '12px 16px', marginBottom: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: d.belowTarget ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${d.belowTarget ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 3px', color: '#fff' }}>{d.route} — {d.price}</p>
                      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                        {d.belowTarget && <span style={{ color: '#34d399' }}>🎯 Below target! </span>}
                        {(d.dropFromLast ?? 0) > 0 && <span style={{ color: '#22d3ee' }}>📉 Dropped </span>}
                        {d.airline && `· ${d.airline}`}
                      </p>
                    </div>
                    {d.link && <a href={d.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#22d3ee', textDecoration: 'none', fontWeight: 700 }}>View →</a>}
                  </div>
                ))}
              </section>
            )}

            {/* Add trip form */}
            <section style={{ borderRadius: 20, padding: '20px 22px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '0 0 16px' }}>Watch a new trip</h3>
              <form onSubmit={addTrip} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', display: 'block', marginBottom: 5 }}>From (IATA)</label>
                    <input value={tripForm.origin} onChange={e => setTripForm({ ...tripForm, origin: e.target.value.toUpperCase() })}
                      placeholder="BRS" maxLength={3} style={{ ...inp, textTransform: 'uppercase' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', display: 'block', marginBottom: 5 }}>To (IATA)</label>
                    <input value={tripForm.destination} onChange={e => setTripForm({ ...tripForm, destination: e.target.value.toUpperCase() })}
                      placeholder="BHD" maxLength={3} style={{ ...inp, textTransform: 'uppercase' }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', display: 'block', marginBottom: 5 }}>Departure</label>
                    <input type="date" value={tripForm.depart_date} onChange={e => setTripForm({ ...tripForm, depart_date: e.target.value })} style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', display: 'block', marginBottom: 5 }}>Return (optional)</label>
                    <input type="date" value={tripForm.return_date} onChange={e => setTripForm({ ...tripForm, return_date: e.target.value })} style={inp} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', display: 'block', marginBottom: 5 }}>Target price (alert below)</label>
                    <input type="number" value={tripForm.target_price} onChange={e => setTripForm({ ...tripForm, target_price: e.target.value })}
                      placeholder="150" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', display: 'block', marginBottom: 5 }}>Notes</label>
                    <input value={tripForm.notes} onChange={e => setTripForm({ ...tripForm, notes: e.target.value })}
                      placeholder="ACPGBI conference" style={inp} />
                  </div>
                </div>
                <button type="submit" style={{
                  width: '100%', fontSize: 13, fontWeight: 700, padding: '10px', borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#06b6d4,#0891b2)', color: '#fff',
                  boxShadow: '0 4px 16px rgba(6,182,212,0.28)', marginTop: 2,
                }}>
                  + Watch this trip
                </button>
              </form>
            </section>

            {/* Watched trips */}
            <section>
              <h3 style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 13px' }}>Watched trips</h3>
              {trips.filter(t => t.status === 'watching').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '52px 0', color: 'rgba(255,255,255,0.24)' }}>
                  <div style={{ fontSize: 38, marginBottom: 12 }}>🧳</div>
                  <p style={{ fontWeight: 600, margin: '0 0 5px' }}>No trips yet</p>
                  <p style={{ fontSize: 13 }}>Add a trip above and Yatra will track fares for you.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {trips.filter(t => t.status === 'watching').map(trip => {
                    const daysOut = Math.ceil((new Date(trip.depart_date).getTime() - Date.now()) / 86400000)
                    const hit = trip.latest_price != null && trip.target_price != null && trip.latest_price <= trip.target_price
                    return (
                      <div key={trip.id} style={{
                        borderRadius: 15, padding: '14px 18px',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                        background: hit ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${hit ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.07)'}`,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                            <span style={{ fontWeight: 800, fontSize: 16.5, color: '#fff' }}>{trip.origin} → {trip.destination}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 8px' }}>
                              {daysOut > 0 ? `${daysOut}d out` : 'past'}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', margin: '0 0 10px' }}>
                            {new Date(trip.depart_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {trip.return_date ? ` → ${new Date(trip.return_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ' · one-way'}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {trip.latest_price != null ? (
                              <span style={{
                                fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                background: hit ? 'rgba(52,211,153,0.14)' : 'rgba(255,255,255,0.07)',
                                color: hit ? '#34d399' : '#fff',
                              }}>
                                {fmtMoney(trip.latest_price, trip.currency)}{hit && ' 🎯'}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>No price yet</span>
                            )}
                            {trip.target_price != null && (
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>Target {fmtMoney(trip.target_price, trip.currency)}</span>
                            )}
                            {trip.notes && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.24)', fontStyle: 'italic' }}>{trip.notes}</span>}
                          </div>
                        </div>
                        <button onClick={() => deleteTrip(trip.id)} style={{
                          fontSize: 14, color: 'rgba(255,255,255,0.2)', background: 'none',
                          border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6,
                        }}>✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.14)', marginTop: 16 }}>
                Live fares need a Travelpayouts token (<code style={{ fontFamily: 'monospace', fontSize: 10.5 }}>TRAVELPAYOUTS_TOKEN</code>). Use IATA codes (BRS, BHD, BFS, LHR, JFK).
              </p>
            </section>
          </main>
        )}
      </div>

      {showModal && (
        <GoalModal spheres={spheres} onClose={() => setShowModal(false)} onSave={handleSaveGoal} />
      )}
    </div>
  )
}
