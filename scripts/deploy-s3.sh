#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/deploy-s3.sh <bucket-name>

Or with env vars:
  S3_BUCKET=<bucket-name> ./scripts/deploy-s3.sh

Optional env vars:
  S3_BUCKET=<bucket-name>                Default: loaded from .env (if present)
  AWS_REGION=<region>                    Default: AWS_REGION, AWS_DEFAULT_REGION, or us-east-1
  AWS_PROFILE=<profile>                  Default: ''
  SKIP_BUILD=1                           Skip npm build step
  CLOUDFRONT_DISTRIBUTION_ID=<id>        Create CloudFront invalidation (/*) after upload
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "[deploy] aws CLI not found. Install AWS CLI first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[deploy] npm not found."
  exit 1
fi

BUCKET="${1:-${S3_BUCKET:-}}"
if [[ -z "${BUCKET}" ]]; then
  echo "[deploy] Missing bucket name."
  usage
  exit 1
fi

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
PROFILE="${AWS_PROFILE}"
DIST_DIR="${PROJECT_ROOT}/dist"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "[deploy] Building app..."
  (cd "${PROJECT_ROOT}" && npm run build)
else
  echo "[deploy] SKIP_BUILD=1, using existing ${DIST_DIR}/"
fi

if [[ ! -d "${DIST_DIR}" ]]; then
  echo "[deploy] Missing ${DIST_DIR}/ directory. Build failed or not run."
  exit 1
fi

echo "[deploy] Uploading static assets to s3://${BUCKET}..."
aws s3 sync "${DIST_DIR}" "s3://${BUCKET}" \
  --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable" \
  --region "${REGION}" \
  --profile "${PROFILE}"

echo "[deploy] Uploading index.html with no-cache..."
aws s3 cp "${DIST_DIR}/index.html" "s3://${BUCKET}/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html; charset=utf-8" \
  --region "${REGION}" \
  --profile "${PROFILE}"

if [[ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  echo "[deploy] Creating CloudFront invalidation for ${CLOUDFRONT_DISTRIBUTION_ID}..."
  aws cloudfront create-invalidation \
    --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
    --paths "/*" \
    --profile "${PROFILE}" >/dev/null
fi

echo "[deploy] Done."
