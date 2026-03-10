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
