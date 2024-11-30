FROM lscr.io/linuxserver/jellyfin:latest

# Install unzip utility
RUN apt-get update && \
  apt-get install -y unzip && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Add LDAP plugin zip to the image
ADD https://repo.jellyfin.org/releases/plugin/ldap-authentication/ldap-authentication_19.0.0.0.zip /tmp/ldapauth.zip

# Entrypoint script to copy the plugin and set up configuration
COPY docker-entrypoint.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD []
