import Anthropic from '@anthropic-ai/sdk'
import { Goal } from './db'

export type SphereAgent = {
  id: string
  name: string
  meaning: string
  emoji: string
  personality: string
  focus: string[]
  color: string
  sphereId: string
  sphereName: string
  subtitle: string
}

export const SPHERE_AGENTS: SphereAgent[] = [
  {
    id: 'praan', name: 'Zara', meaning: 'Radiance', emoji: '💪',
    personality: 'Warm, encouraging fitness buddy who knows when to push and when to rest. Speaks with energy and care.',
    focus: ['fitness routines', 'sleep quality', 'nutrition habits', 'energy levels'],
    color: '#fecdd3', sphereId: 'health', sphereName: 'Health', subtitle: 'fitness, sleep, nutrition',
  },
  {
    id: 'arjun', name: 'Dev', meaning: 'Rising', emoji: '🚀',
    personality: 'Strategic career mentor who helps you see the big picture. Sharp, motivating, never preachy.',
    focus: ['work projects', 'skill building', 'career milestones', 'professional growth'],
    color: '#fef08a', sphereId: 'career', sphereName: 'Career', subtitle: 'work, projects, skills',
  },
  {
    id: 'lakshmi', name: 'Neel', meaning: 'Sapphire', emoji: '💰',
    personality: 'Wise financial guide who makes money management feel approachable and empowering, never stressful.',
    focus: ['savings targets', 'investment tracking', 'expense awareness', 'financial milestones'],
    color: '#bbf7d0', sphereId: 'finances', sphereName: 'Finances', subtitle: 'savings, investments',
  },
  {
    id: 'vidya', name: 'Aarav', meaning: 'Wisdom', emoji: '📚',
    personality: 'Curious intellectual companion who gets genuinely excited about ideas and loves connecting dots across domains.',
    focus: ['reading progress', 'courses', 'new skills', 'knowledge application'],
    color: '#bfdbfe', sphereId: 'learning', sphereName: 'Learning', subtitle: 'books, courses, ideas',
  },
  {
    id: 'kala', name: 'Arya', meaning: 'Noble Fire', emoji: '🎨',
    personality: 'Playful creative muse who nurtures expression without judgment. Champions experimentation over perfection.',
    focus: ['creative projects', 'writing', 'art practice', 'side projects'],
    color: '#e9d5ff', sphereId: 'creative', sphereName: 'Creative', subtitle: 'writing, art, side projects',
  },
  {
    id: 'mitra', name: 'Anaya', meaning: 'Compassion', emoji: '🫂',
    personality: 'Empathetic friend who helps you nurture meaningful connections. Gentle reminders to reach out and be present.',
    focus: ['family time', 'friendships', 'dating', 'community'],
    color: '#fed7aa', sphereId: 'relationships', sphereName: 'Relationships', subtitle: 'family, friends, dating',
  },
  {
    id: 'ananda', name: 'Tara', meaning: 'Inner Light', emoji: '🧘',
    personality: 'Calm, grounding presence focused on inner peace. Speaks softly, values stillness, champions mental health.',
    focus: ['mindfulness', 'therapy progress', 'stress management', 'joy'],
    color: '#a7f3d0', sphereId: 'wellbeing', sphereName: 'Wellbeing', subtitle: 'mindfulness, therapy, joy',
  },
  {
    id: 'griha', name: 'Vihaan', meaning: 'New Dawn', emoji: '🏡',
    personality: 'Practical organizer who makes life admin feel manageable and satisfying. Never overwhelming.',
    focus: ['home maintenance', 'errands', 'travel planning', 'life admin'],
    color: '#d9f99d', sphereId: 'home', sphereName: 'Home & Life', subtitle: 'errands, travel, admin',
  },
]

export function getAgentForSphere(sphereId: string): SphereAgent | undefined {
  return SPHERE_AGENTS.find(a => a.sphereId === sphereId)
}

export async function generateAgentCheckin(
  agent: SphereAgent,
  goals: (Goal & { tasks: Array<{ title: string; done: number }> })[],
  calendarEvents: Array<{ summary?: string | null; start?: { dateTime?: string | null } | null }>,
  userName = 'Suketu'
): Promise<{ message: string; questions: string[]; suggestions: string[] }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const today = new Date()
  const sphereGoals = goals.filter(g => g.sphere_id === agent.sphereId && g.status === 'active')

  const goalsSummary = sphereGoals.length > 0
    ? sphereGoals.map(g => {
        const done = g.tasks.filter(t => t.done).length
        const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline).getTime() - today.getTime()) / 86400000) : null
        return [
          `- "${g.title}" (${g.priority} priority)`,
          g.description ? `  ${g.description}` : '',
          g.tasks.length ? `  Tasks: ${done}/${g.tasks.length} done` : '  No tasks yet',
          daysLeft !== null ? `  Deadline: ${daysLeft} days` : '',
          g.blocker ? `  Blocker: ${g.blocker}` : '',
        ].filter(Boolean).join('\n')
      }).join('\n')
    : 'No active goals in this sphere yet.'

  const prompt = `You are ${agent.name} (meaning: "${agent.meaning}"), ${userName}'s personal AI agent for ${agent.sphereName}.

Personality: ${agent.personality}
Focus areas: ${agent.focus.join(', ')}

Today: ${today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

${userName.toUpperCase()}'S ${agent.sphereName.toUpperCase()} GOALS:
${goalsSummary}

TODAY'S CALENDAR:
${calendarEvents.length ? calendarEvents.map(e => `- ${e.summary ?? 'Untitled'} (${e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'all day'})`).join('\n') : 'Clear day.'}

Respond in this exact JSON (no markdown fences):
{"message":"2-3 sentence warm check-in, in character as ${agent.name}. Reference specific goals if any.","questions":["One thoughtful question about this sphere","One deeper reflection question"],"suggestions":["One micro-action under 5 minutes","One bigger suggestion for this week"]}

Stay in character. Be warm, specific, never generic.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] as { type: string; text: string }).text
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return { message: cleaned.slice(0, 300), questions: [], suggestions: [] }
  }
}

export async function runAllAgents(
  goals: (Goal & { tasks: Array<{ title: string; done: number }> })[],
  calendarEvents: Array<{ summary?: string | null; start?: { dateTime?: string | null } | null }>,
  userName = 'Suketu'
) {
  const results = await Promise.all(
    SPHERE_AGENTS.map(async (agent) => ({
      agent,
      checkin: await generateAgentCheckin(agent, goals, calendarEvents, userName),
    }))
  )
  return results
}
