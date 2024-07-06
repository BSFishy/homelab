import { Applications, System } from "./services";

const system = new System("system");

const applications = new Applications("applications", {
  dependsOn: system.ready,
});
