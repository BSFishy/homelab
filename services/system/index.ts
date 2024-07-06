import * as pulumi from "@pulumi/pulumi";
import { ExternalDns } from "./external_dns";
import { KubeVip } from "./kube_vip";
import { KubeVipCloudProvider } from "./kube_vip_cloud_provider";
import { PiHole } from "./pihole";
import { Traefik } from "./traefik";

export class System extends pulumi.ComponentResource {
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

    this.ready = pulumi
      .all([
        this.kube_vip.ready,
        this.kube_vip_cloud_provider.ready,
        this.traefik.ready,
        this.pihole.ready,
        this.external_dns.ready,
      ])
      .apply((ready) => ready.flat());

    this.registerOutputs();
  }
}
