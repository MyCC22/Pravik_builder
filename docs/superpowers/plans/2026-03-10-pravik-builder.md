# Pravik Builder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a chat-first, mobile-friendly website builder that uses v0 APIs for AI-powered code generation with text and voice input.

**Architecture:** Next.js 14 App Router with modular feature/service layers. API routes are thin handlers delegating to service modules. Supabase for persistence, v0 SDK for chat/preview/deploy, OpenAI Whisper for voice transcription. Twilio webhook placeholder for Step 2.

**Tech Stack:** Next.js 14, Tailwind CSS, Supabase JS, v0-sdk, OpenAI API, Browser MediaRecorder API

---

## File Structure

```
pravik-builder/                          (project root, inside /Users/tarun/Desktop/Pravik_Builder)
├── .env.local                           env vars (V0_API_KEY, OPENAI_API_KEY, SUPABASE_URL, etc.)
├── next.config.ts                       Next.js config
├── tailwind.config.ts                   Tailwind config
├── tsconfig.json                        TypeScript config
├── package.json                         dependencies
├── postcss.config.mjs                   PostCSS for Tailwind
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                   root layout (fonts, metadata, providers)
│   │   ├── globals.css                  Tailwind directives + global styles
│   │   ├── page.tsx                     login screen (phone number input)
│   │   ├── projects/
│   │   │   └── page.tsx                 project list screen
│   │   ├── build/
│   │   │   └── [projectId]/
│   │   │       └── page.tsx             builder screen (preview + chat)
│   │   └── api/
│   │       ├── auth/
│   │       │   └── login/route.ts       POST: phone lookup/create, return session
│   │       ├── projects/
│   │       │   └── route.ts             GET: list projects for user
│   │       ├── v0/
│   │       │   ├── chat/route.ts        POST: create v0 chat
│   │       │   ├── message/route.ts     POST: send message to v0 chat
│   │       │   └── deploy/route.ts      POST: trigger deployment
│   │       ├── voice/
│   │       │   └── transcribe/route.ts  POST: audio -> Whisper -> text
│   │       └── webhooks/
│   │           └── twilio/route.ts      POST: Twilio webhook placeholder
│   │
│   ├── services/
│   │   ├── supabase/
│   │   │   ├── client.ts               server-side Supabase client factory
│   │   │   └── browser.ts              browser-side Supabase client (public key only)
│   │   ├── v0/
│   │   │   ├── platform.ts             V0PlatformClient (chat create, send message, deploy)
│   │   │   └── model.ts                V0ModelClient (completions API) [placeholder]
│   │   ├── whisper/
│   │   │   └── client.ts               WhisperClient (transcribe audio buffer)
│   │   └── twilio/
│   │       └── client.ts               TwilioClient placeholder
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── login-form.tsx           phone number input + submit
│   │   │   └── use-session.ts           hook: read/write session token from localStorage
│   │   ├── projects/
│   │   │   ├── project-list.tsx         grid of project cards
│   │   │   └── project-card.tsx         single project card (name, date, preview thumb)
│   │   ├── builder/
│   │   │   ├── builder-layout.tsx       70/30 split layout container
│   │   │   ├── preview-panel.tsx        v0 iframe wrapper
│   │   │   ├── chat-panel.tsx           message list + prompt bar
│   │   │   ├── prompt-bar.tsx           text input + mic + send button
│   │   │   ├── voice-recorder.tsx       MediaRecorder hook + UI
│   │   │   └── message-bubble.tsx       single chat message
│   │   └── deploy/
│   │       └── deploy-button.tsx        deploy trigger + status display
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx               reusable button
│   │   │   ├── input.tsx                reusable text input
│   │   │   ├── card.tsx                 reusable card container
│   │   │   └── loading.tsx              spinner / skeleton
│   │   └── layout/
│   │       └── app-shell.tsx            responsive wrapper (safe areas, max-width)
│   │
│   ├── lib/
│   │   ├── types.ts                     shared TypeScript types (User, Project, Message, Session)
│   │   └── constants.ts                 app-wide constants (routes, config)
│   │
│   └── hooks/
│       └── use-fetch.ts                 generic fetch wrapper with loading/error states
```

