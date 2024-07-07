import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export class PiHole extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:system:pihole", name, {}, opts);

    this.namespace = new k8s.core.v1.Namespace(
      "pihole-namespace",
      {
        metadata: {
          name: "pihole",
        },
      },
      { parent: this },
    );

    this.chart = new k8s.helm.v3.Chart(
      "pihole-chart",
      {
        chart: "pihole",
        namespace: this.namespace.metadata.name,
        fetchOpts: {
          repo: "https://mojo2600.github.io/pihole-kubernetes/",
        },
        values: {
          adminPassword: "abc",
          serviceWeb: {
            type: "ClusterIP",
          },
          serviceDns: {
            type: "LoadBalancer",
          },
          serviceDhcp: {
            enabled: false,
          },
          ingress: {
            enabled: true,
            hosts: ["pihole.home"],
          },
          podDnsConfig: {
            enabled: true,
            policy: "None",
            nameservers: ["127.0.0.1", "1.1.1.1", "1.0.0.1"],
          },
          doh: {
            enabled: true,
            pullPolicy: "Always",
          },
          envVars: {
            DOH_UPSTREAM: "https://1.1.1.1/dns-query",
          },
        },
      },
      { parent: this },
    );

    this.ready = pulumi
      .all([this.namespace, this.chart.ready])
      .apply((ready) => ready.flat());

    this.registerOutputs();
  }
}
