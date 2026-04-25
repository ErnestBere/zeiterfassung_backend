FROM node:22-alpine

# better-sqlite3 braucht native build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Datenbankverzeichnis erstellen
RUN mkdir -p /data

ENV PORT=8080
ENV DB_PATH=/data/database.sqlite

EXPOSE ${PORT}

CMD ["node", "src/server.js"]
