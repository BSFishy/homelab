# homelab

Welcome to my homelab repository. This contains everything I need to spin up an
instance of my homelab. It builds on these technologies:

- Docker Swarm
- Ansible
- Cloudflare & Cloudflare Zero Trust

To spin up an instance, you must first configure your project:

```shell
just config
```

This will run the just recipe to configure the project. It takes you through
configuring domain names, Access Groups, etc.

To actually deploy the services to the current node, run:

```shell
just dev
```

This uses ansible to deploy every service to the stack.
