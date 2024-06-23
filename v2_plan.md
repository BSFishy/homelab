# v2 plan

This document outlines the plan for the manager version 2. This is a complete rewrite
now that I know what it needs to be able to do and this document is basically just
to create a plan and to give myself reference when implementing v2.

## Vision

The vision is to be able to run a situation like this:

```bash
cargo run configure # input configuration such as api keys
cargo run bootstrap # bootstrap the repo to be able to be run
docker compose up # run all of the services
```

## Configure

The first step of the manager process should be to configure the setup. This would
include things like specifying API keys, and determining which services should be
run where.

A big feature of the configure stage is a step where the manager allows connection
between multiple computers. This allows services to be distributed across multiple
machines, but it's important that they can exchange information for things like port
negotiation.

### Connection

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

### DNS & VPN Settings

The homelab will need both public DNS and VPN setup. To begin with, I'm going to
implement Cloudflare for the public DNS stuff and Cloudflare Tunnel for the VPN
(it's not a VPN but functions like one). This will necessitate putting in API tokens
and such.

In the future, this should support things like Wireguard, and potentially other
DNS servers and such, but my use case is currently Cloudflare, so I won't worry
about implementing that right now. However, I will make the interfaces to enable
the easy implementation later.

### Service Toggling

The final step of configuration is enabling and disabling services. This involves
prompting for each machine, which services should be run. Some services, such as
`cloudflared` can be run on multiple machines, however some services should only
run on a single machine.

### Finalization

Once we have all of the information we need, finalization can occur. This will include
port negotiation, preparing cloud services, and distributing information across
the network.

## Bootstrap
