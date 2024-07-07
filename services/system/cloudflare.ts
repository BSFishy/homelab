import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import * as cf from "@pulumi/cloudflare";
import { CONFIG } from "../config";
import { ready } from "../util";

interface CloudflareArgs {
  dnsUdpIp: pulumi.Input<string>;
  dnsTcpIp?: pulumi.Input<string>;
  webIp: pulumi.Input<string>;
}

// Sets up a tunnel and private DNS as mentioned in this guide:
// https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/private-net/cloudflared/private-dns/
export class Cloudflare extends pulumi.ComponentResource {
  public readonly tunnelSecret: random.RandomPassword;
  public readonly virtualNetwork: cf.TunnelVirtualNetwork;
  public readonly tunnel: cf.Tunnel;
  public readonly dnsUdpRoute: cf.TunnelRoute;
  public readonly dnsTcpRoute: cf.TunnelRoute | undefined;
  public readonly webRoute: cf.TunnelRoute;
  public readonly teamsAccount: cf.TeamsAccount;
  public readonly fallbackDomain: cf.FallbackDomain;
  public readonly splitTunnel: cf.SplitTunnel;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(
    name: string,
    args: CloudflareArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("homelab:system:cloudflare", name, {}, opts);

    const accountId = CONFIG.account.id as pulumi.Output<string>;

    this.tunnelSecret = new random.RandomPassword(
      "cf-tunnel-secret",
      { length: 16 },
      { parent: this },
    );

    this.virtualNetwork = new cf.TunnelVirtualNetwork(
      "cf-tunnel-virtual-network",
      {
        accountId,
        comment: "[AUTOGEN] Virtual network used by the homelab",
        name: "homelab",
      },
      { parent: this },
    );

    this.tunnel = new cf.Tunnel(
      "cf-tunnel",
      {
        accountId,
        // We want this to be configurable through the Cloudflare dashboard
        configSrc: "cloudflare",
        name: "homelab",
        secret: this.tunnelSecret.result.apply(btoa),
      },
      { parent: this, dependsOn: [this.virtualNetwork] },
    );

    this.dnsUdpRoute = new cf.TunnelRoute(
      "cf-dns-udp-route",
      {
        accountId,
        comment: "[AUTOGEN] UDP DNS server",
        // CIDR for the IP exactly
        network: pulumi.output(args.dnsUdpIp).apply((ip) => `${ip}/32`),
        tunnelId: this.tunnel.id,
        virtualNetworkId: this.virtualNetwork.id,
      },
      { parent: this, dependsOn: [this.virtualNetwork, this.tunnel] },
    );

    if (args.dnsTcpIp) {
      this.dnsTcpRoute = new cf.TunnelRoute(
        "cf-dns-tcp-route",
        {
          accountId,
          comment: "[AUTOGEN] TCP DNS server",
          // CIDR for the IP exactly
          network: pulumi.output(args.dnsTcpIp).apply((ip) => `${ip}/32`),
          tunnelId: this.tunnel.id,
          virtualNetworkId: this.virtualNetwork.id,
        },
        { parent: this, dependsOn: [this.virtualNetwork, this.tunnel] },
      );
    } else {
      this.dnsTcpRoute = undefined;
    }

    this.webRoute = new cf.TunnelRoute(
      "cf-web-route",
      {
        accountId,
        comment: "[AUTOGEN] web server",
        // CIDR for the IP exactly
        network: pulumi.output(args.webIp).apply((ip) => `${ip}/32`),
        tunnelId: this.tunnel.id,
        virtualNetworkId: this.virtualNetwork.id,
      },
      { parent: this, dependsOn: [this.virtualNetwork, this.tunnel] },
    );

    // TODO: it would be really nice to get previous state then update it, since
    // pulumi decides this should be updated like every time we run it
    this.teamsAccount = new cf.TeamsAccount(
      "cf-teams-account",
      {
        accountId,
        proxy: {
          rootCa: false,
          tcp: true,
          udp: true,
          virtualIp: false,
        },
      },
      { parent: this },
    );

    const privateDomain = CONFIG.domain.apply(
      (domain) => `${CONFIG.privateSubdomain}.${domain.name}`,
    );
    this.fallbackDomain = new cf.FallbackDomain(
      "cf-fallback-domain",
      {
        accountId,
        domains: [
          {
            description: "[AUTOGEN] homelab",
            dnsServers: [args.dnsUdpIp, args.dnsTcpIp!].filter(Boolean),
            suffix: privateDomain,
          },
        ],
      },
      { parent: this, dependsOn: [this.tunnel] },
    );

    this.splitTunnel = new cf.SplitTunnel(
      "cf-split-tunnel",
      {
        accountId,
        mode: "include",
        tunnels: [
          { description: "[AUTOGEN] homelab domains", host: privateDomain },
          {
            description: "[AUTOGEN] homelab dns over udp",
            address: pulumi.output(args.dnsUdpIp).apply((ip) => `${ip}/32`),
          },
          (args.dnsTcpIp && {
            description: "[AUTOGEN] homelab dns over tcp",
            address: pulumi.output(args.dnsTcpIp).apply((ip) => `${ip}/32`),
          }) as cf.types.input.SplitTunnelTunnel,
          {
            description: "[AUTOGEN] homelab web server",
            address: pulumi.output(args.webIp).apply((ip) => `${ip}/32`),
          },
        ].filter(Boolean),
      },
      { parent: this, dependsOn: [this.tunnel] },
    );

    this.ready = ready([
      this.tunnelSecret,
      this.virtualNetwork,
      this.tunnel,
      this.dnsUdpRoute,
      this.dnsTcpRoute,
      this.webRoute,
      this.teamsAccount,
      this.fallbackDomain,
      this.splitTunnel,
    ]);

    this.registerOutputs();
  }
}
