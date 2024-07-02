import * as k8s from "@pulumi/kubernetes";
import { chart as piholeChart } from "./pihole";
import { chart as traefikChart } from "./traefik";

const namespace = new k8s.core.v1.Namespace("external-dns", {
  metadata: {
    name: "external-dns",
  },
});

const serviceAccount = new k8s.core.v1.ServiceAccount("external-dns", {
  metadata: {
    name: "external-dns",
    namespace: namespace.metadata.name,
  },
});

const clusterRole = new k8s.rbac.v1.ClusterRole("external-dns", {
  metadata: {
    name: "external-dns",
    namespace: namespace.metadata.name,
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
});

const roleBinding = new k8s.rbac.v1.ClusterRoleBinding("external-dns", {
  metadata: {
    name: "external-dns-viewer",
    namespace: namespace.metadata.name,
  },
  roleRef: {
    apiGroup: "rbac.authorization.k8s.io",
    kind: "ClusterRole",
    name: clusterRole.metadata.name,
  },
  subjects: [
    {
      kind: "ServiceAccount",
      name: serviceAccount.metadata.name,
      namespace: namespace.metadata.name,
    },
  ],
});

const appLabels = { app: "external-dns" };
const deployment = new k8s.apps.v1.Deployment(
  "external-dns",
  {
    metadata: {
      name: "external-dns",
      namespace: namespace.metadata.name,
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
          serviceAccountName: serviceAccount.metadata.name,
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
  { dependsOn: piholeChart.ready },
);

// TODO: do something with the output
export let output = {};