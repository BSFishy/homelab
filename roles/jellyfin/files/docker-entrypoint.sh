#!/bin/bash

# Ensure the LDAP plugin directory exists and is populated
PLUGIN_DIR=/config/data/plugins/ldapauth
LDAP_CONFIG_DIR=/config/data/plugins/configurations
CONFIG_DIR=/config
if [ ! -f "$PLUGIN_DIR/LDAP-Auth.dll" ]; then
  echo "Copying LDAP plugin files..."
  mkdir -p "$PLUGIN_DIR"
  unzip /tmp/ldapauth.zip -d "$PLUGIN_DIR"
  chmod -R 755 "$PLUGIN_DIR"
  chown -R "${PUID:-911}:${PGID:-911}" "$PLUGIN_DIR"
fi

# If the LDAP configuration doesn't exist, copy it from the Docker config mount
if [ ! -f "$LDAP_CONFIG_DIR/LDAP-Auth.xml" ]; then
  echo "Copying LDAP configuration..."
  mkdir -p "$LDAP_CONFIG_DIR"
  cp /tmp/LDAP-Auth.xml "$LDAP_CONFIG_DIR"
  chmod 644 "$LDAP_CONFIG_DIR/LDAP-Auth.xml"
  chown -R "${PUID:-911}:${PGID:-911}" "$LDAP_CONFIG_DIR"
fi

# If the configuration doesn't exist, copy it from the Docker config mount
if [ ! -f "$CONFIG_DIR/system.xml" ]; then
  echo "Copying configuration..."
  mkdir -p "$CONFIG_DIR"
  cp /tmp/system.xml "$CONFIG_DIR"
  chmod 644 "$CONFIG_DIR/system.xml"
  chown -R "${PUID:-911}:${PGID:-911}" "$CONFIG_DIR"
fi

# Run the parent image entrypoint (start Jellyfin)
exec /init
