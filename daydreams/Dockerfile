# Use Node.js base image
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    git \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@latest

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Set working directory
WORKDIR /app

# Copy package files
COPY . .

# Install dependencies
RUN pnpm install

# Expose port
EXPOSE 3000

# Use the "start" script from package.json
CMD ["bun", "run", "start"]