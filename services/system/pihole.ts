import * as k8s from "@pulumi/kubernetes";

const namespace = new k8s.core.v1.Namespace("pihole", {
  metadata: {
    name: "pihole",
  },
});

const pihole = new k8s.helm.v3.Chart("pihole", {
  chart: "pihole",
  namespace: namespace.metadata.name,
  fetchOpts: {
    repo: "https://mojo2600.github.io/pihole-kubernetes/",
  },
  values: {
    adminPassword: "abc",
    dnsHostPort: {
      enabled: true,
    },
    serviceWeb: {
      type: "LoadBalancer",
    },
    serviceDns: {
      type: "LoadBalancer",
    },
    serviceDhcp: {
      enabled: false,
    },
    ingress: {
      enabled: true,
      hosts: ["pihole.home"],
    },
    podDnsConfig: {
      enabled: true,
      policy: "None",
      nameservers: ["127.0.0.1", "1.1.1.1", "1.0.0.1"],
    },
    doh: {
      enabled: true,
      pullPolicy: "Always",
    },
    envVars: {
      DOH_UPSTREAM: "https://1.1.1.1/dns-query",
    },
  },
});

export let output = {
  webIps: pihole.ready.apply(() =>
    pihole
      .getResourceProperty("v1/Service", "pihole", "pihole-web", "status")
      .apply((status) =>
        status.loadBalancer.ingress.map((ingress) => ingress.ip),
      ),
  ),
  dnsIps: pihole.ready.apply(() =>
    pihole
      .getResourceProperty("v1/Service", "pihole", "pihole-dns-udp", "status")
      .apply((status) =>
        status.loadBalancer.ingress.map((ingress) => ingress.ip),
      ),
  ),
  namespace: namespace.metadata.name,
};
