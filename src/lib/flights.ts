import type { Trip } from './db'

export type FlightQuote = {
  price: number
  currency: string
  airline: string | null
  departAt: string | null
  returnAt: string | null
  transfers: number | null
  link: string | null
}

/**
 * Fetch the cheapest known fare for a trip via the Travelpayouts (Aviasales)
 * data API. Returns null when no TRAVELPAYOUTS_TOKEN is configured or no fare
 * is found — callers should degrade gracefully (Yatra still gives advice).
 *
 * Get a free token at https://www.travelpayouts.com (Tools → API tokens).
 * Origin/destination must be IATA codes (e.g. DEL, LON, BOM, DXB).
 */
export async function getCheapestFlight(trip: Trip): Promise<FlightQuote | null> {
  const token = process.env.TRAVELPAYOUTS_TOKEN
  if (!token) return null

  const origin = trip.origin.trim().toUpperCase()
  const destination = trip.destination.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) return null

  const params = new URLSearchParams({
    origin,
    destination,
    departure_at: trip.depart_date.slice(0, 10),
    currency: (trip.currency || 'INR').toLowerCase(),
    sorting: 'price',
    limit: '1',
    one_way: trip.return_date ? 'false' : 'true',
    token,
  })
  if (trip.return_date) params.set('return_at', trip.return_date.slice(0, 10))

  const url = `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params.toString()}`

  let json: {
    success?: boolean
    currency?: string
    data?: Array<{
      price?: number
      airline?: string
      departure_at?: string
      return_at?: string
      transfers?: number
      link?: string
    }>
  }
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    json = await res.json()
  } catch {
    return null
  }

  const cheapest = json.data?.[0]
  if (!cheapest?.price) return null

  return {
    price: Math.round(cheapest.price),
    currency: (json.currency || trip.currency || 'INR').toUpperCase(),
    airline: cheapest.airline ?? null,
    departAt: cheapest.departure_at ?? null,
    returnAt: cheapest.return_at ?? null,
    transfers: cheapest.transfers ?? null,
    link: cheapest.link ? `https://www.aviasales.com${cheapest.link}` : null,
  }
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`
  }
}
