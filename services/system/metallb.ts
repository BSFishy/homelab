import * as k8s from "@pulumi/kubernetes";

const namespace = new k8s.core.v1.Namespace("metallb", {
  metadata: {
    name: "metallb",
  },
});

const chart = new k8s.helm.v3.Chart("metallb", {
  chart: "metallb",
  namespace: namespace.metadata.name,
  fetchOpts: {
    repo: "https://metallb.github.io/metallb",
  },
});

const addressPool = new k8s.apiextensions.CustomResource(
  "metallb",
  {
    apiVersion: "metallb.io/v1beta1",
    kind: "IPAddressPool",
    metadata: {
      name: "metallb",
      namespace: namespace.metadata.name,
    },
    spec: {
      addresses: ["192.168.1.10-192.168.1.250"],
    },
  },
  { dependsOn: chart.ready },
);

const l2Advertisement = new k8s.apiextensions.CustomResource(
  "metallb",
  {
    apiVersion: "metallb.io/v1beta1",
    kind: "L2Advertisement",
    metadata: {
      name: "metallb",
      namespace: namespace.metadata.name,
    },
  },
  { dependsOn: chart.ready },
);

// TODO: do something with the output
export let output = {
  addresses: addressPool.getInputs().spec.addresses.join(", "),
};
