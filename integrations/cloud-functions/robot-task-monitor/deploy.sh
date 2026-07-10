#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTEGRATIONS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SCRIPT_DIR"

cp "$INTEGRATIONS_DIR/GoogleCloudRobot.js" .
cp -r "$INTEGRATIONS_DIR/shared" .

: "${GCP_PROJECT:?Ustaw GCP_PROJECT}"
: "${GCP_REGION:?Ustaw GCP_REGION}"

gcloud config set project "$GCP_PROJECT" >/dev/null

echo "Deploying robot-task-monitor (biz_value sheet fix)..."

gcloud run deploy robot-task-monitor \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --source=. \
  --function=processTaskQueue \
  --base-image=google-22/nodejs22 \
  --no-allow-unauthenticated

echo "URL:"
gcloud run services describe robot-task-monitor \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format='value(status.url)'
