# Dockerfile de producción para SIMA Training API.
# NO se usa en el flujo local (que corre con `npm run start:dev` + Postgres de docker-compose).
# Queda listo para el día que se despliegue a Render/Railway (Sprint 1 — pendiente del usuario).

# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# --- runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
# Aplica migraciones pendientes y arranca.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
