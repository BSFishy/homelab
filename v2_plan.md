# v2 plan

This document outlines the plan for the manager version 2. This is a complete rewrite
now that I know what it needs to be able to do and this document is basically just
to create a plan and to give myself reference when implementing v2.

Some major features of this version include:

- Global authentication
- Specifying services as public or private
- Agnostic across different implementations of functionality, i.e. VPNs, DNS, authentication
- Distributable across multiple machines

## Authentication

Authentication is an important part of any system. It is imperative that the homelab
facilitates and enforces a strong security system using well known and trusted technologies.

To begin with, I am going to use Authelia, most likely in conjunction with some
sort of LDAP system. This will hook into the reverse proxy (nginx) to ensure that
each service is authenticated and doesn't allow prying eyes.

### SSL

Getting all services running on SSL is important. This provides an additional layer
of security and helps prevent certain types of attacks. Granted, private access
should be under the safety of a VPN solution, HTTPS is a desirable feature and should
be considered high priority.

I have gone back and forth with this, as I feel it could be rather difficult. It
will most likely involve creating a certificate authority, since we will most likely
be using domains like `*.local`, which most likely won't be easy to get certificates
for with regular authorities. It will also involve generating the certificates and
rolling them as needed, which I also don't know much about in a Docker (Compose)
environment.

### Authentication considerations

- Still need to figure out passwords. I want to self host a password manager (i.e.
  Bitwarden), but we run into a sort of chicken and egg situation because we need
  passwords to setup certain services that require keys, however at the stage of
  setting everything up, we don't have access to Bitwarden to see if passwords already
  exist that we can use. Still need to figure this one out.

## Implementation

### Vision

The vision is to be able to run a situation like this:

```bash
cargo run configure # input configuration such as api keys
cargo run bootstrap # bootstrap the repo to be able to be run
docker compose up # run all of the services
```

### Configure

The first step of the manager process should be to configure the setup. This would
include things like specifying API keys, and determining which services should be
run where.

A big feature of the configure stage is a step where the manager allows connection
between multiple computers. This allows services to be distributed across multiple
machines, but it's important that they can exchange information for things like port
negotiation.

The first piece of this is most likely just a walk of the directory to see what
services are available, how they might fit together, etc. I am still trying to figure
out how to specify services, since I dislike the model of having a `compose.yml`/`compose.in.yml`
**and** a `service.json`/`service.in.json`. Additionally, it needs to support service
specific templating/configuration, such as nginx site configurations, PiHole DNS
lists, etc.

#### Connection

The connection step establishes an authority. This is the server that works as the
determiner of things that need to be distributed, such as port negotiation.

A port needs to be established as the configuration service port. During this step,
the authority listens on this port, then children will search the network for a
machine that's listening on this port. These machines will establish a connection
then proceed through the process simultaneously.

The actual configuration will happen through the authority. The global settings
will be done once then instance-specific settings will be prompted for each instance.

A part of this will be identifying the version that each instance has of everything
(most likely some sort of hash or CRC or something of the current working directory)
as well as some sort of enumeration of all of the services that are available for
use later.

#### Global Settings

The homelab will need both public DNS and VPN setup, as well as some other global
services, such as authentication, and password management. To begin with, I'm going
to implement Cloudflare for the public DNS stuff and Cloudflare Tunnel for the VPN
(it's not a VPN but functions like one). This will necessitate putting in API tokens
and such.

In the future, this should support things like Wireguard, and potentially other
DNS servers and such, but my use case is currently Cloudflare, so I won't worry
about implementing that right now. However, I will make the interfaces to enable
the easy implementation later.

These settings will influence the implementation of the system. For example, a reverse
proxy will need to be configured to use an authentication service. Some services
will need to be setup with usernames and passwords, which should be stored in a
password manager. These settings can affect the entire system and influence how
the system should be composed. For example, if we can choose between multiple VPN
providers, only a single one should be included in the resulting Docker setup.

#### Service Toggling

The final step of configuration is enabling and disabling services. This involves
prompting for each machine, which services should be run. Some services, such as
`cloudflared` can be run on multiple machines, however some services should only
run on a single machine.

In this stage, we should also be able to specify services that are public. This
will involve creating subdomains for the public services. Regardless of whether
a service is public or private, it should point to the reverse proxy so that we
get consistent functionality (i.e. authentication) across the board.

#### Finalization

Once we have all of the information we need, finalization can occur. This will include
port negotiation, preparing cloud services, and distributing information across
the network.

I'm sure a piece of this will include setting up Docker secrets and distributing
pertinent information to services that need it.

##### Cloudflare

This will involve setting up the Cloudflare tunnel as well as any Cloudflare DNS
for public services. The process of setting Cloudflare tunnel as a private VPN can
be found [in this guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/private-net/cloudflared/private-dns/).

If possible, the system should reuse as much existing configuration as possible.
This will most likely be chosen in the [Global Setting step](#global-settings).

### Bootstrap

The bootstrap stage is the part where we get the file system ready for running.
This will involve generating files with proper user IDs, generating service-specific
configuration files, and generating the final Docker Compose files.

I don't want this step to require any input and I want it to be completely safe
to run as many times as desired. It shouldn't need to connect to and change any
other services, it should really just be generating files on the file system. As
such, it should be a pretty quick and safe operation.

#### Templating

Templating is an important part of the process. This allows for files to be baked
with things like user IDs, references to secrets, proper port numbers, etc.

The previous format I followed went as follows:

1. Search for files that are not ignored that include `.in.` in their name
2. Search for sections of these files that follow the `${part 1:part 2}` format
3. Replace each matching section with valid data
   - For example, if it said `${PORT:dozzle}`, it would keep a cache with all port
     numbers. If it found it in the cache, it would return that. Otherwise, it would
     add one to the current counter and test if it's an open port until it found
     an open port, cache that, and return it.
4. Save the resulting file without the `.in.` in the file name.

This allowed for a flexible and powerful system, however I don't know if I love
it. I'm still wondering if there's a better templating solution that I could use
that offers more flexibility without feeling as flakey.

#### Generating service configuration

An important step will be generating service-specific configurations. For example,
nginx will need configuration files for each service to properly route it to the
correct service. I'm sure other services will need something similar as well, but
the only other I know of at the moment is PiHole, which needs files for DNS configurations.

Currently I have most of this process hard coded. In the manager project, I hard
code where to save files, and I hard code the actual format that they should be
saved in. I hate this system and want to have something much cleaner that allows
for more flexibility. For example, maybe search for a file (or specify a directory
that contains a file) that follows something similar to the templating format, then
use that as a template for the files. Still undecided, need to figure this out.

#### Generating Docker Compose

The final step will probably be generating the Docker Compose file(s). Getting most
(or hopefully all) of the actual pertinent information should probably be able to
be handled in the [templating step](#templating), so this will most likely just
be generating the final `docker-compose.yml` file to include all of the relevant
fragment files.

## Other considerations

I want to make extensive use of Docker features. Currently, I'm really only using
Docker Compose, without using volumes, networks, Docker Swarm, or Docker secrets.
I want to use these as much as possible to make this system as reliable and fully
featured as possible.
