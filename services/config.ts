import * as pulumi from "@pulumi/pulumi";
import * as cf from "@pulumi/cloudflare";

export function getConfig() {
  const config = new pulumi.Config();

  const account = getAccount(config);

  const domain = getDomain(config, account.id as pulumi.Output<string>);
  const privateSubdomain = config.get("privateSubdomain") ?? "home";

  const useDhcp = config.getBoolean("useDhcp") ?? false;

  return { account, domain, privateSubdomain, useDhcp };
}

function getAccount(config: pulumi.Config) {
  const accounts = cf.getAccountsOutput().accounts;
  const accountNames = accounts.apply(
    (accounts) =>
      accounts.map((account) => account.name).filter(Boolean) as string[],
  );

  const selectedAccount = config.require("cfAccountName");
  accountNames.apply((accountNames) => {
    if (!accountNames.includes(selectedAccount)) {
      throw `invalid account ${selectedAccount}, must be in [${accountNames.join(", ")}]`;
    }
  });

  return accounts.apply(
    (accounts) => accounts.find((account) => account.name === selectedAccount)!,
  );
}

function getDomain(config: pulumi.Config, accountId: pulumi.Input<string>) {
  const zones = cf.getZonesOutput({
    filter: {
      accountId,
    },
  }).zones;
  const zoneNames = zones.apply(
    (zones) => zones.map((zone) => zone.name).filter(Boolean) as string[],
  );

  const selectedZone = config.require("domain");
  zoneNames.apply((zoneNames) => {
    if (!zoneNames.includes(selectedZone)) {
      throw `invalid domain ${selectedZone}, must be in [${zoneNames.join(", ")}]`;
    }
  });

  return zones.apply(
    (zones) => zones.find((zone) => zone.name === selectedZone)!,
  );
}

export const CONFIG = getConfig();

export function subdomain(name: string, priv: boolean = true) {
  const domain = CONFIG.domain;
  const subdomain = CONFIG.privateSubdomain;

  return domain.apply((domain) => {
    if (priv) {
      return `${name}.${subdomain}.${domain.name}`;
    } else {
      return `${name}.${domain.name}`;
    }
  });
}
