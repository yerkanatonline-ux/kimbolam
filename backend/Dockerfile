FROM node:20-bookworm-slim

WORKDIR /app

# better-sqlite3 үшін prebuilt binary табылмаса, source-тан компиляциялау қажет болады
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
