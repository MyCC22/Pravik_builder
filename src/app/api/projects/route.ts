import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Projects error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user_id, name } = await req.json()
    if (!user_id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data: project, error } = await supabase
      .from('projects')
      .insert({ user_id, name: name || 'Untitled Project' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
