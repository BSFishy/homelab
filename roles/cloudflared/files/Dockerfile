# Stage 1: Extract the cloudflared binary
FROM cloudflare/cloudflared:latest as builder

# Stage 2: Create a minimal Alpine image with curl and cloudflared
FROM alpine/curl:latest

COPY --from=builder /usr/local/bin/cloudflared /usr/local/bin/cloudflared

USER nobody

ENTRYPOINT [ "cloudflared", "--no-autoupdate" ]
CMD [ "tunnel", "--metrics", "0.0.0.0:8080", "run" ]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["curl", "-f", "http://127.0.0.1:8080/ready"]
