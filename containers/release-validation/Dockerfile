FROM oven/bun@sha256:7985c11f2d6f8b3cd67cfe6e4da08151102a63db596b79bcaed5e9a50965276e AS bun

FROM mcr.microsoft.com/playwright@sha256:02bbb2155cd7109e3e9c741941097ed1608cf8b6fa44ee2595896da2bdc1f471 AS base

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    ca-certificates=20260601~24.04.1 \
    git=1:2.43.0-1ubuntu7.3 \
    python3=3.12.3-0ubuntu2.1 \
    woff2=1.0.2-2build1 \
  && rm -rf /var/lib/apt/lists/* \
  && test "$(bun --version)" = "1.3.5" \
  && test "$(bunx --version)" = "1.3.5"

ENV CI=true PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

FROM base AS dependency-cache

WORKDIR /workspace
COPY package.json bun.lock ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/design/package.json packages/design/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN bun install --frozen-lockfile

FROM base

ARG SOURCE_COMMIT
ARG SOURCE_TREE

ENV RELEASE_SOURCE_MODE=capsule

LABEL org.opencontainers.image.source-commit="${SOURCE_COMMIT}" \
  org.opencontainers.image.source-tree="${SOURCE_TREE}" \
  shoppp.release-capsule.platform="linux/amd64"

WORKDIR /workspace
COPY . /workspace

RUN bun -e 'const source = await Bun.file("/workspace/.release-source.json").json(); if (source.commit !== process.argv[1] || source.tree !== process.argv[2]) process.exit(1)' "${SOURCE_COMMIT}" "${SOURCE_TREE}"
RUN find . \( -type f -o -type l \) ! -name .release-source.json ! -name .release-tracked-files -print0 \
  | LC_ALL=C sort -z > /workspace/.release-tracked-files
RUN ! find /workspace -type d -name node_modules -print -quit | grep -q .
COPY --from=dependency-cache /root/.bun/install/cache /root/.bun/install/cache
COPY --from=dependency-cache /root/.npm/_prebuilds /root/.npm/_prebuilds
RUN bun tools/inspect-release-capsule.ts --verify > /usr/local/share/shoppp-release-toolchain.json
RUN chmod 0555 /workspace/containers/release-validation/run.sh

ENTRYPOINT ["/workspace/containers/release-validation/run.sh"]
