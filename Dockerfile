# syntax=docker/dockerfile:1

# The k-spec image: the board server (the default command), the `k-spec` command line and the
# skill. One container is one project's board; `k-spec init` writes the compose file for it.
#
#   docker build --build-arg K_SPEC_IMAGE=k-spec:dev -t k-spec:dev .
#
# K_SPEC_IMAGE must be the name the image is tagged with: `init` writes it into the files of
# the projects it sets up, which is how a project stays on the version that set it up.

ARG NODE_IMAGE=node:24-alpine

# Production dependencies, installed for the platform the image is for (better-sqlite3 is native).
# --ignore-scripts: no dependency needs an install script, and without it `npm ci` tries to
# compile better-sqlite3 (it finds a binding.gyp), although the package ships its binaries for
# every platform, Alpine's included. There is no compiler here, and none is wanted.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# The Next.js build. Its output is the same for every platform, so it runs once, on the
# machine that builds, however many platforms the image is built for.
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && rm -rf .next/cache

FROM ${NODE_IMAGE}
ARG K_SPEC_IMAGE=""
# The board's files live in /data and the project is mounted at /project; nothing else is
# written (HOME is /tmp so that npm, run for the store scripts, has somewhere for its logs).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    K_SPEC_IMAGE=${K_SPEC_IMAGE} \
    K_SPEC_DB=/data/k-spec.db \
    K_SPEC_DUMP=/data/k-spec.dump.json \
    K_SPEC_SERVER_FILE=/data/k-spec.server.json \
    K_SPEC_PROJECT_DIR=/project \
    HOME=/tmp \
    npm_config_update_notifier=false
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json next.config.mjs ./
COPY bin ./bin
COPY scripts ./scripts
COPY src ./src
COPY drizzle ./drizzle
COPY skills ./skills
# The container runs as whoever owns the project (any uid), so /data must take a stranger's
# files when nothing is mounted there.
RUN ln -s /app/bin/k-spec.mjs /usr/local/bin/k-spec \
 && mkdir /data /project \
 && chmod 0777 /data
# /access answers without the token. The short start interval lets `up --wait` return as soon
# as the server is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --start-interval=1s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/access').then((res) => process.exit(res.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start"]
