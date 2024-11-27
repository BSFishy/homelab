FROM postgres:alpine

COPY init.d /docker-entrypoint-initdb.d

RUN chmod -R 777 /docker-entrypoint-initdb.d
