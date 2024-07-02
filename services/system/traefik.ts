import * as k8s from "@pulumi/kubernetes";

const namespace = new k8s.core.v1.Namespace("traefik", {
  metadata: {
    name: "traefik",
  },
});

const chart = new k8s.helm.v3.Chart("traefik", {
  chart: "traefik",
  namespace: namespace.metadata.name,
  fetchOpts: {
    repo: "https://traefik.github.io/charts",
  },
  values: {
    service: {
      // Type must be ClusterIP instead of LoadBalancer on k3s
      type: "LoadBalancer",
    },
    ingressRoute: {
      dashboard: {
        matchRule: "PathPrefix(`/dashboard`) || PathPrefix(`/api`)",
        entryPoints: ["web", "websecure"],
      },
    },
    providers: {
      kubernetesIngress: {
        publishedService: {
          enabled: true,
        },
      },
    },
  },
});

export let output = {
  ips: chart.ready.apply(() =>
    chart
      .getResourceProperty("v1/Service", "traefik", "traefik", "status")
      .apply((status) =>
        status.loadBalancer.ingress.map((ingress) => ingress.ip),
      ),
  ),
  namespace: namespace.metadata.name,
};
