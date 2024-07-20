import { Applications, Support, System } from "./services";
import { CONFIG } from "./services/config";

const system = new System("system");

const support = new Support("support", {
  dependsOn: system.ready,
});

const applications = new Applications("applications", {
  dependsOn: support.ready,
});

export const cloudflareAccount = applications.ready.apply(
  () => CONFIG.account.name,
);
export const cloudflareDomain = applications.ready.apply(
  () => CONFIG.domain.name,
);
