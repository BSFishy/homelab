import * as k8s from "@pulumi/kubernetes";

const namespace = new k8s.core.v1.Namespace("coredns", {
  metadata: {
    name: "coredns",
  },
});

const coredns = new k8s.helm.v3.Chart("coredns", {
  chart: "coredns",
  namespace: namespace.metadata.name,
  fetchOpts: {
    repo: "https://coredns.github.io/helm",
  },
  values: {
    // Run as an external DNS provider
    isClusterService: false,
    serviceType: "NodePort",
    servers: [
      {
        zones: [
          {
            zone: ".",
          },
        ],
        port: 53,
        hostPort: 53,
        plugins: [
          { name: "errors" },
          { name: "health", configBlock: "lameduck 5s" },
          { name: "ready" },
          {
            name: "kubernetes",
            parameters: "cluster.local in-addr.arpa ip6.arpa",
            configBlock: `pods insecure
fallthrough in-addr.arpa ip6.arpa
ttl 30`,
          },
          {
            name: "hosts",
            configBlock: `glance.local 10.43.81.163
fallthrough`,
          },
          { name: "prometheus", parameters: "0.0.0.0:9153" },
          { name: "forward", parameters: ". /etc/resolv.conf" },
          { name: "cache", parameters: "30" },
          { name: "loop" },
          { name: "reload" },
          { name: "loadbalance" },
        ],
      },
      //       {
      //         zones: [
      //           {
      //             zone: "local",
      //           },
      //         ],
      //         port: 53,
      //         plugins: [
      //           { name: "errors" },
      //           { name: "health", configBlock: "lameduck 5s" },
      //           { name: "ready" },
      //           {
      //             name: "kubernetes",
      //             parameters: "cluster.local in-addr.arpa ip6.arpa",
      //             configBlock: `pods insecure
      // fallthrough in-addr.arpa ip6.arpa
      // ttl 30`,
      //           },
      //           { name: "prometheus", parameters: "0.0.0.0:9153" },
      //           { name: "forward", parameters: ". /etc/resolv.conf" },
      //           { name: "cache", parameters: "30" },
      //           { name: "loop" },
      //           { name: "reload" },
      //           { name: "loadbalance" },
      //         ],
      //       },
    ],
  },
});

export let output = {
  ip: coredns.getResourceProperty("v1/Service", "coredns", "coredns", "spec"),
  namespace: namespace.metadata.name,
};
