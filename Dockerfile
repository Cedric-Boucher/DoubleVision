# -------------------------
# STAGE 1: Build the Svelte App
# -------------------------
FROM node:26-alpine AS builder

WORKDIR /app

# Install dependencies first for better Docker layer caching
COPY package*.json ./
RUN npm install

# Copy the rest of the code and build
COPY . .
RUN npm run build

# -------------------------
# STAGE 2: Serve with Nginx
# -------------------------
FROM nginx:alpine

# Copy our custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled static files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
