import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export class KubeVip extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly serviceAccount: k8s.core.v1.ServiceAccount;
  public readonly clusterRole: k8s.rbac.v1.ClusterRole;
  public readonly clusterRoleBinding: k8s.rbac.v1.ClusterRoleBinding;
  public readonly daemonSet: k8s.apps.v1.DaemonSet;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:system:kube-vip", name, {}, opts);

    this.namespace = new k8s.core.v1.Namespace(
      "kube-vip-namespace",
      {
        metadata: {
          name: "kube-vip",
        },
      },
      { parent: this },
    );

    this.serviceAccount = new k8s.core.v1.ServiceAccount(
      "kube-vip-service-account",
      {
        metadata: {
          name: "kube-vip",
          namespace: this.namespace.metadata.name,
        },
      },
      { parent: this },
    );

    this.clusterRole = new k8s.rbac.v1.ClusterRole(
      "kube-vip-cluster-role",
      {
        metadata: {
          name: "system:kube-vip-role",
          namespace: this.namespace.metadata.name,
          annotations: {
            "rbac.authorization.kubernetes.io/autoupdate": "true",
          },
        },
        rules: [
          {
            apiGroups: [""],
            resources: ["services/status"],
            verbs: ["update"],
          },
          {
            apiGroups: [""],
            resources: ["services", "endpoints"],
            verbs: ["list", "get", "watch", "update"],
          },
          {
            apiGroups: [""],
            resources: ["nodes"],
            verbs: ["list", "get", "watch", "update", "patch"],
          },
          {
            apiGroups: ["coordination.k8s.io"],
            resources: ["leases"],
            verbs: ["list", "get", "watch", "update", "create"],
          },
          {
            apiGroups: ["discovery.k8s.io"],
            resources: ["endpointslices"],
            verbs: ["list", "get", "watch", "update"],
          },
        ],
      },
      { parent: this },
    );

    this.clusterRoleBinding = new k8s.rbac.v1.ClusterRoleBinding(
      "kube-vip-cluster-role-binding",
      {
        metadata: {
          name: "system:kube-vip-binding",
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

    const appLabels = { name: "kube-vip-ds" };
    this.daemonSet = new k8s.apps.v1.DaemonSet(
      "kube-vip-daemon-set",
      {
        metadata: {
          name: "kube-vip-ds",
          namespace: this.namespace.metadata.name,
        },
        spec: {
          selector: {
            matchLabels: appLabels,
          },
          template: {
            metadata: {
              labels: appLabels,
            },
            spec: {
              affinity: {
                nodeAffinity: {
                  requiredDuringSchedulingIgnoredDuringExecution: {
                    nodeSelectorTerms: [
                      {
                        matchExpressions: [
                          {
                            key: "node-role.kubernetes.io/master",
                            operator: "Exists",
                          },
                        ],
                      },
                      {
                        matchExpressions: [
                          {
                            key: "node-role.kubernetes.io/control-plane",
                            operator: "Exists",
                          },
                        ],
                      },
                    ],
                  },
                },
              },
              containers: [
                {
                  args: ["manager"],
                  env: [
                    { name: "vip_arp", value: "true" },
                    { name: "port", value: "6443" },
                    // TODO: make this configuration
                    { name: "vip_interface", value: "wlp0s20f3" },
                    { name: "vip_cidr", value: "32" },
                    { name: "cp_enable", value: "true" },
                    {
                      name: "cp_namespace",
                      value: this.namespace.metadata.name,
                    },
                    { name: "vip_ddns", value: "false" },
                    { name: "svc_enable", value: "true" },
                    { name: "vip_leaderelection", value: "true" },
                    { name: "vip_leaseduration", value: "5" },
                    { name: "vip_renewdeadline", value: "3" },
                    { name: "vip_retryperiod", value: "1" },
                    // TODO: make this configuration
                    { name: "address", value: "192.168.1.14" },
                  ],
                  image: "ghcr.io/kube-vip/kube-vip:v0.4.0",
                  imagePullPolicy: "Always",
                  // TODO: should this be something else?
                  name: "kube-vip",
                  resources: {},
                  securityContext: {
                    capabilities: {
                      add: ["NET_ADMIN", "NET_RAW", "SYS_TIME"],
                    },
                  },
                },
              ],
              hostNetwork: true,
              serviceAccountName: this.serviceAccount.metadata.name,
              tolerations: [
                { effect: "NoSchedule", operator: "Exists" },
                { effect: "NoExecute", operator: "Exists" },
              ],
            },
          },
          updateStrategy: {},
        },
      },
      { parent: this, dependsOn: [this.clusterRoleBinding] },
    );

    this.ready = pulumi
      .all([
        this.namespace,
        this.serviceAccount,
        this.clusterRole,
        this.clusterRoleBinding,
        this.daemonSet,
      ])
      .apply((ready) => ready.flat());

    this.registerOutputs();
  }
}
