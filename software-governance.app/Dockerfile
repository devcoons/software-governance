FROM node:22-alpine AS build
WORKDIR /app

RUN npm i -g npm
COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build
RUN npm cache clean --force


FROM node:22-alpine
WORKDIR /app

COPY --from=build /app/package*.json ./
RUN npm install --production

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.* ./

RUN npm cache clean --force
EXPOSE 3000

ENV NODE_ENV=production
CMD ["npm", "start"]
