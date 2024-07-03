import { Applications, System } from "./services";

const system = new System("system");

const applications = new Applications("applications", { dependsOn: system });

export const metallbAddresses =
  system.metallb.addressPool.getInputs().spec.addresses;

const piholeChart = system.pihole.chart;
export const piholeWebIps = piholeChart.ready.apply(() =>
  piholeChart
    .getResourceProperty("v1/Service", "pihole", "pihole-web", "status")
    .apply((status) =>
      status.loadBalancer.ingress.map((ingress) => ingress.ip),
    ),
);
export const piholeDnsIps = piholeChart.ready.apply(() =>
  piholeChart
    .getResourceProperty("v1/Service", "pihole", "pihole-dns-udp", "status")
    .apply((status) =>
      status.loadBalancer.ingress.map((ingress) => ingress.ip),
    ),
);

export const traefikIps = system.traefik.chart
  .getResourceProperty("v1/Service", "traefik", "traefik", "status")
  .apply((status) => status.loadBalancer.ingress.map((ingress) => ingress.ip));

export const glanceIps =
  applications.glance.service.status.loadBalancer.ingress.apply((ingress) =>
    ingress.map((ingress) => ingress.ip),
  );
