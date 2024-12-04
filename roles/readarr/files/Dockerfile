FROM lscr.io/linuxserver/readarr:develop

# Entrypoint script to copy the plugin and set up configuration
COPY docker-entrypoint.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD []
