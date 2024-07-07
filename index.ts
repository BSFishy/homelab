import { Applications, System } from "./services";
import { CONFIG } from "./services/config";

const system = new System("system");

const applications = new Applications("applications", {
  dependsOn: system.ready,
});

export const cloudflareAccount = CONFIG.account.name;
export const cloudflareDomain = CONFIG.domain.name;
