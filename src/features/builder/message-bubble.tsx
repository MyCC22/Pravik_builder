import type { Message } from '@/lib/types'

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const hasImages = message.image_urls && message.image_urls.length > 0

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm ${
          isUser
            ? 'bg-white text-black rounded-br-md'
            : 'bg-white/10 text-gray-200 rounded-bl-md'
        }`}
      >
        {hasImages && (
          <div className="flex gap-1.5 mb-1.5">
            {message.image_urls!.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={url}
                  alt={`Attached image ${i + 1}`}
                  className="w-16 h-16 rounded-lg object-cover border border-black/10 hover:opacity-80 transition-opacity"
                />
              </a>
            ))}
          </div>
        )}
        {message.content}
      </div>
    </div>
  )
}
