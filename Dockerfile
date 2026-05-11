# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
# Copy public/assets if needed
COPY --from=builder /app/public ./public
# Copy any other necessary folders (e.g., scripts)
COPY --from=builder /app/scripts ./scripts

# Set environment to production
ENV NODE_ENV=production

# Expose port (adjust if your app uses a different one)
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
