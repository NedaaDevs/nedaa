#!/usr/bin/env bash
# Writes .env.local from the EXPO_PUBLIC_* values a release bundle inlines.
set -euo pipefail

readonly OPTIONAL=(EXPO_PUBLIC_SUPPORT_EMAIL EXPO_PUBLIC_TELEGRAM_USERNAME EXPO_PUBLIC_WHATSAPP_NUMBER)

if [ -z "${EXPO_PUBLIC_API_URL:-}" ]; then
  echo "::error::Set the EXPO_PUBLIC_API_URL Actions variable (Settings > Secrets and variables > Actions > Variables)."
  exit 1
fi

{
  printf 'EXPO_PUBLIC_API_URL=%s\n' "$EXPO_PUBLIC_API_URL"
  for name in "${OPTIONAL[@]}"; do
    if [ -n "${!name:-}" ]; then
      printf '%s=%s\n' "$name" "${!name}"
    else
      echo "::notice::$name is not set; the bundle is built without it." >&2
    fi
  done
} >.env.local
