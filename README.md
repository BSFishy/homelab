# homelab

Setup for running my homelab configuration. This is effectively just a Pulumi configuration
that orchestrates a Kubernetes cluster and configures Cloudflare Zero Trust. The
idea is to have an entire homelab configuration in a single, public repository that
anyone can use (although it is certainly opinionated).

> [!WARNING]
> This repository is still a work in progress. I have gotten most of the backbone
> working, but that's not to say it's the end-all be-all. A number of significant
> features still need to be implemented, including authentication, logging and metrics,
> and persistent storage.
>
> If you're interested in this repo, feel free to explore, but I wouldn't recommend
> actually attempting to deploy a cluster unless you're ready to do some troubleshooting
> :)

## Usage

First, you need a Kubernetes cluster. Orchestrating one is outside of the scope
of this project, so you'll need to figure that out yourself. I would recommend using
[k3s](https://k3s.io) for a homelab deployment.

Once you have that, make sure you have Nodejs installed. I use version 22, although
any modern (latest or stable) version _should_ work.

At this point, you need to install NPM dependencies. This can be done with the
following command:

```bash
npm install
```

Once dependencies are installed, you can make a Pulumi stack then export the `KUBECONFIG`
environment variable. This should be a path to the Kubernetes config file that Pulumi
uses. This is the default if you are using a local instance of k3s:

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
```

Finally, to orchestrate the cluster, you can run the following command:

```bash
pulumi up
```

This will most likely prompt you for some configuration values, so put those in
and once it has all of the configuration it needs, it will deploy the setup.

## Other notes

### Resetting k3s

Sometimes it's useful to fully reset k3s. This took me a little bit to figure out,
so I'll leave you with some commands to leave you off in a fresh state:

```bash
# kill and remove k3s network interfaces
k3s-killall.sh

# clear out k3s state and refresh local ip state
sudo rm -rf /var/lib/rancher /etc/rancher ~/.kube/*
sudo ip addr flush dev lo
sudo ip addr add 127.0.0.1/8 dev lo
```

### Bad state issues

There are some instance where the setup will break because of bad state. These instances
are usually difficult to diagnose, but luckily the solution is easy, so if you're
having issues, I would recommend trying these steps:

1. Destroy and redeploy the cluster. To destroy the cluster, run `pulumi destroy`.
2. Try the commands in [Resetting k3s](#resetting-k3s).

Doing these two things will usually fix state issues with kube-vip (the bare-metal
load balancer) and cert-manager (the ssl certificate manager), which is where most
state issues arise from.
