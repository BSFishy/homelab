variable "domain" {
  type    = string
  default = "home"
}

job "jellyfin" {
  type = "service"

  group "jellyfin" {
    count = 1

    network {
      port "http" {
        static = 8096
      }
    }

    service {
      name = "jellyfin"
      port = "http"

      tags = [
        "dnsmasq.cname=true",
        "traefik.enable=true",
        "traefik.http.routers.jellyfin.entryPoints=web,websecure",
        "traefik.http.routers.jellyfin.rule=Host(`jellyfin.${var.domain}`)",
      ]

      check {
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "jellyfin" {
      driver = "docker"

      config {
        image = "lscr.io/linuxserver/jellyfin:latest"
        ports = ["http"]
      }

      env {
        PUID = 1000
        PGID = 1000
        TZ = "America/Chicago"
      }
    }
  }
}
