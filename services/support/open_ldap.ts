import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { ready } from "../util";

export class OpenLdap extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:support:open_ldap", name, {}, opts);

    this.namespace = new k8s.core.v1.Namespace(
      "open-ldap-namespace",
      { metadata: { name: "open-ldap" } },
      { parent: this },
    );

    this.chart = new k8s.helm.v3.Chart(
      "open-ldap-chart",
      {
        chart: "openldap",
        namespace: this.namespace.metadata.name,
        fetchOpts: {
          repo: "https://symas.github.io/helm-openldap/",
        },
      },
      { parent: this },
    );

    this.ready = ready([this.namespace, this.chart.ready]);

    this.registerOutputs();
  }
}
