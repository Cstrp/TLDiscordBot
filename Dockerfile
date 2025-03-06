# First step (build stage)
FROM node:lts-slim AS builder

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies (without dev dependencies)
RUN npm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Install the NestJS CLI locally
RUN npm install -g @nestjs/cli

# Run the build command
RUN npm run build

# Second step (run stage)
FROM node:lts-slim AS production

WORKDIR /app

# Copy the build artifacts and package files from the builder stage
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package*.json /app/

# Install only production dependencies
RUN npm install --frozen-lockfile

# Expose the port your app will run on
EXPOSE 3000

# Command to run the app
CMD [ "node", "dist/main.js" ]
