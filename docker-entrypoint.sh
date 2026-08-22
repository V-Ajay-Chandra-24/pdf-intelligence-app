#!/bin/sh
set -e

if [ -n "$UPLOADS_DIR" ]; then
  echo "Setting permissions for UPLOADS_DIR: $UPLOADS_DIR"
  mkdir -p "$UPLOADS_DIR"
  chown -R nextjs:nodejs "$UPLOADS_DIR"
fi

# Run the command as nextjs user
exec su-exec nextjs "$@"
