FROM postgres:alpine

COPY init.d /docker-entrypoint-initdb.d
COPY pg_hba.conf /var/lib/postgresql/data/pg_hba.conf

RUN chmod -R 777 /docker-entrypoint-initdb.d && \
  chmod 777 /var/lib/postgresql/data/pg_hba.conf
