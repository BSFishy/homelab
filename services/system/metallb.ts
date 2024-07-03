import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export class Metallb extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly addressPool: k8s.apiextensions.CustomResource;
  public readonly l2Advertisement: k8s.apiextensions.CustomResource;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:system:metallb", name, {}, opts);

    this.namespace = new k8s.core.v1.Namespace(
      "metallb",
      {
        metadata: {
          name: "metallb",
        },
      },
      { parent: this },
    );

    this.chart = new k8s.helm.v3.Chart(
      "metallb",
      {
        chart: "metallb",
        namespace: this.namespace.metadata.name,
        fetchOpts: {
          repo: "https://metallb.github.io/metallb",
        },
      },
      { parent: this },
    );

    this.addressPool = new k8s.apiextensions.CustomResource(
      "metallb",
      {
        apiVersion: "metallb.io/v1beta1",
        kind: "IPAddressPool",
        metadata: {
          name: "metallb",
          namespace: this.namespace.metadata.name,
        },
        spec: {
          addresses: ["192.168.1.10-192.168.1.250"],
        },
      },
      { parent: this, dependsOn: this.chart.ready },
    );

    this.l2Advertisement = new k8s.apiextensions.CustomResource(
      "metallb",
      {
        apiVersion: "metallb.io/v1beta1",
        kind: "L2Advertisement",
        metadata: {
          name: "metallb",
          namespace: this.namespace.metadata.name,
        },
      },
      { parent: this, dependsOn: this.chart.ready },
    );

    this.registerOutputs();
  }
}
