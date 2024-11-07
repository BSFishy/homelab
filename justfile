set dotenv-load

# list out available recipes
default:
  @just --list

alias c := config

# configure the project
config:
  go run config/main.go

# deploy the dev environment
dev:
  ansible-playbook deploy.yml -i inventory/localhost.yml

# deploy the local registry
[group('deploy')]
deploy-registry:
  docker service create --name registry --publish published=5000,target=5000 registry:2

# deploy the cloudflare zero trust syncer stack
[group('deploy')]
deploy-cfzt-sync:
  docker compose -f cfzt-sync/docker-compose.yml build
  docker compose -f cfzt-sync/docker-compose.yml push
  docker stack deploy -c cfzt-sync/docker-compose.yml cfzt-sync

#deploy the portainer stack
[group('deploy')]
deploy-portainer:
  docker stack deploy -c stacks/portainer/docker-compose.yml portainer

deploy-dozzle:
  docker stack deploy -c stacks/dozzle/docker-compose.yml dozzle
