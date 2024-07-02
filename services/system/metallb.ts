import * as k8s from "@pulumi/kubernetes";
import { metallb } from "../crds";

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

const addressPool = new metallb.v1beta1.IPAddressPool(
  "metallb",
  {
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

const l2Advertisement = new metallb.v1beta1.L2Advertisement(
  "metallb",
  {
    metadata: {
      name: "metallb",
      namespace: namespace.metadata.name,
    },
  },
  { dependsOn: chart.ready },
);

// TODO: do something with the output
export let output = {
  addresses: addressPool.spec.addresses.apply((addresses) =>
    addresses.join(", "),
  ),
  status: l2Advertisement.status,
};
