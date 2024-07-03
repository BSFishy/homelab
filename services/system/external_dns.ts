import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export class ExternalDns extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly serviceAccount: k8s.core.v1.ServiceAccount;
  public readonly clusterRole: k8s.rbac.v1.ClusterRole;
  public readonly roleBinding: k8s.rbac.v1.ClusterRoleBinding;
  public readonly deployment: k8s.apps.v1.Deployment;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:system:external_dns", name, {}, opts);

    this.namespace = new k8s.core.v1.Namespace(
      "external-dns",
      {
        metadata: {
          name: "external-dns",
        },
      },
      { parent: this },
    );

    this.serviceAccount = new k8s.core.v1.ServiceAccount(
      "external-dns",
      {
        metadata: {
          name: "external-dns",
          namespace: this.namespace.metadata.name,
        },
      },
      { parent: this },
    );

    this.clusterRole = new k8s.rbac.v1.ClusterRole(
      "external-dns",
      {
        metadata: {
          name: "external-dns",
          namespace: this.namespace.metadata.name,
        },
        rules: [
          {
            apiGroups: [""],
            resources: ["services", "endpoints", "pods"],
            verbs: ["get", "watch", "list"],
          },
          {
            apiGroups: ["extensions", "networking.k8s.io"],
            resources: ["ingresses"],
            verbs: ["get", "watch", "list"],
          },
          { apiGroups: [""], resources: ["nodes"], verbs: ["list", "watch"] },
        ],
      },
      { parent: this },
    );

    this.roleBinding = new k8s.rbac.v1.ClusterRoleBinding(
      "external-dns",
      {
        metadata: {
          name: "external-dns-viewer",
          namespace: this.namespace.metadata.name,
        },
        roleRef: {
          apiGroup: "rbac.authorization.k8s.io",
          kind: "ClusterRole",
          name: this.clusterRole.metadata.name,
        },
        subjects: [
          {
            kind: "ServiceAccount",
            name: this.serviceAccount.metadata.name,
            namespace: this.namespace.metadata.name,
          },
        ],
      },
      { parent: this },
    );

    const appLabels = { app: "external-dns" };
    this.deployment = new k8s.apps.v1.Deployment(
      "external-dns",
      {
        metadata: {
          name: "external-dns",
          namespace: this.namespace.metadata.name,
        },
        spec: {
          strategy: {
            type: "Recreate",
          },
          selector: {
            matchLabels: appLabels,
          },
          template: {
            metadata: {
              labels: appLabels,
            },
            spec: {
              serviceAccountName: this.serviceAccount.metadata.name,
              containers: [
                {
                  name: "external-dns",
                  image: "registry.k8s.io/external-dns/external-dns:v0.14.2",
                  args: [
                    "--source=service",
                    "--source=ingress",
                    // TODO: do we need this?
                    // "--source=traefik-proxy",
                    "--registry=noop",
                    "--policy=upsert-only",
                    "--provider=pihole",
                    "--pihole-server=http://pihole-web.pihole.svc.cluster.local",
                    // TODO: update this with the pihole password (autogenerated)
                    "--pihole-password=abc",
                  ],
                },
              ],
              securityContext: {
                fsGroup: 65534,
              },
            },
          },
        },
      },
      { parent: this },
    );

    this.registerOutputs();
  }
}
