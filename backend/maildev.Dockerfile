FROM node:22-slim

RUN npm i -g maildev@2.0.5

CMD maildev
