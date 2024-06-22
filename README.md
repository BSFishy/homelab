# homelab

Setup for running my homelab configuration. This includes both configuration
for Docker services, as well as an orchestration utility. The utility will
automatically negotiate port numbers for all of the services, read in
environment variables for use in the Docker compose files, and automatically
configure a Cloudflare tunnel.

> [!WARNING]
> The code in this codebase is pretty bad. Right now, I'm getting stuff
> working, so I'm not really worried about making things "production ready"
> (the code still works, and my priority is really just making it work). I
> would advise discretion before diving into the code and prepare to jump around
> a lot. Additionally, it's written basically only for my own use-case, so be
> cautious if your use-case is anything outside of exactly what I want.

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

Make sure this is run in the root directory of this project. It generates a
`docker-compose.yml` file, which is the main entry-point of Docker compose.
The file is generated by searching the project for `compose.yml` files and
consolidating them in the `docker-compose.yml` file, so be sure to run it in
the root of the project.

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
  - [x] Extend bootstrap tool to automatically set up the Cloudflare tunnel if desired
  - [x] Make bootstrap process negotiate port numbers then output something for
        reference on port numbers
