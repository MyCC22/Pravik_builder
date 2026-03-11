FROM node:20-slim AS builder

WORKDIR /app

# Copy voice-server package files
COPY voice-server/package.json voice-server/package-lock.json* ./voice-server/

# Copy shared src for the build
COPY src ./src
COPY tsconfig.json ./tsconfig.json

WORKDIR /app/voice-server
RUN npm install

# Copy voice-server source
COPY voice-server/src ./src
COPY voice-server/tsconfig.json ./tsconfig.json

RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app/voice-server

COPY --from=builder /app/voice-server/dist ./dist
COPY --from=builder /app/voice-server/package.json ./
COPY --from=builder /app/voice-server/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
