variable "domain" {
  type    = string
  default = "home"
}

job "traefik" {
  type = "service"

  group "traefik" {
    count = 1

    network {
      port "web" {
        static = 80
      }

      port "websecure" {
        static = 443
      }
    }

    service {
      name = "traefik"
      port = "web"

      tags = [
        "traefik.enable=true",
        "traefik.http.routers.dashboard.entryPoints=web,websecure",
        "traefik.http.routers.dashboard.service=api@internal",
        "traefik.http.routers.dashboard.rule=Host(`traefik.${var.domain}`) && (PathPrefix(`/api`) || PathPrefix(`/dashboard`))",
      ]

      check {
        name     = "ping"
        type     = "http"
        path     = "/ping"
        interval = "10s"
        timeout  = "2s"
      }

      check {
        name     = "alive"
        type     = "tcp"
        port     = "web"
        interval = "10s"
        timeout  = "2s"
      }

      # check {
      #   name     = "traefik"
      #   type     = "http"
      #   path     = "/api/http/services/traefik@consulcatalog"
      #   interval = "10s"
      #   timeout  = "2s"
      # }
    }

    task "traefik" {
      driver = "docker"

      config {
        image = "traefik:latest"
        network_mode = "host"

        volumes = [
          "local/config.yaml:/etc/traefik/traefik.yaml",
        ]
      }

      template {
        data = <<EOF
# Enable entrypoints
entryPoints:
  web:
    address: ":{{env "NOMAD_PORT_web"}}"
  websecure:
    address: ":{{env "NOMAD_PORT_websecure"}}"

# Enable the health check endpoint
ping:
  entrypoint: "web"

# Enable the dashboard
api:
  dashboard: true
  insecure: true

# Enable Consul catalog discovery
providers:
  consulCatalog:
    connectAware: true
    exposedByDefault: false
EOF
        destination = "local/config.yaml"
      }
    }
  }
}
