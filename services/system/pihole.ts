import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { CONFIG, subdomain } from "../config";
import { ready } from "../util";

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
          DNS1: "1.1.1.1",
          DNS2: "1.0.0.1",
          adminPassword: "abc",
          serviceWeb: {
            type: "LoadBalancer",
          },
          serviceDns: {
            type: "LoadBalancer",
            loadBalancerIP: CONFIG.useDhcp ? "0.0.0.0" : undefined,
          },
          serviceDhcp: {
            enabled: false,
          },
          ingress: {
            enabled: true,
            hosts: [subdomain("pihole")],
          },
          podDnsConfig: {
            enabled: true,
            policy: "None",
            nameservers: ["1.1.1.1", "1.0.0.1"],
          },
          doh: {
            enabled: true,
            pullPolicy: "Always",
            envVars: {
              DOH_UPSTREAM: "https://1.1.1.1/dns-query",
            },
          },
        },
      },
      { parent: this },
    );

    this.ready = ready([this.namespace, this.chart.ready]);

    this.registerOutputs();
  }
}
