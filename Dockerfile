# Build stage
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install site dependencies
COPY site/package.json site/pnpm-lock.yaml site/
RUN cd site && pnpm install --frozen-lockfile

# Copy source
COPY site/ site/
COPY site-content/ site-content/

# Build site data and static files
RUN node site/site-build.mjs --full && cd site && pnpm build

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
