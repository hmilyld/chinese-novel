# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install site dependencies
COPY site/package.json site/
RUN cd site && npm install

# Copy source
COPY site/ site/
COPY site-content/ site-content/

# Build site data and static files
RUN node site/site-build.mjs --full && cd site && npm run build

# Runtime stage
FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/

# Copy built site
COPY --from=builder /app/site/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
