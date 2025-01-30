FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ENV VITE_API_URL=http://backend:3001
ENV NODE_ENV=production

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/vite.config.ts ./

RUN npm ci --omit=dev

ENV NODE_ENV=production
ENV PORT=5173

EXPOSE 5173

CMD ["npm", "run", "preview"]