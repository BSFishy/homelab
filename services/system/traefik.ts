import * as k8s from "@pulumi/kubernetes";

const namespace = new k8s.core.v1.Namespace("traefik", {
  metadata: {
    name: "traefik",
  },
});

const traefik = new k8s.helm.v3.Chart("traefik", {
  chart: "traefik",
  namespace: namespace.metadata.name,
  fetchOpts: {
    repo: "https://traefik.github.io/charts",
  },
  values: {
    service: {
      // Type must be ClusterIP instead of LoadBalancer on k3s
      type: "ClusterIP",
    },
    ingressRoute: {
      dashboard: {
        // TODO: make custom hostname work with external-dns
        annotations: {
          "external-dns.alpha.kubernetes.io/hostname": "traefik.home",
        },
        matchRule:
          "Host(`traefik.home`) && (PathPrefix(`/dashboard`) || PathPrefix(`/api`))",
        entryPoints: ["web", "websecure"],
      },
    },
  },
});

export let output = {
  ip: traefik.getResourceProperty("v1/Service", "traefik", "traefik", "spec")
    .clusterIP,
  namespace: namespace.metadata.name,
};
