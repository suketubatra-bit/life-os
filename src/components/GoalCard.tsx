'use client'
import { useState } from 'react'

type Task = { id: string; title: string; done: number }
type Goal = {
  id: string; sphere_id: string; title: string; description: string | null
  deadline: string | null; status: string; priority: string
  energizer: string | null; blocker: string | null; energy_level: string | null
  burnout_signal: string | null; ideal_week_slot: string | null
  tasks: Task[]
}

const ENERGIZER_COLORS: Record<string, string> = {
  play: 'bg-yellow-900/50 text-yellow-300', power: 'bg-orange-900/50 text-orange-300',
  people: 'bg-pink-900/50 text-pink-300', adventure: 'bg-purple-900/50 text-purple-300',
  challenge: 'bg-indigo-900/50 text-indigo-300',
}
const BLOCKER_COLORS: Record<string, string> = {
  fear: 'bg-red-900/50 text-red-300', uncertainty: 'bg-sky-900/50 text-sky-300',
  inertia: 'bg-blue-900/50 text-blue-300', overwhelm: 'bg-violet-900/50 text-violet-300',
}
const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-400', medium: 'bg-yellow-400', low: 'bg-green-400',
}

function daysLeft(deadline: string): { n: number; label: string; urgent: boolean } {
  const n = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  return { n, label: n === 0 ? 'today!' : n < 0 ? `${Math.abs(n)}d overdue` : `${n}d left`, urgent: n <= 3 }
}

export default function GoalCard({ goal, onUpdate, onDelete }: {
  goal: Goal
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [tasks, setTasks] = useState<Task[]>(goal.tasks)
  const [newTask, setNewTask] = useState('')
  const [expanded, setExpanded] = useState(false)

  const deadline = goal.deadline ? daysLeft(goal.deadline) : null
  const progress = tasks.length ? Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) : null

  async function addTask() {
    if (!newTask.trim()) return
    const res = await fetch(`/api/goals/${goal.id}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTask }),
    })
    const task = await res.json()
    setTasks(t => [...t, task])
    setNewTask('')
  }

  async function toggleTask(taskId: string, done: number) {
    await fetch(`/api/goals/${goal.id}/tasks`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, done: done === 0 ? 1 : 0 }),
    })
    setTasks(t => t.map(tk => tk.id === taskId ? { ...tk, done: tk.done === 0 ? 1 : 0 } : tk))
  }

  return (
    <div className={`bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-600 transition-all ${goal.status === 'completed' ? 'opacity-60' : ''}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[goal.priority]}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-zinc-100 text-sm leading-snug">{goal.title}</h3>
              <button onClick={() => setExpanded(e => !e)} className="text-zinc-500 hover:text-zinc-300 flex-shrink-0 text-xs">
                {expanded ? '▲' : '▼'}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {goal.energizer && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENERGIZER_COLORS[goal.energizer]}`}>
                  ⚡ {goal.energizer}
                </span>
              )}
              {goal.blocker && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BLOCKER_COLORS[goal.blocker]}`}>
                  🔓 {goal.blocker}
                </span>
              )}
              {deadline && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${deadline.urgent ? 'bg-red-900/50 text-red-300' : 'bg-zinc-800 text-zinc-400'}`}>
                  ⏰ {deadline.label}
                </span>
              )}
            </div>

            {progress !== null && (
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-zinc-500">{tasks.filter(t => t.done).length}/{tasks.length} tasks</span>
                  <span className="text-xs text-zinc-500">{progress}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-3">
          {goal.description && <p className="text-sm text-zinc-400">{goal.description}</p>}

          {(goal.energy_level || goal.ideal_week_slot || goal.burnout_signal) && (
            <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400 space-y-1">
              {goal.energy_level && <div>Energy: <span className="text-zinc-200 font-medium">{goal.energy_level}</span></div>}
              {goal.ideal_week_slot && <div>Ideal slot: <span className="text-zinc-200 font-medium">{goal.ideal_week_slot}</span></div>}
              {goal.burnout_signal && <div>Burnout signal: <span className="text-zinc-200 font-medium">{goal.burnout_signal}</span></div>}
            </div>
          )}

          <div className="space-y-1.5">
            {tasks.map(task => (
              <label key={task.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={task.done === 1} onChange={() => toggleTask(task.id, task.done)}
                  className="rounded accent-indigo-600" />
                <span className={`text-sm ${task.done ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>{task.title}</span>
              </label>
            ))}
            <div className="flex gap-2 mt-2">
              <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="Add task..." className="flex-1 text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <button onClick={addTask} className="text-xs bg-indigo-600/20 text-indigo-400 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/30">Add</button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            {goal.status !== 'completed' && (
              <button onClick={() => onUpdate(goal.id, { status: 'completed' })} className="text-xs bg-emerald-600/20 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-600/30 font-medium">
                ✓ Done
              </button>
            )}
            <button onClick={() => onDelete(goal.id)} className="text-xs bg-red-600/20 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-600/30 font-medium ml-auto">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
