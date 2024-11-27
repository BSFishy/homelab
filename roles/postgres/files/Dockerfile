FROM postgres:alpine

COPY init.d /docker-entrypoint-initdb.d
COPY pg_hba.conf /var/lib/postgresql/data/pg_hba.conf

RUN chmod -R 700 /docker-entrypoint-initdb.d && \
  chmod 600 /var/lib/postgresql/data/pg_hba.conf
