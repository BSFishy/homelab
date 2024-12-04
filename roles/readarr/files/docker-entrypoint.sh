#!/bin/bash

CONFIG_DIR=/config
if [ ! -f "$CONFIG_DIR/config.xml" ]; then
  echo "Copying configuration..."
  mkdir -p "$CONFIG_DIR"
  cp /tmp/config.xml "$CONFIG_DIR"
  chmod 644 "$CONFIG_DIR/config.xml"
  chown -R "${PUID:-1000}:${PGID:-1000}" "$CONFIG_DIR"
fi

# Run the parent image entrypoint (start Jellyfin)
exec /init
