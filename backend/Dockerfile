# ─── Khang Backend (Express) ──────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5000

# Install production dependencies (lockfile required)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source
COPY src ./src

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1

CMD ["node", "src/server.js"]
