# Homelab Management System v2 Plan

## Overview

This document outlines the plan for version 2 of the Homelab Management System.
The system aims to provide an easy-to-use, robust, and scalable solution for managing
a homelab environment using Hashicorp's Nomad, Consul, and Vault.

## Scope

The Homelab Management System is responsible for:

- Configuring and deploying services in the homelab environment
- Managing integrations with external services (VPN, DNS, etc.)
- Providing a user-friendly interface for homelab management

The following are explicitly out of scope for this project:

- Installation and updates of Nomad, Consul, and Vault
- Updates to the Homelab Management System itself
- Low-level network configuration (e.g., setting up VLANs)
- Hardware management

## System Architecture

The system will consist of the following components:

1. Hashicorp Nomad: For service orchestration and scheduling
2. Hashicorp Consul: For service discovery, health checking, and key-value store
3. Hashicorp Vault: For secrets management
4. Reverse Proxy: For routing and load balancing (multiple options supported)
5. NixOS: As the base operating system for all nodes
6. Custom Management Software: For setup, configuration, and ongoing management

## Custom Management Software

The custom management software will be written in Rust and will handle the following
tasks:

1. Initial setup and configuration
2. Service discovery and deployment
3. Integration with external services
4. Ongoing maintenance

### Functionality

#### 1. Initial Setup and Configuration

The configuration process will prompt the user for various details about their setup.
This interactive process will gather information such as:

- VPN provider (e.g., Cloudflare Tunnel, WireGuard)
- External DNS service (e.g., Cloudflare, AWS Route53)
- Reverse proxy preference (e.g., Traefik, Nginx)
- Authentication method (e.g., Authelia, Keycloak)

The system will determine which options are available by scanning a predefined directory
of supported integrations. Each integration will have its own module with a standard
interface, allowing for easy addition of new supported services.

Example directory structure for integrations:

```txt
src/
  integrations/
    vpn/
      cloudflare_tunnel.rs
      wireguard.rs
    dns/
      cloudflare.rs
      route53.rs
    reverse_proxy/
      traefik.rs
      nginx.rs
    auth/
      authelia.rs
      keycloak.rs
```

Each integration module will define:

- Configuration options required from the user
- Methods for setting up and configuring the service
- Methods for integrating with other components of the system

After gathering all necessary information, the system will generate a configuration
file to store these settings for future use. This file will not contain node-specific
information, as the system is designed to allow dynamic addition and removal of nodes.

Example configuration file (YAML):

```yaml
homelab:
  domain: home.example.com

vpn:
  provider: cloudflare_tunnel
  config:
    account_id: ${CF_ACCOUNT_ID}
    tunnel_id: ${CF_TUNNEL_ID}

dns:
  provider: cloudflare
  config:
    api_token: ${CF_API_TOKEN}
    zone_id: ${CF_ZONE_ID}

reverse_proxy:
  provider: traefik

auth:
  provider: authelia
  config:
    admin_user: ${AUTH_ADMIN_USER}
    admin_password: ${AUTH_ADMIN_PASSWORD}
```

#### 2. Service Discovery and Deployment

The management software will discover available services by walking the directory
structure of the project. It will look for service definition files, which could
be either Nomad jobspecs or custom definition files that generate Nomad jobspecs.

Example directory structure for services:

```txt
services/
  nextcloud/
    service.hcl
  pihole/
    service.hcl
  plex/
    service.hcl
```

The `service.hcl` files will contain all necessary information to deploy the service,
including:

- Service name and description
- Docker image and tag
- Resource requirements
- Environment variables
- Volumes and persistent storage requirements
- Network ports
- Whether the service should be publicly accessible

Example `service.hcl`:

```hcl
service {
  name = "nextcloud"
  description = "Self-hosted file sync and share"

  container {
    image = "nextcloud:latest"
    ports = [
      {
        internal = 80
        external = 8080
      }
    ]
  }

  resources {
    cpu = 1000
    memory = 2048
  }

  volume {
    name = "nextcloud-data"
    path = "/var/www/html"
  }

  env {
    NEXTCLOUD_ADMIN_USER = "vault:secret/nextcloud#admin_user"
    NEXTCLOUD_ADMIN_PASSWORD = "vault:secret/nextcloud#admin_password"
  }

  public_access = true
}
```

The management software will parse these files, generate the appropriate Nomad jobspecs,
and deploy the services using the Nomad API.

#### 3. External Service Integration

Based on the user's choices during the configuration step, the management software
will set up and configure the chosen external services. This includes:

- Setting up VPN for secure remote access
- Configuring external DNS for public services
- Setting up the chosen reverse proxy (e.g., Traefik)

The software will use the integration modules mentioned earlier to perform these
tasks.

#### 4. Ongoing Maintenance

While updates to core components (Nomad, Consul, Vault) are out of scope, the management
software will provide tools for:

- Updating running services
- Adding new services
- Removing services
- Viewing logs and metrics

## User Flow

1. Initial Setup:

   - User installs Nomad, Consul, and Vault on their nodes
   - User installs the Homelab Management System

2. Configuration:

   - User runs `homelab-manager configure`
   - System prompts for VPN, DNS, reverse proxy, and auth choices
   - System generates configuration file

3. Service Deployment:

   - User adds service definition files to the `services/` directory
   - User runs `homelab-manager deploy`
   - System discovers services, generates jobspecs, and deploys to Nomad

4. Ongoing Management:
   - User can add/remove services by modifying the `services/` directory and running
     `homelab-manager deploy`
   - User can update services with `homelab-manager update <service-name>`
   - User can view logs with `homelab-manager logs <service-name>`

## Templating

The system will use a templating engine (e.g., Handlebars) for generating configuration
files and jobspecs. This allows for flexible configuration of services and integration
with Vault for secret management.

Example template for Traefik configuration:

```handlebars
[entryPoints] [entryPoints.web] address = ":80" [entryPoints.websecure] address
= ":443" [providers.consulCatalog] prefix = "traefik" exposedByDefault = false
[certificatesResolvers.myresolver.acme] email = "{{email}}" storage =
"acme.json" [certificatesResolvers.myresolver.acme.httpChallenge] entryPoint =
"web"

{{#if auth.enabled}}
  [middleware.auth] [middleware.auth.forwardAuth] address = "http://{{auth.service}}:{{auth.port}}/api/verify?rd=https://{{auth.service}}.{{domain}}"
{{/if}}
```

## Conclusion

This plan outlines a detailed approach to building a flexible and user-friendly
homelab management system. By focusing on service discovery, external integrations,
and providing a clear user flow, we can create a system that is easy to set up,
maintain, and expand over time. The system's modular design allows for easy addition
of new integrations and services in the future.
