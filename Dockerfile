# Build estático (Astro) + runtime Node (Express sirve dist/ + /api)
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Dominio público (sitemap, OG, canonical). Definir en Coolify antes del build.
ARG SITE_URL=https://laceramica-barbastro.example
ENV SITE_URL=${SITE_URL}

RUN npm run build

FROM node:22-alpine AS run

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public ./public
COPY --from=build /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
