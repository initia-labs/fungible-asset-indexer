FROM node:22-alpine
RUN npm install -g npm@latest

WORKDIR /usr/src/app

COPY . .

RUN npm ci

EXPOSE 5000

CMD ["npm", "run", "start"]
