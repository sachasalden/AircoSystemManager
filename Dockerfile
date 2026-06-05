FROM node:20-alpine


COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 8088

CMD ["npm", "run", "start:docker"]