---

## Chunk 1: Project Scaffold + Services

### Task 1: Initialize Next.js Project

**Files:**
- Create: all config files, `package.json`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`

- [ ] **Step 1: Create Next.js project with TypeScript + Tailwind**

```bash
cd /Users/tarun/Desktop/Pravik_Builder
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. This creates the full scaffold.

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/tarun/Desktop/Pravik_Builder
npm install @supabase/supabase-js openai
```

Note: `v0-sdk` will be installed when we integrate v0. For now we'll call the v0 API directly via fetch since the SDK may require specific auth setup.

- [ ] **Step 3: Create `.env.local`**

Create `/Users/tarun/Desktop/Pravik_Builder/.env.local`:

```env
V0_API_KEY=your_v0_api_key
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npm run dev
```

Expected: Server starts on localhost:3000 without errors.

- [ ] **Step 5: Commit**

```bash
git init && git add -A && git commit -m "chore: initialize Next.js project with Tailwind"
```

---

### Task 2: Shared Types + Constants

**Files:**
- Create: `src/lib/types.ts`, `src/lib/constants.ts`

- [ ] **Step 1: Create shared types**

Create `src/lib/types.ts`:

```typescript
export interface User {
  id: string
  phone_number: string
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  v0_chat_id: string | null
  v0_project_id: string | null
  preview_url: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  project_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  phone_number: string
  session_token: string
  source: 'web' | 'twilio'
  expires_at: string
  created_at: string
}

export interface V0Chat {
  id: string
  demo: string
  files?: { name: string; content: string }[]
}

export interface V0Deployment {
  id: string
  url: string
  status: string
}
```

- [ ] **Step 2: Create constants**

Create `src/lib/constants.ts`:

```typescript
export const ROUTES = {
  LOGIN: '/',
  PROJECTS: '/projects',
  BUILD: (projectId: string) => `/build/${projectId}`,
} as const

export const API = {
  AUTH_LOGIN: '/api/auth/login',
  PROJECTS: '/api/projects',
  V0_CHAT: '/api/v0/chat',
  V0_MESSAGE: '/api/v0/message',
  V0_DEPLOY: '/api/v0/deploy',
  VOICE_TRANSCRIBE: '/api/voice/transcribe',
} as const
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ && git commit -m "feat: add shared types and constants"
```

---

### Task 3: Supabase Service

**Files:**
- Create: `src/services/supabase/client.ts`, `src/services/supabase/browser.ts`

- [ ] **Step 1: Create server-side Supabase client**

Create `src/services/supabase/client.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey)
}
```

- [ ] **Step 2: Create browser-side Supabase client**

Create `src/services/supabase/browser.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

let client: ReturnType<typeof createClient> | null = null

export function getSupabaseBrowser() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/supabase/ && git commit -m "feat: add Supabase client services"
```

---

### Task 4: V0 Platform Service

**Files:**
- Create: `src/services/v0/platform.ts`

- [ ] **Step 1: Create V0 Platform client**

Create `src/services/v0/platform.ts`:

```typescript
import type { V0Chat, V0Deployment } from '@/lib/types'

const V0_API_BASE = 'https://api.v0.dev/v1'

function headers() {
  return {
    Authorization: `Bearer ${process.env.V0_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export async function createChat(message: string): Promise<V0Chat> {
  const res = await fetch(`${V0_API_BASE}/chats`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`v0 createChat failed: ${res.status} ${JSON.stringify(err)}`)
  }
  return res.json()
}

export async function sendMessage(chatId: string, message: string): Promise<V0Chat> {
  const res = await fetch(`${V0_API_BASE}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`v0 sendMessage failed: ${res.status} ${JSON.stringify(err)}`)
  }
  return res.json()
}

