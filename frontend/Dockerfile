# =========================================================
# SIGMA - Frontend (React + Nginx)
# Multi-stage: build with Node, serve with Nginx
# =========================================================

# ------- Stage 1: Build -------
FROM node:20-alpine AS builder

WORKDIR /app

# REACT_APP_BACKEND_URL is baked at build time.
# Default = "" (relative) so the app calls /api/... on the same origin
# where Nginx will reverse-proxy to the backend container.
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV WDS_SOCKET_PORT=443
ENV ENABLE_HEALTH_CHECK=false
ENV NODE_OPTIONS=--openssl-legacy-provider
ENV CI=false
ENV GENERATE_SOURCEMAP=false

# Install deps first (better layer caching)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

# Copy source and build
COPY . .
RUN yarn build


# ------- Stage 2: Runtime (Nginx) -------
FROM nginx:1.27-alpine AS runtime

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
