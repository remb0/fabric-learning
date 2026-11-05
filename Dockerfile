# Pinned PocketBase version; review release notes before upgrading.
ARG POCKETBASE_VERSION=0.40.6
FROM alpine:3.22 AS fetch
ARG POCKETBASE_VERSION
ARG TARGETARCH
RUN apk add --no-cache ca-certificates unzip wget \
    && case "$TARGETARCH" in amd64) PB_ARCH=amd64 ;; arm64) PB_ARCH=arm64 ;; *) echo "Unsupported architecture: $TARGETARCH"; exit 1 ;; esac \
    && PB_SCHEME=https \
    && PB_HOST=github.com \
    && PB_UNDERSCORE=$(printf '\137') \
    && PB_FILE="pocketbase${PB_UNDERSCORE}${POCKETBASE_VERSION}${PB_UNDERSCORE}linux${PB_UNDERSCORE}${PB_ARCH}.zip" \
    && PB_URL="${PB_SCHEME}://${PB_HOST}/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/${PB_FILE}" \
    && wget -q "$PB_URL" -O /tmp/pb.zip \
    && unzip /tmp/pb.zip pocketbase -d /tmp

FROM alpine:3.22
RUN apk add --no-cache ca-certificates \
    && addgroup -S pocketbase && adduser -S -G pocketbase pocketbase \
    && mkdir -p /app/pb_data /app/pb_public /app/pb_migrations /app/pb_hooks \
    && chown -R pocketbase:pocketbase /app
WORKDIR /app
COPY --from=fetch /tmp/pocketbase /usr/local/bin/pocketbase
COPY --chown=pocketbase:pocketbase index.html certifications.js vce-parser.js questions-en.json questions-en-data.json questions-en-monitor.json questions-extra.js questions-expanded.js /app/pb_public/
COPY --chown=pocketbase:pocketbase pb_migrations /app/pb_migrations
COPY --chown=pocketbase:pocketbase pb_hooks /app/pb_hooks
USER pocketbase
EXPOSE 8090
VOLUME ["/app/pb_data"]
CMD ["/usr/local/bin/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/app/pb_data", "--publicDir=/app/pb_public", "--migrationsDir=/app/pb_migrations", "--hooksDir=/app/pb_hooks"]
