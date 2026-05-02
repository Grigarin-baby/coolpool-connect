FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
# Or bun.lockb if you use bun, but we'll use npm for standard compatibility
RUN npm install

COPY . .
RUN npm run build
RUN cd dist/server && ln -sf index.js server.js

EXPOSE 80
CMD ["npm", "run", "preview", "--", "--port", "80", "--host", "0.0.0.0"]
