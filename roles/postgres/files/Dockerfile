FROM postgres:alpine

COPY init.d /docker-entrypoint-initdb.d
COPY pg_hba.conf /var/lib/postgresql/data/pg_hba.conf

RUN chmod -R 744 /docker-entrypoint-initdb.d && \
  chmod 644 /var/lib/postgresql/data/pg_hba.conf
