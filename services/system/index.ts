import * as pulumi from "@pulumi/pulumi";
import { Cloudflare } from "./cloudflare";
import { ExternalDns } from "./external_dns";
import { KubeVip } from "./kube_vip";
import { KubeVipCloudProvider } from "./kube_vip_cloud_provider";
import { PiHole } from "./pihole";
import { Traefik } from "./traefik";

export class System extends pulumi.ComponentResource {
  public readonly cloudflare: Cloudflare;
  public readonly external_dns: ExternalDns;
  public readonly kube_vip: KubeVip;
  public readonly kube_vip_cloud_provider: KubeVipCloudProvider;
  public readonly pihole: PiHole;
  public readonly traefik: Traefik;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:component:system", name, {}, opts);

    this.kube_vip = new KubeVip("kube-vip", { parent: this });

    this.kube_vip_cloud_provider = new KubeVipCloudProvider(
      "kube-vip-cloud-provider",
      { parent: this },
    );

    this.traefik = new Traefik("traefik", {
      parent: this,
      dependsOn: pulumi
        .all([this.kube_vip.ready, this.kube_vip_cloud_provider.ready])
        .apply((ready) => ready.flat()),
    });

    this.pihole = new PiHole("pihole", {
      parent: this,
      dependsOn: pulumi
        .all([this.kube_vip.ready, this.kube_vip_cloud_provider.ready])
        .apply((ready) => ready.flat()),
    });

    this.external_dns = new ExternalDns("external-dns", {
      parent: this,
      dependsOn: pulumi
        .all([
          this.kube_vip.ready,
          this.kube_vip_cloud_provider.ready,
          this.traefik.ready,
          this.pihole.ready,
        ])
        .apply((ready) => ready.flat()),
    });

    const piholeChart = this.pihole.chart;
    const traefikChart = this.traefik.chart;
    this.cloudflare = new Cloudflare(
      "cloudflare",
      {
        // FIXME: only gets first IP
        dnsUdpIp: piholeChart.ready.apply(() =>
          piholeChart
            .getResourceProperty(
              "v1/Service",
              "pihole",
              "pihole-chart-dns-udp",
              "status",
            )
            .apply((status) => status.loadBalancer.ingress[0].ip),
        ),
        dnsTcpIp: piholeChart.ready.apply(() =>
          piholeChart
            .getResourceProperty(
              "v1/Service",
              "pihole",
              "pihole-chart-dns-tcp",
              "status",
            )
            .apply((status) => status.loadBalancer.ingress[0].ip),
        ),
        webIp: traefikChart.ready.apply(() =>
          traefikChart
            .getResourceProperty(
              "v1/Service",
              "traefik",
              "traefik-chart",
              "status",
            )
            .apply((status) => status.loadBalancer.ingress[0].ip),
        ),
      },
      {
        parent: this,
        dependsOn: pulumi
          .all([this.pihole.ready, this.traefik.ready])
          .apply((ready) => ready.flat()),
      },
    );

    this.ready = pulumi
      .all([
        this.kube_vip.ready,
        this.kube_vip_cloud_provider.ready,
        this.traefik.ready,
        this.pihole.ready,
        this.external_dns.ready,
        this.cloudflare.ready,
      ])
      .apply((ready) => ready.flat());

    this.registerOutputs();
  }
}
