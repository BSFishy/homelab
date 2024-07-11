import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { CONFIG } from "../config";
import { ready } from "../util";

interface TraefikArgs {
  namespace: pulumi.Input<string>;
  certSecretName: pulumi.Input<string>;
}

export class Traefik extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v3.Chart;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(
    name: string,
    args: TraefikArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("homelab:system:traefik", name, {}, opts);

    this.chart = new k8s.helm.v3.Chart(
      "traefik-chart",
      {
        chart: "traefik",
        namespace: args.namespace,
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
              enabled: true,
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
          tlsStore: {
            default: {
              defaultCertificate: {
                secretName: args.certSecretName,
              },
            },
          },
        },
      },
      { parent: this },
    );

    this.ready = ready([this.chart.ready]);

    this.registerOutputs();
  }
}
