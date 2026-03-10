import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const { phone_number } = await req.json()

    if (!phone_number || typeof phone_number !== 'string') {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Look up existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone_number)
      .single()

    let user = existingUser

    // Create new user if not found
    if (!user) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ phone_number })
        .select()
        .single()

      if (error) throw error
      user = newUser
    }

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        phone_number: user.phone_number,
        source: 'web',
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    return NextResponse.json({ user, session })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
