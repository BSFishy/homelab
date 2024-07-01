import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const traefik = new k8s.helm.v3.Chart("traefik", {
  chart: "traefik",
  fetchOpts: {
    repo: "https://traefik.github.io/charts",
  },
  values: {
    service: {
      // Type must be ClusterIP instead of LoadBalancer on k3s
      type: "ClusterIP",
    },
    ingressRoute: { dashboard: { entryPoints: ["web", "websecure"] } },
  },
});

export let clusterIp = traefik.getResourceProperty(
  "v1/Service",
  "default",
  "traefik",
  "spec",
).clusterIP;