export async function createDeployment(projectId: string, chatId: string, versionId: string): Promise<V0Deployment> {
  const res = await fetch(`${V0_API_BASE}/deployments`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ projectId, chatId, versionId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`v0 deploy failed: ${res.status} ${JSON.stringify(err)}`)
  }
  return res.json()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/v0/ && git commit -m "feat: add v0 platform service"
```

---

### Task 5: V0 Model Service (Placeholder)

**Files:**
- Create: `src/services/v0/model.ts`

- [ ] **Step 1: Create V0 Model client placeholder**

Create `src/services/v0/model.ts`:

```typescript
const V0_MODEL_API = 'https://api.v0.dev/v1/chat/completions'

export async function complete(prompt: string, model = 'v0-1.5-md'): Promise<string> {
  const res = await fetch(V0_MODEL_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.V0_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 4000,
    }),
  })
  if (!res.ok) throw new Error(`v0 model failed: ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/v0/model.ts && git commit -m "feat: add v0 model service placeholder"
```

---

### Task 6: Whisper Service

**Files:**
- Create: `src/services/whisper/client.ts`

- [ ] **Step 1: Create Whisper client**

Create `src/services/whisper/client.ts`:

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribe(audioBuffer: Buffer, filename = 'audio.webm'): Promise<string> {
  const file = new File([audioBuffer], filename, { type: 'audio/webm' })
  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  })
  return transcription.text
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/whisper/ && git commit -m "feat: add Whisper transcription service"
```

---

### Task 7: Twilio Service Placeholder

**Files:**
- Create: `src/services/twilio/client.ts`

- [ ] **Step 1: Create Twilio placeholder**

Create `src/services/twilio/client.ts`:

```typescript
// Twilio service - placeholder for Step 2
// Will handle: webhook signature verification, SMS sending, call management

export async function verifyWebhookSignature(_request: Request): Promise<boolean> {
  // TODO: Implement with Twilio auth token
  return true
}

