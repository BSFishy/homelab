# Stage 1: Extract the cloudflared binary
FROM glanceapp/glance:latest as builder

# Stage 2: Create a minimal Alpine image with curl and cloudflared
FROM alpine/curl:latest

COPY --from=builder /app/glance /app/glance

USER nobody

WORKDIR /app
ENTRYPOINT ["/app/glance"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["curl", "-f", "http://127.0.0.1:8080/api/healthz"]
