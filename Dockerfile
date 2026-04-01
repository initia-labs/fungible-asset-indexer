FROM node:22-alpine

WORKDIR /usr/src/app

COPY . .

RUN npx -y npm@11 ci

EXPOSE 5000

CMD ["npm", "run", "start"]
