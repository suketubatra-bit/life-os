import Anthropic from '@anthropic-ai/sdk'
import type { Trip } from './db'
import { getCheapestFlight, formatMoney, type FlightQuote } from './flights'

import type { SphereAgent } from './sphere-agents'

export const YATRA: SphereAgent = {
  id: 'yatra',
  name: 'Yatra',
  meaning: 'Journey',
  emoji: '✈️',
  personality: 'Sharp, deal-hunting travel concierge who loves a bargain and knows the rhythms of airfare. Crisp and practical, never pushy.',
  focus: ['flight prices', 'travel deals', 'booking timing', 'trip planning'],
  color: '#a5f3fc',
  sphereId: 'travel',
  sphereName: 'Travel',
  subtitle: 'flights, deals, price alerts',
}

export type TripWithQuote = Trip & {
  quote: FlightQuote | null
  previousPrice: number | null
}

export type TravelDeal = {
  tripId: string
  route: string
  price: string
  rawPrice: number
  belowTarget: boolean
  dropFromLast: number | null
  airline: string | null
  link: string | null
}

/**
 * Price-check every watched trip and assemble Yatra's daily check-in.
 * `priceHistory` maps trip.id -> the most recent stored price before this run.
 */
export async function generateTravelCheckin(
  trips: Trip[],
  priceHistory: Record<string, number>,
  userName = 'Suketu'
): Promise<{
  message: string
  questions: string[]
  suggestions: string[]
  deals: TravelDeal[]
  quotes: TripWithQuote[]
}> {
  const watching = trips.filter(t => t.status === 'watching')

  // Fetch fresh fares in parallel (null when no API token / no data)
  const quotes: TripWithQuote[] = await Promise.all(
    watching.map(async (trip) => ({
      ...trip,
      quote: await getCheapestFlight(trip),
      previousPrice: priceHistory[trip.id] ?? null,
    }))
  )

  const deals: TravelDeal[] = quotes
    .filter((q): q is TripWithQuote & { quote: FlightQuote } => q.quote !== null)
    .map((q) => {
      const drop = q.previousPrice !== null ? q.previousPrice - q.quote.price : null
      return {
        tripId: q.id,
        route: `${q.origin}→${q.destination}`,
        price: formatMoney(q.quote.price, q.quote.currency),
        rawPrice: q.quote.price,
        belowTarget: q.target_price !== null && q.quote.price <= q.target_price,
        dropFromLast: drop,
        airline: q.quote.airline,
        link: q.quote.link,
      }
    })

  const tripLines = watching.length
    ? watching.map((t) => {
        const q = quotes.find(x => x.id === t.id)?.quote
        const daysOut = Math.ceil((new Date(t.depart_date).getTime() - Date.now()) / 86400000)
        const prev = priceHistory[t.id]
        return [
          `- ${t.origin}→${t.destination}, departs ${t.depart_date}${t.return_date ? ` returns ${t.return_date}` : ' (one-way)'} (${daysOut} days out)`,
          t.target_price ? `  Target: ${formatMoney(t.target_price, t.currency)}` : '  No target price set',
          q ? `  Current cheapest: ${formatMoney(q.price, q.currency)}${q.airline ? ` on ${q.airline}` : ''}${q.transfers === 0 ? ' (nonstop)' : ''}` : '  Live price unavailable (no flights API token configured)',
          prev !== undefined && q ? `  Last check: ${formatMoney(prev, q.currency)} → ${q.price < prev ? 'dropped ↓' : q.price > prev ? 'rose ↑' : 'unchanged'}` : '',
          t.notes ? `  Notes: ${t.notes}` : '',
        ].filter(Boolean).join('\n')
      }).join('\n')
    : 'No trips being watched yet.'

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `You are ${YATRA.name} (meaning: "${YATRA.meaning}"), ${userName}'s personal AI travel agent.

Personality: ${YATRA.personality}

Today: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

${userName.toUpperCase()}'S WATCHED TRIPS:
${tripLines}

${deals.some(d => d.belowTarget) ? `DEALS HIT: ${deals.filter(d => d.belowTarget).map(d => `${d.route} at ${d.price}`).join(', ')}` : ''}
${deals.some(d => d.dropFromLast && d.dropFromLast > 0) ? `PRICE DROPS: ${deals.filter(d => d.dropFromLast && d.dropFromLast > 0).map(d => `${d.route} dropped`).join(', ')}` : ''}

Use your knowledge of airfare patterns (booking windows — typically 1-3 months out for international, weekday vs weekend pricing, seasonality) to advise on timing. If live prices are unavailable, give general booking-timing guidance for these specific routes and dates.

Respond in this exact JSON (no markdown fences):
{"message":"2-3 sentence check-in in character as Yatra. Call out any deal that hit target or any notable price drop. If nothing's watched, nudge them to add a trip.","questions":["One question about their travel plans or flexibility","One question about budget or timing"],"suggestions":["One concrete action (book now / wait / set a target / add a trip)","One money-saving tip specific to these routes or dates"]}

Stay in character. Be specific and practical.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] as { type: string; text: string }).text
  let parsed: { message: string; questions: string[]; suggestions: string[] }
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { message: text.slice(0, 300), questions: [], suggestions: [] }
  }

  return { ...parsed, deals, quotes }
}
