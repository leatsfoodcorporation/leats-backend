FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema before install so postinstall hooks can resolve it
COPY prisma ./prisma

# Install dependencies
RUN npm ci --only=production

# Generate the Prisma client
RUN npx prisma generate

# Copy application files
COPY . .

# Expose port
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]
