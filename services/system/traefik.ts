import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { CONFIG } from "../config";

export class Traefik extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:system:traefik", name, {}, opts);

    this.namespace = new k8s.core.v1.Namespace(
      "traefik-namespace",
      {
        metadata: {
          name: "traefik",
        },
      },
      { parent: this },
    );

    this.chart = new k8s.helm.v3.Chart(
      "traefik-chart",
      {
        chart: "traefik",
        namespace: this.namespace.metadata.name,
        fetchOpts: {
          repo: "https://traefik.github.io/charts",
        },
        values: {
          service: {
            type: "LoadBalancer",
            spec: {
              loadBalancerIP: CONFIG.useDhcp ? "0.0.0.0" : undefined,
            },
          },
          ingressRoute: {
            dashboard: {
              matchRule: "PathPrefix(`/dashboard`) || PathPrefix(`/api`)",
              entryPoints: ["web", "websecure"],
            },
          },
          providers: {
            kubernetesIngress: {
              publishedService: {
                enabled: true,
              },
            },
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
