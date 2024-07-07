import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { ready } from "../util";

export class KubeVipCloudProvider extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly serviceAccount: k8s.core.v1.ServiceAccount;
  public readonly clusterRole: k8s.rbac.v1.ClusterRole;
  public readonly clusterRoleBinding: k8s.rbac.v1.ClusterRoleBinding;
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly configMap: k8s.core.v1.ConfigMap;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:system:kube-vip-cloud-provider", name, {}, opts);

    this.namespace = new k8s.core.v1.Namespace(
      "kube-vip-cloud-provider-namespace",
      {
        metadata: {
          name: "kube-vip-cloud-provider",
        },
      },
      { parent: this },
    );

    this.serviceAccount = new k8s.core.v1.ServiceAccount(
      "kube-vip-cloud-provider-service-account",
      {
        metadata: {
          name: "kube-vip-cloud-controller",
          namespace: this.namespace.metadata.name,
        },
      },
      { parent: this },
    );

    this.clusterRole = new k8s.rbac.v1.ClusterRole(
      "kube-vip-cloud-provider-cluster-role",
      {
        metadata: {
          name: "system:kube-vip-cloud-controller-role",
          namespace: this.namespace.metadata.name,
          annotations: {
            "rbac.authorization.kubernetes.io/autoupdate": "true",
          },
        },
        rules: [
          {
            apiGroups: ["coordination.k8s.io"],
            resources: ["leases"],
            verbs: ["get", "create", "update", "list", "put"],
          },
          {
            apiGroups: [""],
            resources: [
              "configmaps",
              "endpoints",
              "events",
              "services/status",
              "leases",
            ],
            verbs: ["*"],
          },
          {
            apiGroups: [""],
            resources: ["nodes", "services"],
            verbs: ["list", "get", "watch", "update"],
          },
        ],
      },
      { parent: this },
    );

    this.clusterRoleBinding = new k8s.rbac.v1.ClusterRoleBinding(
      "kube-vip-cloud-provider-cluster-role-binding",
      {
        metadata: {
          name: "system:kube-vip-cloud-controller-binding",
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

    const appLabels = { app: "kube-vip", component: "kube-vip-cloud-provider" };
    this.deployment = new k8s.apps.v1.Deployment(
      "kube-vip-cloud-provider-deployment",
      {
        metadata: {
          name: "kube-vip-cloud-provider",
          namespace: this.namespace.metadata.name,
        },
        spec: {
          replicas: 1,
          revisionHistoryLimit: 10,
          selector: {
            matchLabels: appLabels,
          },
          strategy: {
            rollingUpdate: {
              maxSurge: "25%",
              maxUnavailable: "25%",
            },
            type: "RollingUpdate",
          },
          template: {
            metadata: {
              labels: appLabels,
            },
            spec: {
              containers: [
                {
                  command: [
                    "/kube-vip-cloud-provider",
                    "--leader-elect-resource-name=kube-vip-cloud-controller",
                  ],
                  image: "ghcr.io/kube-vip/kube-vip-cloud-provider:v0.0.10",
                  name: "kube-vip-cloud-provider",
                  imagePullPolicy: "Always",
                },
              ],
              dnsPolicy: "ClusterFirst",
              restartPolicy: "Always",
              terminationGracePeriodSeconds: 30,
              serviceAccountName: this.serviceAccount.metadata.name,
              tolerations: [
                { key: "node-role.kubernetes.io/master", effect: "NoSchedule" },
                {
                  key: "node-role.kubernetes.io/control-plane",
                  effect: "NoSchedule",
                },
              ],
              affinity: {
                nodeAffinity: {
                  preferredDuringSchedulingIgnoredDuringExecution: [
                    {
                      weight: 10,
                      preference: {
                        matchExpressions: [
                          {
                            key: "node-role.kubernetes.io/control-plane",
                            operator: "Exists",
                          },
                        ],
                      },
                    },
                    {
                      weight: 10,
                      preference: {
                        matchExpressions: [
                          {
                            key: "node-role.kubernetes.io/master",
                            operator: "Exists",
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      { parent: this, dependsOn: [this.clusterRoleBinding] },
    );

    this.configMap = new k8s.core.v1.ConfigMap(
      "kube-vip-config-map",
      {
        metadata: { name: "kubevip", namespace: "kube-system" },
        data: {
          "cidr-global": "192.168.1.0/24",
        },
      },
      { parent: this },
    );

    this.ready = ready([
      this.namespace,
      this.serviceAccount,
      this.clusterRole,
      this.clusterRoleBinding,
      this.deployment,
      this.configMap,
    ]);

    this.registerOutputs();
  }
}
