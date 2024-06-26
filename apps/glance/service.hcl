variable "domain" {
  type    = string
  default = "home"
}

job "glance" {
  type = "service"

  group "glance" {
    count = 1

    network {
      port "http" {}
    }

    service {
      name = "glance"
      port = "http"

      tags = [
        "dnsmasq.cname=true",
        "traefik.enable=true",
        "traefik.http.routers.glance.entryPoints=web,websecure",
        "traefik.http.routers.glance.rule=Host(`glance.${var.domain}`)",
      ]

      check {
        type     = "http"
        path     = "/"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "glance" {
      driver = "docker"

      config {
        image = "glanceapp/glance:latest"
        network_mode = "host"

        volumes = [
          "local/glance.yml:/app/glance.yml"
        ]
      }

      template {
        destination = "local/glance.yml"
        data = <<EOF
server:
  port: {{env "NOMAD_PORT_http"}}

theme:
  background-color: 0 0 16
  primary-color: 183 33 40
  positive-color: 60 71 35
  negative-color: 2 75 46
  contrast-multiplier: 1.3

pages:
  - name: Home
    columns:
      - size: small
        widgets:
          - type: calendar
          - type: monitor
            cache: 1m
            title: Services
            sites:
              - title: Glance
                url: http://glance.home/
              - title: Traefik
                url: http://traefik.home/dashboard/
              - title: PiHole
                url: http://pihole.home/admin/
          - type: twitch-channels
            channels:
              - theprimeagen
              - piratesoftware
              - sphaerophoria
              - tsoding
              - teej_dv
      - size: full
        widgets:
          - type: hacker-news
          - type: videos
            channels:
              - UCXuqSBlHAE6Xw-yeJA0Tunw # LinusTechTips
              - UCdBK94H6oZT2Q7l0-b0xmMg # Short Cirtuit
              - UCeeFfhMcJa1kjtfZAGskOCA # TechLinked
              - UCHDxYLv8iovIbhrfl16CNyg # GameLinked
              - UCFLFc8Lpbwt4jPtY1_Ai5yA # LMG Clips
              - UC8ENHE5xdFSwx71u3fDH5Xw # ThePrimeagen
              - UCUyeluBRhGPCW4rPe_UvBZQ # ThePrimeTime
              - UCBJycsmduvYEL83R_U4JriQ # mkbhd
          - type: reddit
            subreddit: selfhosted
      - size: small
        widgets:
          - type: clock
            hour-format: 12h
            timezones:
              - timezone: America/Los_Angeles
                label: Pacific
              - timezone: America/New_York
                label: Eastern
          - type: weather
            units: imperial
            hour-format: 12h
            location: Austin, Texas, United States
          - type: markets
            markets:
              - symbol: SPY
                name: S&P 500
              - symbol: NET
                name: Cloudflare
EOF
      }
    }
  }
}
