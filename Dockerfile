FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Teile Cloud Run mit, dass der Server auf Port 8080 hören soll
ENV PORT=8080
EXPOSE ${PORT}

CMD ["npm", "start"]