export async function sendSMS(_to: string, _body: string): Promise<void> {
  // TODO: Implement with Twilio client
  throw new Error('Twilio not configured yet')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/twilio/ && git commit -m "feat: add Twilio service placeholder"
```

---

## Chunk 2: API Routes

### Task 8: Auth Login Route

**Files:**
- Create: `src/app/api/auth/login/route.ts`

- [ ] **Step 1: Create login route**

Create `src/app/api/auth/login/route.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/ && git commit -m "feat: add auth login API route"
```

---

### Task 9: Projects Route

**Files:**
- Create: `src/app/api/projects/route.ts`

- [ ] **Step 1: Create projects route**

Create `src/app/api/projects/route.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/projects/ && git commit -m "feat: add projects API route"
```

---

### Task 10: V0 Chat Route

**Files:**
- Create: `src/app/api/v0/chat/route.ts`

- [ ] **Step 1: Create v0 chat route**

Create `src/app/api/v0/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createChat } from '@/services/v0/platform'
import { getSupabaseClient } from '@/services/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const { message, project_id } = await req.json()

    if (!message || !project_id) {
      return NextResponse.json({ error: 'Message and project_id required' }, { status: 400 })
    }

    // Create v0 chat
    const chat = await createChat(message)

    // Update project with v0 chat ID and preview URL
    const supabase = getSupabaseClient()
    await supabase
      .from('projects')
      .update({
        v0_chat_id: chat.id,
        preview_url: chat.demo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id)

    // Store message in our DB
    await supabase.from('messages').insert([
      { project_id, role: 'user', content: message },
      { project_id, role: 'assistant', content: `Preview ready: ${chat.demo}` },
    ])

    return NextResponse.json({ chat })
  } catch (error) {
    console.error('V0 chat error:', error)
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/v0/chat/ && git commit -m "feat: add v0 chat API route"
```

---

### Task 11: V0 Message Route

**Files:**
- Create: `src/app/api/v0/message/route.ts`

- [ ] **Step 1: Create v0 message route**

Create `src/app/api/v0/message/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { sendMessage } from '@/services/v0/platform'
import { getSupabaseClient } from '@/services/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const { chat_id, message, project_id } = await req.json()

    if (!chat_id || !message || !project_id) {
      return NextResponse.json({ error: 'chat_id, message, and project_id required' }, { status: 400 })
    }

    // Send message to v0
    const chat = await sendMessage(chat_id, message)

    // Update preview URL
    const supabase = getSupabaseClient()
    await supabase
      .from('projects')
      .update({
        preview_url: chat.demo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id)

    // Store messages
    await supabase.from('messages').insert([
      { project_id, role: 'user', content: message },
      { project_id, role: 'assistant', content: `Updated preview: ${chat.demo}` },
    ])

    return NextResponse.json({ chat })
  } catch (error) {
    console.error('V0 message error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/v0/message/ && git commit -m "feat: add v0 message API route"
```

---

### Task 12: Voice Transcribe Route

**Files:**
- Create: `src/app/api/voice/transcribe/route.ts`

- [ ] **Step 1: Create transcribe route**

Create `src/app/api/voice/transcribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { transcribe } from '@/services/whisper/client'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file required' }, { status: 400 })
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer())
    const text = await transcribe(buffer, audioFile.name || 'audio.webm')

    return NextResponse.json({ text })
  } catch (error) {
    console.error('Transcribe error:', error)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/voice/ && git commit -m "feat: add voice transcription API route"
```

---

### Task 13: V0 Deploy Route

**Files:**
- Create: `src/app/api/v0/deploy/route.ts`

- [ ] **Step 1: Create deploy route**

Create `src/app/api/v0/deploy/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createDeployment } from '@/services/v0/platform'

export async function POST(req: NextRequest) {
  try {
    const { project_id, chat_id, version_id } = await req.json()

    if (!project_id || !chat_id || !version_id) {
      return NextResponse.json({ error: 'project_id, chat_id, and version_id required' }, { status: 400 })
    }

    const deployment = await createDeployment(project_id, chat_id, version_id)

    return NextResponse.json({ deployment })
  } catch (error) {
    console.error('Deploy error:', error)
    return NextResponse.json({ error: 'Deployment failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/v0/deploy/ && git commit -m "feat: add v0 deploy API route"
```

---

### Task 14: Twilio Webhook Route (Placeholder)

**Files:**
- Create: `src/app/api/webhooks/twilio/route.ts`

- [ ] **Step 1: Create Twilio webhook placeholder**

Create `src/app/api/webhooks/twilio/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Placeholder for Twilio webhook
  // Step 2: Will handle incoming calls, create sessions, send SMS with builder link
  const body = await req.text()
  console.log('Twilio webhook received:', body)

  // Return TwiML response (Twilio expects XML)
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>Thank you for calling Pravik Builder. This feature is coming soon.</Say>
    </Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhooks/ && git commit -m "feat: add Twilio webhook placeholder"
```

---

## Chunk 3: UI Components

### Task 15: Base UI Components

**Files:**
- Create: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/card.tsx`, `src/components/ui/loading.tsx`

- [ ] **Step 1: Create Button component**

Create `src/components/ui/button.tsx`:

```tsx
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'

    const variants = {
      primary: 'bg-white text-black hover:bg-gray-100 focus:ring-white',
      secondary: 'bg-white/10 text-white hover:bg-white/20 focus:ring-white/50 border border-white/20',
      ghost: 'text-white hover:bg-white/10 focus:ring-white/50',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-base',
      lg: 'px-7 py-3.5 text-lg',
    }

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
```

- [ ] **Step 2: Create Input component**

Create `src/components/ui/input.tsx`:

```tsx
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="block text-sm text-gray-400 mb-1.5">{label}</label>}
        <input
          ref={ref}
          className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-colors ${error ? 'border-red-500' : ''} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
```

- [ ] **Step 3: Create Card component**

Create `src/components/ui/card.tsx`:

```tsx
import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', hoverable = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white/5 border border-white/10 rounded-2xl p-5 ${
          hoverable ? 'hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'
```

- [ ] **Step 4: Create Loading component**

Create `src/components/ui/loading.tsx`:

```tsx
export function Loading({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }

  return (
    <div className="flex items-center justify-center">
      <div className={`${sizes[size]} animate-spin rounded-full border-2 border-white/20 border-t-white`} />
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ && git commit -m "feat: add base UI components"
```

---

### Task 16: App Shell Layout

**Files:**
- Create: `src/components/layout/app-shell.tsx`

- [ ] **Step 1: Create responsive app shell**

Create `src/components/layout/app-shell.tsx`:

```tsx
import { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="mx-auto max-w-7xl">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/ && git commit -m "feat: add app shell layout"
```

---

### Task 17: Session Hook

**Files:**
- Create: `src/features/auth/use-session.ts`

- [ ] **Step 1: Create session hook**

Create `src/features/auth/use-session.ts`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { User, Session } from '@/lib/types'

interface SessionData {
  user: User
  session: Session
}

const STORAGE_KEY = 'pravik_session'

export function useSession() {
  const [data, setData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setData(JSON.parse(stored))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (phoneNumber: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phoneNumber }),
    })

    if (!res.ok) throw new Error('Login failed')

    const sessionData: SessionData = await res.json()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData))
    setData(sessionData)
    return sessionData
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setData(null)
  }, [])

  return {
    user: data?.user ?? null,
    session: data?.session ?? null,
    loading,
    login,
    logout,
    isAuthenticated: !!data,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/auth/use-session.ts && git commit -m "feat: add session hook"
```

---

## Chunk 4: Feature UI — Login + Projects

### Task 18: Login Screen

**Files:**
- Create: `src/features/auth/login-form.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create login form component**

Create `src/features/auth/login-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSession } from './use-session'

export function LoginForm() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useSession()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return

    setLoading(true)
    setError('')

    try {
      await login(phone.trim())
      router.push('/projects')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Pravik Builder</h1>
        <p className="text-gray-400">Build websites with your voice</p>
      </div>

      <Input
        type="tel"
        placeholder="+1 (555) 000-0000"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={error}
        autoFocus
      />

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Continue
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Update root page**

Replace `src/app/page.tsx` with:

```tsx
import { LoginForm } from '@/features/auth/login-form'
import { AppShell } from '@/components/layout/app-shell'

export default function LoginPage() {
  return (
    <AppShell>
      <div className="flex min-h-dvh items-center justify-center px-4">
        <LoginForm />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 3: Update root layout**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Pravik Builder',
  description: 'Build websites with your voice',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Update globals.css**

Replace `src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  -webkit-tap-highlight-color: transparent;
}

body {
  overscroll-behavior: none;
}

/* Safe area support for mobile */
@supports (padding: env(safe-area-inset-bottom)) {
  .safe-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/ src/app/page.tsx src/app/layout.tsx src/app/globals.css && git commit -m "feat: add login screen"
```

---

### Task 19: Projects Screen

**Files:**
- Create: `src/features/projects/project-card.tsx`, `src/features/projects/project-list.tsx`, `src/app/projects/page.tsx`

- [ ] **Step 1: Create project card**

Create `src/features/projects/project-card.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import type { Project } from '@/lib/types'

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter()

  return (
    <Card
      hoverable
      onClick={() => router.push(`/build/${project.id}`)}
    >
      {/* Preview thumbnail placeholder */}
      <div className="aspect-video rounded-lg bg-white/5 mb-3 overflow-hidden">
        {project.preview_url ? (
          <iframe
            src={project.preview_url}
            className="w-full h-full pointer-events-none"
            title={project.name}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            No preview yet
          </div>
        )}
      </div>
      <h3 className="font-medium truncate">{project.name}</h3>
      <p className="text-sm text-gray-500 mt-1">
        {new Date(project.updated_at).toLocaleDateString()}
      </p>
    </Card>
  )
}
```

- [ ] **Step 2: Create project list**

Create `src/features/projects/project-list.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectCard } from './project-card'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { useSession } from '@/features/auth/use-session'
import type { Project } from '@/lib/types'

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const { user } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    fetch('/api/projects', {
      headers: { 'x-user-id': user.id },
    })
      .then((res) => res.json())
      .then((data) => setProjects(data.projects || []))
      .finally(() => setLoading(false))
  }, [user])

  const createProject = async () => {
    if (!user) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      const { project } = await res.json()
      router.push(`/build/${project.id}`)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loading />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Projects</h1>
        <Button onClick={createProject} loading={creating}>
          + New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 mb-4">No projects yet</p>
          <Button onClick={createProject} loading={creating} size="lg">
            Create your first project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create projects page**

Create `src/app/projects/page.tsx`:

```tsx
import { ProjectList } from '@/features/projects/project-list'
import { AppShell } from '@/components/layout/app-shell'

export default function ProjectsPage() {
  return (
    <AppShell>
      <div className="px-4 py-8">
        <ProjectList />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/ src/app/projects/ && git commit -m "feat: add projects list screen"
```

---

## Chunk 5: Builder Screen (Core)

### Task 20: Builder Layout

**Files:**
- Create: `src/features/builder/builder-layout.tsx`

- [ ] **Step 1: Create 70/30 split builder layout**

Create `src/features/builder/builder-layout.tsx`:

```tsx
'use client'

import { ReactNode } from 'react'

interface BuilderLayoutProps {
  preview: ReactNode
  chat: ReactNode
}

export function BuilderLayout({ preview, chat }: BuilderLayoutProps) {
  return (
    <div className="flex flex-col h-dvh bg-black">
      {/* Preview panel - 70% */}
      <div className="h-[70dvh] w-full border-b border-white/10 relative">
        {preview}
      </div>

      {/* Chat panel - 30% */}
      <div className="h-[30dvh] w-full flex flex-col">
        {chat}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/builder/builder-layout.tsx && git commit -m "feat: add builder 70/30 layout"
```

---

### Task 21: Preview Panel

**Files:**
- Create: `src/features/builder/preview-panel.tsx`

- [ ] **Step 1: Create preview iframe panel**

Create `src/features/builder/preview-panel.tsx`:

```tsx
'use client'

import { Loading } from '@/components/ui/loading'

interface PreviewPanelProps {
  url: string | null
  loading?: boolean
}

export function PreviewPanel({ url, loading }: PreviewPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center space-y-3">
          <Loading size="lg" />
          <p className="text-gray-400 text-sm">Generating your website...</p>
        </div>
      </div>
    )
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center space-y-2 px-8">
          <div className="text-4xl mb-4">&#9997;&#65039;</div>
          <p className="text-gray-300 font-medium">Describe your website</p>
          <p className="text-gray-500 text-sm">Type or use your voice below to get started</p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      src={url}
      className="w-full h-full border-0 bg-white"
      title="Website Preview"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/builder/preview-panel.tsx && git commit -m "feat: add preview panel"
```

---

### Task 22: Message Bubble

**Files:**
- Create: `src/features/builder/message-bubble.tsx`

- [ ] **Step 1: Create message bubble**

Create `src/features/builder/message-bubble.tsx`:

```tsx
import type { Message } from '@/lib/types'

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm ${
          isUser
            ? 'bg-white text-black rounded-br-md'
            : 'bg-white/10 text-gray-200 rounded-bl-md'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/builder/message-bubble.tsx && git commit -m "feat: add message bubble"
```

---

### Task 23: Voice Recorder

**Files:**
- Create: `src/features/builder/voice-recorder.tsx`

- [ ] **Step 1: Create voice recorder hook + button**

Create `src/features/builder/voice-recorder.tsx`:

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'

interface VoiceRecorderProps {
  onTranscription: (text: string) => void
  disabled?: boolean
}

export function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        setTranscribing(true)
        try {
          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')

          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            body: formData,
          })

          if (res.ok) {
            const { text } = await res.json()
            if (text) onTranscription(text)
          }
        } finally {
          setTranscribing(false)
        }
      }

      mediaRecorder.start()
      setRecording(true)
    } catch (err) {
      console.error('Mic access denied:', err)
    }
  }, [onTranscription])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }, [])

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={disabled || transcribing}
      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
        recording
          ? 'bg-red-500 animate-pulse'
          : transcribing
          ? 'bg-white/10 text-gray-500'
          : 'bg-white/10 text-white hover:bg-white/20'
      } disabled:opacity-50`}
      aria-label={recording ? 'Stop recording' : 'Start recording'}
    >
      {transcribing ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 2.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V20h4v2H8v-2h4v-3.07z" />
        </svg>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/builder/voice-recorder.tsx && git commit -m "feat: add voice recorder component"
```

---

### Task 24: Prompt Bar

**Files:**
- Create: `src/features/builder/prompt-bar.tsx`

- [ ] **Step 1: Create prompt bar**

Create `src/features/builder/prompt-bar.tsx`:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { VoiceRecorder } from './voice-recorder'

interface PromptBarProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function PromptBar({ onSend, disabled }: PromptBarProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 80)}px`
    }
  }, [text])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 px-3 py-2 border-t border-white/10 bg-black safe-bottom">
      <VoiceRecorder
        onTranscription={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))}
        disabled={disabled}
      />

      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe your website..."
        rows={1}
        disabled={disabled}
        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-white/30 disabled:opacity-50"
      />

      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:hover:bg-white"
        aria-label="Send message"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/builder/prompt-bar.tsx && git commit -m "feat: add prompt bar with voice"
```

---

### Task 25: Chat Panel

**Files:**
- Create: `src/features/builder/chat-panel.tsx`

- [ ] **Step 1: Create chat panel**

Create `src/features/builder/chat-panel.tsx`:

```tsx
'use client'

import { useRef, useEffect } from 'react'
import { MessageBubble } from './message-bubble'
import { PromptBar } from './prompt-bar'
import type { Message } from '@/lib/types'

interface ChatPanelProps {
  messages: Message[]
  onSend: (message: string) => void
  loading?: boolean
}

export function ChatPanel({ messages, onSend, loading }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-gray-600 text-xs mt-2">
            Send a message to start building
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prompt bar pinned at bottom */}
      <PromptBar onSend={onSend} disabled={loading} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/builder/chat-panel.tsx && git commit -m "feat: add chat panel"
```

---

### Task 26: Builder Page

**Files:**
- Create: `src/app/build/[projectId]/page.tsx`

- [ ] **Step 1: Create builder page**

Create `src/app/build/[projectId]/page.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { BuilderLayout } from '@/features/builder/builder-layout'
import { PreviewPanel } from '@/features/builder/preview-panel'
import { ChatPanel } from '@/features/builder/chat-panel'
import { useSession } from '@/features/auth/use-session'
import type { Message, Project } from '@/lib/types'

export default function BuilderPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useSession()
  const [project, setProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)

  // Load existing project + messages
  useEffect(() => {
    if (!user || !projectId) return

    // Fetch project messages from Supabase via a simple query
    fetch(`/api/projects?id=${projectId}`, {
      headers: { 'x-user-id': user.id },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.projects?.[0]) {
          const proj = data.projects[0]
          setProject(proj)
          setPreviewUrl(proj.preview_url)
          setChatId(proj.v0_chat_id)
        }
      })
  }, [user, projectId])

  const handleSend = useCallback(
    async (message: string) => {
      if (!projectId) return

      // Optimistic UI: add user message
      const tempMsg: Message = {
        id: `temp-${Date.now()}`,
        project_id: projectId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, tempMsg])
      setLoading(true)

      try {
        let result

        if (!chatId) {
          // First message: create new v0 chat
          const res = await fetch('/api/v0/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, project_id: projectId }),
          })
          result = await res.json()
          setChatId(result.chat?.id)
        } else {
          // Follow-up: send to existing chat
          const res = await fetch('/api/v0/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message,
              project_id: projectId,
            }),
          })
          result = await res.json()
        }

        // Update preview
        if (result.chat?.demo) {
          setPreviewUrl(result.chat.demo)
        }

        // Add assistant message
        const assistantMsg: Message = {
          id: `temp-assistant-${Date.now()}`,
          project_id: projectId,
          role: 'assistant',
          content: 'Preview updated',
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMsg])
      } catch (err) {
        console.error('Send error:', err)
        const errorMsg: Message = {
          id: `temp-error-${Date.now()}`,
          project_id: projectId,
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        setLoading(false)
      }
    },
    [projectId, chatId]
  )

  return (
    <BuilderLayout
      preview={<PreviewPanel url={previewUrl} loading={loading} />}
      chat={<ChatPanel messages={messages} onSend={handleSend} loading={loading} />}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/build/ && git commit -m "feat: add builder page with v0 integration"
```

---

## Chunk 6: Polish + Deploy Button

### Task 27: Deploy Button

**Files:**
- Create: `src/features/deploy/deploy-button.tsx`

- [ ] **Step 1: Create deploy button**

Create `src/features/deploy/deploy-button.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface DeployButtonProps {
  projectId: string
  chatId: string | null
  disabled?: boolean
}

export function DeployButton({ projectId, chatId, disabled }: DeployButtonProps) {
  const [deploying, setDeploying] = useState(false)
  const [deployUrl, setDeployUrl] = useState<string | null>(null)

  const handleDeploy = async () => {
    if (!chatId) return
    setDeploying(true)

    try {
      const res = await fetch('/api/v0/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          chat_id: chatId,
          version_id: 'latest',
        }),
      })
      const { deployment } = await res.json()
      if (deployment?.url) {
        setDeployUrl(deployment.url)
      }
    } finally {
      setDeploying(false)
    }
  }

  if (deployUrl) {
    return (
      <a
        href={deployUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-green-400 underline"
      >
        Live: {deployUrl}
      </a>
    )
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleDeploy}
      loading={deploying}
      disabled={disabled || !chatId}
    >
      Deploy
    </Button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/deploy/ && git commit -m "feat: add deploy button"
```

---

### Task 28: Fetch Hook

**Files:**
- Create: `src/hooks/use-fetch.ts`

- [ ] **Step 1: Create generic fetch hook**

Create `src/hooks/use-fetch.ts`:

```typescript
'use client'

import { useState, useCallback } from 'react'

interface UseFetchOptions {
  headers?: Record<string, string>
}

export function useFetch<T>(url: string, options?: UseFetchOptions) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(
    async (body?: unknown) => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(url, {
          method: body ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        })

        if (!res.ok) throw new Error(`Request failed: ${res.status}`)

        const result = await res.json()
        setData(result)
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Request failed'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [url, options?.headers]
  )

  return { data, loading, error, execute }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/ && git commit -m "feat: add generic fetch hook"
```

---

### Task 29: Final Integration + Verify

- [ ] **Step 1: Verify project compiles**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Start dev server and test manually**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npm run dev
```

Test: open localhost:3000 on phone (or mobile simulator), verify login flow, project creation, builder screen layout.

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "feat: Pravik Builder v1 - chat-first website builder"
```
