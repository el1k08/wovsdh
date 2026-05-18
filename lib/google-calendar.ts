/**
 * Google Calendar API integration.
 * Uses OAuth 2.0 refresh-token flow — no interactive auth at runtime.
 * All requests are made via native fetch; no third-party Google libraries.
 */

const LOG_PREFIX = '[google-calendar]'

// ---------------------------------------------------------------------------
// Env var helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${LOG_PREFIX} Missing required environment variable: ${name}`)
  }
  return value
}

// ---------------------------------------------------------------------------
// getAccessToken
// ---------------------------------------------------------------------------

/**
 * Exchanges a refresh token for a short-lived access token.
 * Called once per Calendar API request since access tokens expire quickly
 * and we do not cache them across serverless invocations.
 */
async function getAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = (await response.json()) as { access_token?: string; error?: string }

  if (!data.access_token) {
    throw new Error(`${LOG_PREFIX} Failed to get access token: ${JSON.stringify(data)}`)
  }

  return data.access_token
}

// ---------------------------------------------------------------------------
// Studio-to-config mappings
// ---------------------------------------------------------------------------

/**
 * Returns the OAuth refresh token for the given studio.
 * Supported studio IDs: 'rishon', 'ashdod'.
 */
function getRefreshTokenForStudio(studioId: string): string {
  switch (studioId) {
    case 'rishon':
      return requireEnv('GOOGLE_REFRESH_TOKEN_RISHON')
    case 'ashdod':
      return requireEnv('GOOGLE_REFRESH_TOKEN_ASHDOD')
    default:
      throw new Error(`${LOG_PREFIX} Unknown studio ID for refresh token: ${studioId}`)
  }
}

/**
 * Returns the Google Calendar ID for the given studio.
 * Supported studio IDs: 'rishon', 'ashdod'.
 */
function getCalendarIdForStudio(studioId: string): string {
  switch (studioId) {
    case 'rishon':
      return requireEnv('GOOGLE_CALENDAR_ID_RISHON')
    case 'ashdod':
      return requireEnv('GOOGLE_CALENDAR_ID_ASHDOD')
    default:
      throw new Error(`${LOG_PREFIX} Unknown studio ID for calendar ID: ${studioId}`)
  }
}

// ---------------------------------------------------------------------------
// createCalendarEvent
// ---------------------------------------------------------------------------

interface CreateCalendarEventParams {
  studioId: string
  booking: {
    id: string
    client_first_name: string
    client_last_name: string
    client_phone: string
    client_email: string
    start_at: string  // ISO UTC string
    end_at: string    // ISO UTC string
  }
}

/**
 * Creates a Google Calendar event for a confirmed booking.
 * Returns the newly created event's Google Calendar event ID.
 */
export async function createCalendarEvent(params: CreateCalendarEventParams): Promise<string> {
  const { studioId, booking } = params

  const refreshToken = getRefreshTokenForStudio(studioId)
  const calendarId = getCalendarIdForStudio(studioId)
  const accessToken = await getAccessToken(refreshToken)

  const eventBody = {
    summary: `Запись: ${booking.client_first_name} ${booking.client_last_name}`,
    description: `Телефон: ${booking.client_phone}\nEmail: ${booking.client_email}\nID брони: ${booking.id}`,
    start: {
      dateTime: booking.start_at,
      timeZone: 'Asia/Jerusalem',
    },
    end: {
      dateTime: booking.end_at,
      timeZone: 'Asia/Jerusalem',
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  }

  const encodedCalendarId = encodeURIComponent(calendarId)
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(eventBody),
    },
  )

  if (!response.ok) {
    const errorBody = await response.text()
    console.error(`${LOG_PREFIX} createCalendarEvent failed`, {
      status: response.status,
      booking_id: booking.id,
      body: errorBody,
    })
    throw new Error(
      `${LOG_PREFIX} Failed to create calendar event (HTTP ${response.status}): ${errorBody}`,
    )
  }

  const data = (await response.json()) as { id?: string }

  if (!data.id) {
    throw new Error(
      `${LOG_PREFIX} Calendar API returned no event ID for booking ${booking.id}`,
    )
  }

  return data.id
}

// ---------------------------------------------------------------------------
// deleteCalendarEvent
// ---------------------------------------------------------------------------

interface DeleteCalendarEventParams {
  studioId: string
  eventId: string
}

/**
 * Deletes a Google Calendar event by event ID.
 * If the event is already gone (404), the error is logged and swallowed —
 * this keeps the cancellation flow idempotent.
 * All other HTTP errors are thrown as exceptions.
 */
export async function deleteCalendarEvent(params: DeleteCalendarEventParams): Promise<void> {
  const { studioId, eventId } = params

  const refreshToken = getRefreshTokenForStudio(studioId)
  const calendarId = getCalendarIdForStudio(studioId)
  const accessToken = await getAccessToken(refreshToken)

  const encodedCalendarId = encodeURIComponent(calendarId)
  const encodedEventId = encodeURIComponent(eventId)

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodedEventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  // 204 No Content = success
  if (response.status === 204) {
    return
  }

  // 404 = event already deleted; treat as a no-op
  if (response.status === 404) {
    console.warn(`${LOG_PREFIX} deleteCalendarEvent: event not found (already deleted)`, {
      event_id: eventId,
      studio_id: studioId,
    })
    return
  }

  const errorBody = await response.text()
  console.error(`${LOG_PREFIX} deleteCalendarEvent failed`, {
    status: response.status,
    event_id: eventId,
    studio_id: studioId,
    body: errorBody,
  })
  throw new Error(
    `${LOG_PREFIX} Failed to delete calendar event ${eventId} (HTTP ${response.status}): ${errorBody}`,
  )
}
