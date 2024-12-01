set dotenv-load

# list out available recipes
default:
  @just --list

alias c := config

# configure the project
config:
  @go run config/main.go

# deploy the dev environment
dev:
  ansible-playbook deploy.yml -i inventory/localhost.yml

# delete all stacks
clean-stacks:
  docker stack ls --format json | jq -r .Name | xargs docker stack rm

# delete all volumes
clean-volumes:
  docker volume ls --format json | jq -r .Name | xargs docker volume rm

# print out the default admin password for ldap
ldap-password:
  @cat roles/openldap/files/credentials/password.txt
