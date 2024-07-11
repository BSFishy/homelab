import { Applications, System } from "./services";
import { CONFIG } from "./services/config";

const system = new System("system");

const applications = new Applications("applications", {
  dependsOn: system.ready,
});

export const cloudflareAccount = applications.ready.apply(
  () => CONFIG.account.name,
);
export const cloudflareDomain = applications.ready.apply(
  () => CONFIG.domain.name,
);
