#!/bin/env bash

set -eu

# create directories
mkdir -p /data/torrents/books /data/torrents/movies /data/torrents/music /data/torrents/tv
mkdir -p /data/media/books /data/media/movies /data/media/music /data/media/tv

# set proper ownership
chown -R "$PUID":"$PGID" /data/torrents
chown -R "$PUID":"$PGID" /data/media

# set proper permissions
chmod -R 777 /data/torrents
chmod -R 777 /data/media

# output success
echo Success
