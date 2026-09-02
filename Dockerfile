FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p data

ENV TZ=America/Sao_Paulo
ENV NODE_ENV=production

CMD ["node", "index.js"]
