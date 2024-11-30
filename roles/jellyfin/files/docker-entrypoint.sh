#!/bin/bash

# Ensure the LDAP plugin directory exists and is populated
PLUGIN_DIR=/config/data/plugins/ldapauth
CONFIG_DIR=/config/data/plugins/configurations
if [ ! -f "$PLUGIN_DIR/LDAP-Auth.dll" ]; then
  echo "Copying LDAP plugin files..."
  mkdir -p "$PLUGIN_DIR"
  unzip /tmp/ldapauth.zip -d "$PLUGIN_DIR"
  chmod -R 755 "$PLUGIN_DIR"
  chown -R "${PUID:-911}:${PGID:-911}" "$PLUGIN_DIR"
fi

# If the LDAP configuration doesn't exist, copy it from the Docker config mount
if [ ! -f "$CONFIG_DIR/LDAP-Auth.xml" ]; then
  echo "Copying LDAP configuration..."
  mkdir -p "$CONFIG_DIR"
  cp /tmp/LDAP-Auth.xml "$CONFIG_DIR"
  chmod 644 "$CONFIG_DIR/LDAP-Auth.xml"
  chown -R "${PUID:-911}:${PGID:-911}" "$CONFIG_DIR"
fi

# Run the parent image entrypoint (start Jellyfin)
exec /init
