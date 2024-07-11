import * as pulumi from "@pulumi/pulumi";
import * as cf from "@pulumi/cloudflare";
import * as k8s from "@pulumi/kubernetes";
import { CONFIG, subdomain } from "../config";
import { ready } from "../util";

interface CertManagerArgs {
  traefikNamespace: pulumi.Input<string>;
}

export class CertManager extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly apiToken: cf.ApiToken;
  public readonly apiTokenSecret: k8s.core.v1.Secret;
  public readonly issuer: k8s.apiextensions.CustomResource;
  public readonly certificate: k8s.apiextensions.CustomResource;

  public readonly secretName: pulumi.Output<string>;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(
    name: string,
    args: CertManagerArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("homelab:system:cert-manager", name, {}, opts);

    this.namespace = new k8s.core.v1.Namespace(
      "cert-manager-namespace",
      { metadata: { name: "cert-manager" } },
      { parent: this },
    );

    this.chart = new k8s.helm.v3.Chart(
      "cert-manager-chart",
      {
        chart: "cert-manager",
        namespace: this.namespace.metadata.name,
        fetchOpts: {
          repo: "https://charts.jetstack.io",
        },
        values: {
          crds: {
            enabled: true,
          },
          startupapicheck: {
            enabled: false,
          },
        },
      },
      { parent: this },
    );

    const permissionGroups = cf.getApiTokenPermissionGroupsOutput();

    const editDnsPermission = permissionGroups.apply((permissionGroups) => {
      const perm = permissionGroups.zone["DNS Write"];
      if (!perm) {
        throw "failed to get zone dns write permission";
      }

      return perm;
    });

    const zoneReadPermission = permissionGroups.apply((permissionGroups) => {
      const perm = permissionGroups.zone["Zone Read"];
      if (!perm) {
        throw "failed to get zone zone read permission";
      }

      return perm;
    });

    this.apiToken = new cf.ApiToken(
      "cert-manager-cf-api-token",
      {
        name: "cert-manager",
        policies: [
          {
            effect: "allow",
            permissionGroups: [editDnsPermission, zoneReadPermission],
            resources: CONFIG.domain.apply((domain) => ({
              [`com.cloudflare.api.account.zone.${domain.id!}`]: "*",
            })),
          },
        ],
      },
      { parent: this },
    );

    const secretKey = "api-token";
    this.apiTokenSecret = new k8s.core.v1.Secret(
      "cert-manager-api-token-secret",
      {
        metadata: {
          name: "cloudflare-api-token-secret",
          namespace: args.traefikNamespace,
        },
        type: "Opaque",
        stringData: {
          [secretKey]: this.apiToken.value,
        },
      },
      { parent: this },
    );

    this.issuer = new k8s.apiextensions.CustomResource(
      "cert-manager-issuer",
      {
        apiVersion: "cert-manager.io/v1",
        kind: "Issuer",
        metadata: {
          name: "cloudflare",
          namespace: args.traefikNamespace,
        },
        spec: {
          acme: {
            server: "https://acme-v02.api.letsencrypt.org/directory",
            email: CONFIG.email,
            privateKeySecretRef: {
              name: "cloudflare-key",
            },
            solvers: [
              {
                dns01: {
                  cloudflare: {
                    apiTokenSecretRef: {
                      name: this.apiTokenSecret.metadata.name,
                      key: secretKey,
                    },
                  },
                },
              },
            ],
          },
        },
      },
      { parent: this, dependsOn: this.chart.ready },
    );

    this.secretName = pulumi.output("cert-manager-secret");
    this.certificate = new k8s.apiextensions.CustomResource(
      "cert-manager-certificate",
      {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
          name: "cert-manager-certificate",
          namespace: args.traefikNamespace,
        },
        spec: {
          secretName: this.secretName,
          dnsNames: [subdomain("*")],
          issuerRef: {
            name: this.issuer.metadata.name,
            kind: "Issuer",
          },
        },
      },
      { parent: this },
    );

    this.ready = ready([
      this.namespace,
      this.chart.ready,
      this.apiToken,
      this.apiTokenSecret,
      this.issuer,
      this.certificate,
    ]);

    this.registerOutputs();
  }
}
