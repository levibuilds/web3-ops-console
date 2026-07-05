FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4173
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY public ./public
COPY README.md README.zh.md LICENSE ./
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 4173
VOLUME ["/app/data"]
CMD ["npm", "start"]
