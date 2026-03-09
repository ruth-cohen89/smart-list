# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# Installs all dependencies (including devDeps for tsc), compiles TypeScript,
# then prunes down to production-only node_modules before handing off to runner.
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time system libraries.
# python3/make/g++/pkgconfig: required by node-gyp (bcrypt, and node-canvas
#   fallback compilation on musl when no prebuilt binary is available).
# cairo/pango/jpeg/gif/rsvg/pixman dev headers: needed if node-canvas (the
#   'canvas' npm package) compiles from source on Alpine/musl.
RUN apk add --no-cache \
    python3 make g++ pkgconfig \
    cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev

# Install dependencies with a clean slate using the lockfile.
# All deps (including devDeps) are required here so tsc has access to @types/*.
COPY package*.json ./
RUN npm ci

# Compile TypeScript → dist/
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Strip dev-only packages. The pruned node_modules is what gets copied to the
# final image, keeping it free of tsc, eslint, ts-node-dev, etc.
RUN npm prune --omit=dev


# ── Stage 2: Runner ───────────────────────────────────────────────────────────
# Minimal Alpine image with only the runtime system libraries and the compiled
# application. No build tools ship in the final image.
FROM node:20-alpine AS runner

WORKDIR /app

# Runtime shared libraries.
# node-canvas ('canvas' npm package) links against these dynamically.
# @napi-rs/canvas ships a self-contained musl binary and needs none of these,
# but including them ensures the node-canvas .node binary can be loaded if
# anything ever requires it.
RUN apk add --no-cache \
    cairo pango libjpeg-turbo giflib librsvg pixman

# Run as a non-root user — principle of least privilege.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the pruned production node_modules from the builder.
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy the compiled application output.
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

# package.json is read at runtime by some modules (e.g. for package name/version).
COPY --chown=appuser:appgroup package.json ./

USER appuser

# NODE_ENV must be 'production' so server.ts loads .env.production via dotenv
# (which is a no-op in containers — all variables are injected via -e / --env-file).
ENV NODE_ENV=production

# Document the default port. Override at runtime with -e PORT=<n>.
EXPOSE 3000

CMD ["node", "dist/server.js"]
