variable "domain" {
  type    = string
  default = "home"
}

job "pihole" {
  type = "service"

  group "pihole" {
    count = 1

    network {
      port "dns" {
        static = 53
      }

      port "http" {}
    }

    service {
      name = "http"
      port = "http"

      tags = [
        "traefik.enable=true",
        "traefik.http.routers.pihole.entryPoints=web,websecure",
        "traefik.http.routers.pihole.rule=Host(`pihole.${var.domain}`)",
      ]
    }

    service {
      name = "dns"
      port = "dns"

      check {
        name     = "service: dns tcp check"
        type     = "tcp"
        interval = "10s"
        timeout  = "2s"

        success_before_passing   = "3"
        failures_before_critical = "3"
      }

      check {
        name     = "service: dns dig check"
        type     = "script"
        command  = "/usr/bin/dig"
        args     = ["+short", "@127.0.0.1"]
        task     = "pihole"
        interval = "10s"
        timeout  = "2s"

        check_restart {
          limit = 3
          grace = "60s"
        }
      }
    }

    task "pihole" {
      driver = "docker"

      config {
        image = "pihole/pihole:latest"
        network_mode = "host"

        volumes = [
          "local/etc-dnsmasq.d/00-custom.conf:/etc/dnsmasq.d/00-custom.conf",
        ]
      }

      env {
        DNSSEC = "true"
        TZ = "America/Chicago"
        PIHOLE_DNS_ = "1.1.1.1;1.0.0.1"
        WEB_PORT = "${NOMAD_PORT_http}"
      }

      template {
        destination = "secrets/pihole.env"
        env         = true
        change_mode = "noop"
        data        = <<EOF
WEBPASSWORD="hello"
EOF
      }

      template {
        destination = "local/etc-dnsmasq.d/00-custom.conf"
        change_mode = "restart"
        data        = <<EOF
# Enable forward lookup of the 'consul' domain:
{{range service "consul"}}server=/consul/{{.Address}}#8600
{{end}}
# Uncomment and modify as appropriate to enable reverse DNS lookups for
# common netblocks found in RFC 1918, 5735, and 6598:
#rev-server=0.0.0.0/8,127.0.0.1#8600
#rev-server=10.0.0.0/8,127.0.0.1#8600
#rev-server=100.64.0.0/10,127.0.0.1#8600
#rev-server=127.0.0.1/8,127.0.0.1#8600
#rev-server=169.254.0.0/16,127.0.0.1#8600
#rev-server=172.16.0.0/12,127.0.0.1#8600
rev-server=192.168.0.0/16,127.0.0.1#8600
#rev-server=224.0.0.0/4,127.0.0.1#8600
#rev-server=240.0.0.0/4,127.0.0.1#8600

# Local records
address=/pihole.${var.domain}/{{range service "traefik"}}{{.Address}}{{end}}
address=/traefik.${var.domain}/{{range service "traefik"}}{{.Address}}{{end}}
address=/vault.${var.domain}/{{range service "active.vault"}}{{.Address}}{{end}}
{{range $tag, $services := services | byTag}}{{ if eq $tag "dnsmasq.cname=true" }}{{range $services}}address=/{{.Name}}.${var.domain}/{{range service "traefik"}}{{.Address}}{{end}}
{{end}}{{end}}{{end}}
EOF
      }
    }
  }
}
