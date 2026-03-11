import { getSupabaseClient } from './supabase.js'

export type CallState = 'greeting' | 'onboarding' | 'waiting_for_page' | 'building' | 'follow_up' | 'ended'

export interface CallSessionRow {
  id: string
  call_sid: string
  user_id: string
  project_id: string | null
  phone_number: string
  state: CallState
  is_new_user: boolean
  page_opened: boolean
  page_opened_at: string | null
  metadata: Record<string, unknown>
  started_at: string
  ended_at: string | null
  created_at: string
}

export async function createCallSession(params: {
  callSid: string
  userId: string
  projectId: string | null
  phoneNumber: string
  isNewUser: boolean
}): Promise<CallSessionRow> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('call_sessions')
    .insert({
      call_sid: params.callSid,
      user_id: params.userId,
      project_id: params.projectId,
      phone_number: params.phoneNumber,
      is_new_user: params.isNewUser,
      state: 'greeting',
    })
    .select()
    .single()

  if (error) throw error
  return data as CallSessionRow
}

export async function updateCallState(callSid: string, state: CallState): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('call_sessions')
    .update({ state })
    .eq('call_sid', callSid)

  if (error) throw error
}

export async function markPageOpened(callSid: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('call_sessions')
    .update({
      page_opened: true,
      page_opened_at: new Date().toISOString(),
    })
    .eq('call_sid', callSid)

  if (error) throw error
}

export async function endCallSession(callSid: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('call_sessions')
    .update({
      state: 'ended',
      ended_at: new Date().toISOString(),
    })
    .eq('call_sid', callSid)

  if (error) throw error
}

export async function saveCallMessage(params: {
  callSessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  intent?: string
}): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('call_messages')
    .insert({
      call_session_id: params.callSessionId,
      role: params.role,
      content: params.content,
      intent: params.intent || null,
    })

  if (error) throw error
}

export async function getCallSession(callSid: string): Promise<CallSessionRow | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('call_sessions')
    .select('*')
    .eq('call_sid', callSid)
    .single()

  if (error) return null
  return data as CallSessionRow
}
