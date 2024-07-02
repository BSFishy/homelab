import { Applications } from "./services";
export { system } from "./services";

const applications = new Applications("applications");

export const glanceIps =
  applications.glance.service.status.loadBalancer.ingress.apply((ingress) =>
    ingress.map((ingress) => ingress.ip),
  );
