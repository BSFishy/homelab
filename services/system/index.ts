import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { CertManager } from "./cert_manager";
import { Cloudflare } from "./cloudflare";
import { Cloudflared } from "./cloudflared";
import { ExternalDns } from "./external_dns";
import { KubeVip } from "./kube_vip";
import { KubeVipCloudProvider } from "./kube_vip_cloud_provider";
import { PiHole } from "./pihole";
import { Traefik } from "./traefik";
import { ready } from "../util";

export class System extends pulumi.ComponentResource {
  public readonly traefikNamespace: k8s.core.v1.Namespace;

  public readonly cert_manager: CertManager;
  public readonly cloudflare: Cloudflare;
  public readonly cloudflared: Cloudflared;
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

    this.traefikNamespace = new k8s.core.v1.Namespace(
      "traefik-namespace",
      {
        metadata: {
          name: "traefik",
        },
      },
      { parent: this },
    );

    this.cert_manager = new CertManager(
      "cert-manager",
      { traefikNamespace: this.traefikNamespace.metadata.name },
      {
        parent: this,
        dependsOn: ready([
          this.kube_vip.ready,
          this.kube_vip_cloud_provider.ready,
        ]),
      },
    );

    this.traefik = new Traefik(
      "traefik",
      {
        namespace: this.traefikNamespace.metadata.name,
        certSecretName: this.cert_manager.secretName,
      },
      {
        parent: this,
        dependsOn: ready([
          this.kube_vip.ready,
          this.kube_vip_cloud_provider.ready,
          this.cert_manager.ready,
        ]),
      },
    );

    this.pihole = new PiHole("pihole", {
      parent: this,
      dependsOn: ready([
        this.kube_vip.ready,
        this.kube_vip_cloud_provider.ready,
        this.traefik.ready,
      ]),
    });

    this.external_dns = new ExternalDns("external-dns", {
      parent: this,
      dependsOn: ready([
        this.kube_vip.ready,
        this.kube_vip_cloud_provider.ready,
        this.traefik.ready,
        this.pihole.ready,
      ]),
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
        dependsOn: ready([this.pihole.ready, this.traefik.ready]),
      },
    );

    this.cloudflared = new Cloudflared(
      "cloudflared",
      { tunnelToken: this.cloudflare.tunnel.tunnelToken },
      { parent: this, dependsOn: this.cloudflare.ready },
    );

    this.ready = ready([
      this.traefikNamespace,

      this.kube_vip.ready,
      this.kube_vip_cloud_provider.ready,
      this.cert_manager.ready,
      this.traefik.ready,
      this.pihole.ready,
      this.external_dns.ready,
      this.cloudflare.ready,
      this.cloudflared.ready,
    ]);

    this.registerOutputs();
  }
}
