# Stage 1: Build the Vue application
FROM node:20-alpine AS build-stage
WORKDIR /app

# Copy package configurations and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application files
COPY . .

# Set up build arguments for Vite (so the Render API URL gets baked in during compile time)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the application
RUN npm run build

# Stage 2: Serve the compiled app via Nginx
FROM nginx:stable-alpine AS production-stage

# Copy the build artifact from Stage 1
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy our custom Nginx config to handle SPA routing redirects
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
