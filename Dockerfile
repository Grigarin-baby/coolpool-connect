# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --frozen-lockfile

COPY . .
RUN npm run build
RUN cd dist/server && ln -sf index.js server.js

# ---- Production Stage ----
FROM node:20-alpine AS runner

WORKDIR /app

# Only copy what's needed to run
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 80

# Run the actual SSR production server (not vite preview)
CMD ["node", "dist/server/server.js"]
