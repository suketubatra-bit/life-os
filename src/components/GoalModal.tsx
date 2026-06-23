'use client'
import { useState } from 'react'

type Sphere = { id: string; name: string; emoji: string }

type GoalFormData = {
  sphere_id: string; title: string; description: string; deadline: string
  priority: 'low' | 'medium' | 'high'; energizer: string; blocker: string
  energy_level: string; ideal_week_slot: string; burnout_signal: string
}

export default function GoalModal({ spheres, onClose, onSave }: {
  spheres: Sphere[]; onClose: () => void; onSave: (data: GoalFormData) => Promise<void>
}) {
  const [form, setForm] = useState<GoalFormData>({
    sphere_id: spheres[0]?.id ?? '', title: '', description: '', deadline: '',
    priority: 'medium', energizer: '', blocker: '', energy_level: '', ideal_week_slot: '', burnout_signal: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof GoalFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const selectCls = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
  const inputCls = selectCls

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-800">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">New Goal</h2>
          <p className="text-sm text-zinc-500 mt-1">Powered by Ali Abdaal&apos;s Feel Good Productivity</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Life Sphere</label>
            <select value={form.sphere_id} onChange={set('sphere_id')} className={selectCls}>
              {spheres.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Goal title *</label>
            <input required value={form.title} onChange={set('title')} placeholder="e.g. Run a 5K by October" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Why does this matter to you?"
              className={inputCls + ' resize-none'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Deadline</label>
              <input type="date" value={form.deadline} onChange={set('deadline')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Priority</label>
              <select value={form.priority} onChange={set('priority')} className={selectCls}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="bg-amber-950/30 rounded-xl p-4 space-y-3 border border-amber-900/50">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">⚡ Energize</p>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">What energizer does this tap into?</label>
              <select value={form.energizer} onChange={set('energizer')} className={selectCls}>
                <option value="">— pick one —</option>
                <option value="play">Play — feels fun or creative</option>
                <option value="power">Power — builds confidence or skill</option>
                <option value="people">People — involves others, community</option>
                <option value="adventure">Adventure — exciting, outside comfort zone</option>
                <option value="challenge">Challenge — stretches me in a good way</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Energy level needed</label>
              <select value={form.energy_level} onChange={set('energy_level')} className={selectCls}>
                <option value="">— pick one —</option>
                <option value="high">High — needs my best hours</option>
                <option value="medium">Medium — anytime</option>
                <option value="low">Low — evenings ok</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-950/30 rounded-xl p-4 space-y-3 border border-blue-900/50">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-wide">🔓 Unblock</p>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">If you procrastinate, what&apos;s usually behind it?</label>
              <select value={form.blocker} onChange={set('blocker')} className={selectCls}>
                <option value="">— pick one —</option>
                <option value="fear">Fear — worried about failing</option>
                <option value="uncertainty">Uncertainty — not sure how to start</option>
                <option value="inertia">Inertia — hard to get going</option>
                <option value="overwhelm">Overwhelm — feels too big</option>
              </select>
            </div>
          </div>

          <div className="bg-emerald-950/30 rounded-xl p-4 space-y-3 border border-emerald-900/50">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide">🌿 Sustain</p>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Burnout signal</label>
              <input value={form.burnout_signal} onChange={set('burnout_signal')} placeholder="e.g. spending 3+ evenings/week" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Ideal week slot</label>
              <input value={form.ideal_week_slot} onChange={set('ideal_week_slot')} placeholder="e.g. Mon/Wed 7–9am" className={inputCls} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
