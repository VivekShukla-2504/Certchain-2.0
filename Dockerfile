# Multi-stage Docker build for CertChain Full-Stack Production Deployment
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy backend source code
COPY backend/ ./backend/

# Copy compiled production frontend from builder stage
COPY --from=frontend-builder /app/frontend/build ./frontend/build

EXPOSE 5000

CMD ["node", "backend/server.js"]

