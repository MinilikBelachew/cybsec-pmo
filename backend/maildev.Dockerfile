FROM node:22.18.0-slim

RUN npm i -g maildev@2.0.5

CMD maildev
