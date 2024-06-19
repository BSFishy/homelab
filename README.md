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
