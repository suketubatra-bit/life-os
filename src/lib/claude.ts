import Anthropic from '@anthropic-ai/sdk'
import { Goal, Sphere } from './db'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ENERGIZER_LABELS: Record<string, string> = {
  play: '⚡ Play', power: '⚡ Power', people: '⚡ People',
  adventure: '⚡ Adventure', challenge: '⚡ Challenge',
}
const BLOCKER_LABELS: Record<string, string> = {
  fear: '🔓 Fear', uncertainty: '🔓 Uncertainty',
  inertia: '🔓 Inertia', overwhelm: '🔓 Overwhelm',
}

export async function generateDailyBrief(
  type: 'morning' | 'evening',
  goals: (Goal & { tasks: Array<{ title: string; done: number }> })[],
  spheres: Sphere[],
  calendarEvents: Array<{ summary?: string | null; start?: { dateTime?: string | null } | null }>,
  userName = 'Suketu'
): Promise<string> {
  const today = new Date()
  const sphereMap = Object.fromEntries(spheres.map(s => [s.id, s]))

  const activeGoals = goals.filter(g => g.status === 'active')
  const urgentGoals = activeGoals.filter(g => {
    if (!g.deadline) return false
    const days = Math.ceil((new Date(g.deadline).getTime() - today.getTime()) / 86400000)
    return days <= 7 && days >= 0
  })

  const goalsSummary = activeGoals.map(g => {
    const sphere = sphereMap[g.sphere_id]
    const totalTasks = g.tasks.length
    const doneTasks = g.tasks.filter(t => t.done).length
    const daysLeft = g.deadline
      ? Math.ceil((new Date(g.deadline).getTime() - today.getTime()) / 86400000)
      : null
    return [
      `• ${sphere?.emoji ?? ''} [${sphere?.name ?? g.sphere_id}] "${g.title}"`,
      g.energizer ? `  Energizer: ${ENERGIZER_LABELS[g.energizer]}` : '',
      g.blocker ? `  Known blocker: ${BLOCKER_LABELS[g.blocker]}` : '',
      totalTasks ? `  Tasks: ${doneTasks}/${totalTasks} done` : '',
      daysLeft !== null ? `  Deadline: ${daysLeft} days away` : '',
      g.burnout_signal ? `  Burnout signal: ${g.burnout_signal}` : '',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const calSummary = calendarEvents.length
    ? calendarEvents.map(e => `• ${e.summary ?? 'Untitled'} (${e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'all day'})`).join('\n')
    : 'No events on your calendar today.'

  const prompt = type === 'morning'
    ? `You are ${userName}'s personal life coach, deeply versed in Ali Abdaal's Feel Good Productivity framework.

Today is ${today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

ACTIVE GOALS:
${goalsSummary}

TODAY'S CALENDAR:
${calSummary}

Write a warm, personal morning message for ${userName}. Use Ali Abdaal's three pillars:
1. ENERGIZE: Pick 1-2 goals and frame them around how they'll feel good to work on (use the energizer tag — play, power, people, adventure, challenge). Make the work sound genuinely exciting.
2. UNBLOCK: If any goal has a blocker tag, gently name it and give one tiny first action (2 minutes max) to break inertia.
3. SUSTAIN: Notice if any goals show burnout risk or if there's a heavy day. Give permission to rest if needed.

Also reference today's calendar events if relevant.

Rules:
- Maximum 200 words
- Warm and personal, never corporate
- Call them by name (${userName}) at least once
- Use emojis sparingly (1-2 max)
- End with one specific, concrete action for today
- No bullet points — flowing, human prose`
    : `You are ${userName}'s personal life coach using Ali Abdaal's Feel Good Productivity framework.

Today is ${today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

ACTIVE GOALS:
${goalsSummary}

${urgentGoals.length ? `URGENT (due within 7 days):\n${urgentGoals.map(g => `• "${g.title}" — ${Math.ceil((new Date(g.deadline!).getTime() - today.getTime()) / 86400000)} days left`).join('\n')}` : ''}

Write a short, warm evening check-in for ${userName}.

Include:
1. One small celebration — find something to appreciate about today, even if it was a quiet day
2. One gentle deadline nudge if anything is due soon (without guilt or pressure)
3. One micro-action for tomorrow morning — something so small it takes 5 minutes
4. A sustain note: remind them to rest. Quote Abdaal's idea that rest is fuel, not laziness.

Rules:
- Maximum 150 words
- Warm, gentle, like a friend not a manager
- No bullet points — flowing prose`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  return (message.content[0] as { type: string; text: string }).text
}
