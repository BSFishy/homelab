import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { ready } from "../util";

interface CloudflaredArgs {
  tunnelToken: pulumi.Input<string>;
}

export class Cloudflared extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(
    name: string,
    args: CloudflaredArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("homelab:system:cloudflared", name, {}, opts);

    this.namespace = new k8s.core.v1.Namespace(
      "cloudflared-namespace",
      {
        metadata: {
          name: "cloudflared",
        },
      },
      { parent: this },
    );

    this.chart = new k8s.helm.v3.Chart(
      "cloudflared-chart",
      {
        chart: "cloudflare-tunnel-remote",
        namespace: this.namespace.metadata.name,
        fetchOpts: {
          repo: "https://cloudflare.github.io/helm-charts",
        },
        values: {
          cloudflare: {
            tunnel_token: args.tunnelToken,
          },
        },
      },
      { parent: this },
    );

    this.ready = ready([this.namespace, this.chart.ready]);

    this.registerOutputs();
  }
}
