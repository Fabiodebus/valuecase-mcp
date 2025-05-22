# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src
COPY docs ./docs
COPY setup.js ./

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/docs ./docs
COPY --from=build /app/README.md ./
COPY --from=build /app/railway.json ./
COPY --from=build /app/setup.js ./

EXPOSE 3000

CMD ["node", "dist/index.js"] 