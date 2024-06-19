# homelab

Setup for running my homelab configuration. Currently, this is just a Docker
Compose configuration, however I might expand this to include some sort of
bootstrap script to streamline the configuration and preparation of the Docker setup.

## Usage

### Running

```bash
docker compose up
```

### Updating images

```bash
docker compose pull
```

### Updating containers

```bash
docker compose up -d
```

### Pruning existing containers

```bash
docker container prune
```

## Usage as root

### Running as root

```bash
sudo $(which docker) compose up
```

### Updating images as root

```bash
sudo $(which docker) compose pull
```

### Updating containers as root

```bash
sudo $(which docker) compose up -d
```

### Pruning existing containers as root

```bash
sudo $(which docker) container prune
```

## TODO

Here is a list of things that I want to do with this setup:

- [ ] Organize compose files into a more structured system. For example, put
      all tools into a root level `tools` directory, put all starr applications
      into a root level `starr` directory, etc.
- [ ] Create or utilize a tool for templating to streamline the bootstrap
      process. For example, automatically retrieve the current user ID for
      proper file permissions.
