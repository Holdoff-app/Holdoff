# HoldOff production container — Express + EJS + PostgreSQL (server.js)
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js auth.js migrate.js ./
COPY config/ ./config/
COPY db/ ./db/
COPY lib/ ./lib/
COPY routes/ ./routes/
COPY services/ ./services/
COPY jobs/ ./jobs/
COPY views/ ./views/
COPY public/ ./public/
COPY data/ ./data/
COPY migrations/ ./migrations/

# services/degraded-queue.js buffers to data/degraded when Postgres is unreachable.
RUN mkdir -p data/degraded && chown -R node:node data

USER node
EXPOSE 3000

# /healthz reports real dependency state; /api/health always returns 200 and
# would mask a fully broken deploy.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
