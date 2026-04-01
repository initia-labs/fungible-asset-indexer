FROM node:20-alpine

WORKDIR /usr/src/app

COPY . .

RUN npm ci

EXPOSE 5000

CMD ["npm", "run", "start"]
