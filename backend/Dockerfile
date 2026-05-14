FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

COPY customer ./customer
COPY driver ./driver
COPY landing ./landing
COPY partner ./partner
COPY shared ./shared

RUN npm run build

EXPOSE 8080

CMD ["npm", "run", "start"]
