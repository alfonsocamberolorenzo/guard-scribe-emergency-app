import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GuardAssignment {
  id: string
  date: string
  shift_type: string
  doctor_id: string
  doctors: {
    full_name: string
    alias: string
  }
}

interface GoogleCalendarEvent {
  summary: string
  description: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { scheduleId } = await req.json()

    if (!scheduleId) {
      throw new Error('Schedule ID is required')
    }

    console.log(`Syncing schedule ${scheduleId} with Google Calendar`)

    // Get the approved schedule and its assignments
    const { data: schedule, error: scheduleError } = await supabaseClient
      .from('guard_schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('status', 'approved')
      .single()

    if (scheduleError || !schedule) {
      throw new Error('Schedule not found or not approved')
    }

    // Get all assignments for this schedule with doctor info
    const { data: assignments, error: assignmentsError } = await supabaseClient
      .from('guard_assignments')
      .select(`
        *,
        doctors:doctor_id (
          full_name,
          alias
        )
      `)
      .eq('schedule_id', scheduleId)

    if (assignmentsError) {
      throw new Error('Failed to fetch assignments')
    }

    const googleApiKey = Deno.env.get('GOOGLE_CALENDAR_API_KEY')
    const googleClientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID')

    if (!googleApiKey || !googleClientId) {
      throw new Error('Google Calendar credentials not configured')
    }

    // Create calendar events for each assignment
    const events: GoogleCalendarEvent[] = assignments.map((assignment: GuardAssignment) => {
      const date = new Date(assignment.date)
      const doctorName = assignment.doctors?.full_name || 'Unknown Doctor'
      const doctorAlias = assignment.doctors?.alias || ''
      
      let startTime: Date
      let endTime: Date

      if (assignment.shift_type === '7h') {
        // 7h assignment: 3 PM to 10 PM same day
        startTime = new Date(date)
        startTime.setHours(15, 0, 0, 0) // 3 PM
        endTime = new Date(date)
        endTime.setHours(22, 0, 0, 0) // 10 PM
      } else if (assignment.shift_type === '17h') {
        // 17h assignment: 3 PM to 8 AM next day
        startTime = new Date(date)
        startTime.setHours(15, 0, 0, 0) // 3 PM
        endTime = new Date(date)
        endTime.setDate(endTime.getDate() + 1) // Next day
        endTime.setHours(8, 0, 0, 0) // 8 AM
      } else {
        // Default to 7h if shift type is unclear
        startTime = new Date(date)
        startTime.setHours(15, 0, 0, 0)
        endTime = new Date(date)
        endTime.setHours(22, 0, 0, 0)
      }

      return {
        summary: `Guard Duty - ${doctorAlias || doctorName} (${assignment.shift_type})`,
        description: `Guard assignment for Dr. ${doctorName} (${doctorAlias})\nShift Type: ${assignment.shift_type}\nDate: ${date.toLocaleDateString()}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'Europe/Madrid' // Adjust timezone as needed
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Europe/Madrid'
        }
      }
    })

    console.log(`Created ${events.length} calendar events for sync`)

    // Log the events that would be synced (in a real implementation, you'd call Google Calendar API here)
    console.log('Calendar events to sync:', JSON.stringify(events, null, 2))

    // Note: To actually sync with Google Calendar, you would need:
    // 1. OAuth 2.0 flow to get user authorization
    // 2. Access token to make API calls
    // 3. Calendar ID where to create events
    // 4. API calls to Google Calendar API
    
    // For now, we'll just log and return success
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully prepared ${events.length} events for Google Calendar sync`,
        scheduleId,
        eventsCount: events.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error syncing with Google Calendar:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})