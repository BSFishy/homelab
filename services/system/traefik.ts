import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

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
            // Type must be ClusterIP instead of LoadBalancer on k3s
            type: "LoadBalancer",
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

    this.ready = this.chart.ready;

    this.registerOutputs();
  }
}
