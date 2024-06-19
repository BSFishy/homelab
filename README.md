# homelab

Setup for running my homelab configuration. Currently, this is just a Docker
Compose configuration, however I might expand this to include some sort of
bootstrap script to streamline the configuration and preparation of the Docker setup.

## Usage

### Bootstrapping

Before doing anything, this project needs to be bootstrapped. This will
automatically fill out the Docker files with important values, such as user and
group IDs to prevent permission issues. This will require Rust to be installed,
and will automatically be in your path if you use direnv and Nix. To run the
bootstrap process, run the following:

```bash
cargo run bootstrap
```

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

- [ ] Rewrite readme with better information. This should include information
      about setting up the project, documentation about how the system works
      including things like bootstrapping tools if they exist, the services
      that are set up, etc.
- [x] Organize compose files into a more structured system. For example, put
      all tools into a root level `tools` directory, put all starr applications
      into a root level `starr` directory, etc.
- [x] Create or utilize a tool for templating to streamline the bootstrap
      process. For example, automatically retrieve the current user ID for
      proper file permissions.
  - [ ] Extend bootstrap tool to automatically set up the Cloudflare tunnel if desired
  - [ ] Make bootstrap process negotiate port numbers then output something for
        reference on port numbers
