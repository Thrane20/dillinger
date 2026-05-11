#!/usr/bin/env bash
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-20.19.5}"
TARGET="${TARGET:-linux-x64}"
ARTIFACT_NAME="dillinger-core-${TARGET}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="${PROJECT_ROOT}/release/native/${ARTIFACT_NAME}"
NODE_ARCHIVE="node-v${NODE_VERSION}-${TARGET}.tar.xz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}"
NODE_CACHE="${PROJECT_ROOT}/.cache/native/${NODE_ARCHIVE}"

if [[ "${TARGET}" != "linux-x64" ]]; then
  printf 'Only TARGET=linux-x64 is supported for the native Core artifact today.\n' >&2
  exit 1
fi

command -v pnpm >/dev/null 2>&1 || {
  printf 'pnpm is required on PATH.\n' >&2
  exit 1
}

if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
  printf 'curl or wget is required to download the pinned Node runtime.\n' >&2
  exit 1
fi

cd "${PROJECT_ROOT}"

printf 'Building shared package...\n'
pnpm --filter=@dillinger/shared run build

printf 'Building Dillinger Core standalone output...\n'
pnpm --filter=@dillinger/core run build

printf 'Preparing native artifact at %s...\n' "${ARTIFACT_DIR}"
rm -rf "${ARTIFACT_DIR}"
mkdir -p "${ARTIFACT_DIR}/app" "${ARTIFACT_DIR}/bin" "$(dirname "${NODE_CACHE}")"

cp -a packages/dillinger-core/.next/standalone/. "${ARTIFACT_DIR}/app/"
mkdir -p "${ARTIFACT_DIR}/app/packages/dillinger-core/.next"
cp -a packages/dillinger-core/.next/static "${ARTIFACT_DIR}/app/packages/dillinger-core/.next/static"

mkdir -p "${ARTIFACT_DIR}/app/packages/dillinger-core/lib/workers"
cp -a packages/dillinger-core/lib/workers/download-worker.js "${ARTIFACT_DIR}/app/packages/dillinger-core/lib/workers/download-worker.js"
cp -a packages/dillinger-core/assets "${ARTIFACT_DIR}/app/packages/dillinger-core/assets"
mkdir -p "${ARTIFACT_DIR}/app/packages/dillinger-core/public"
rm -rf "${ARTIFACT_DIR}/app/packages/dillinger-core/tests" "${ARTIFACT_DIR}/app/packages/dillinger-core/dist-test"

if [[ ! -f "${NODE_CACHE}" ]]; then
  printf 'Downloading Node.js %s for %s...\n' "${NODE_VERSION}" "${TARGET}"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "${NODE_URL}" -o "${NODE_CACHE}"
  else
    wget -q "${NODE_URL}" -O "${NODE_CACHE}"
  fi
fi

printf 'Bundling pinned Node.js runtime...\n'
tar -xJf "${NODE_CACHE}" -C "${ARTIFACT_DIR}"
mv "${ARTIFACT_DIR}/node-v${NODE_VERSION}-${TARGET}" "${ARTIFACT_DIR}/node"

cat > "${ARTIFACT_DIR}/bin/dillinger-core" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NODE_ENV="${NODE_ENV:-production}"
export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
export PORT="${PORT:-3010}"
export DILLINGER_RUNTIME="${DILLINGER_RUNTIME:-native}"

if [[ -z "${DILLINGER_CORE_PATH:-}" ]]; then
  printf 'DILLINGER_CORE_PATH must point to the host Dillinger Core data directory.\n' >&2
  exit 1
fi

exec "${ROOT}/node/bin/node" "${ROOT}/app/packages/dillinger-core/server.js"
EOF

chmod +x "${ARTIFACT_DIR}/bin/dillinger-core"

cat > "${ARTIFACT_DIR}/README.md" <<EOF
# Dillinger Core Native Runtime

Target: ${TARGET}
Node.js: ${NODE_VERSION}

Run manually:

\`\`\`bash
DILLINGER_CORE_PATH=/path/to/dillinger-data PORT=3010 ./bin/dillinger-core
\`\`\`

The CLI manages this artifact with:

\`\`\`bash
dillinger-gaming start --native
dillinger-gaming status --native
dillinger-gaming logs --native
dillinger-gaming stop --native
\`\`\`
EOF

tar -C "${PROJECT_ROOT}/release/native" -czf "${PROJECT_ROOT}/release/native/${ARTIFACT_NAME}.tar.gz" "${ARTIFACT_NAME}"
rm -rf "${PROJECT_ROOT}/packages/cli/native/${ARTIFACT_NAME}"
mkdir -p "${PROJECT_ROOT}/packages/cli/native"
cp -a "${ARTIFACT_DIR}" "${PROJECT_ROOT}/packages/cli/native/${ARTIFACT_NAME}"
printf 'Native artifact ready: %s\n' "${PROJECT_ROOT}/release/native/${ARTIFACT_NAME}.tar.gz"
