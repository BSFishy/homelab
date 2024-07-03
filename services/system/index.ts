import * as pulumi from "@pulumi/pulumi";
import { ExternalDns } from "./external_dns";
import { Metallb } from "./metallb";
import { PiHole } from "./pihole";
import { Traefik } from "./traefik";

export class System extends pulumi.ComponentResource {
  public readonly external_dns: ExternalDns;
  public readonly metallb: Metallb;
  public readonly pihole: PiHole;
  public readonly traefik: Traefik;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:component:system", name, {}, opts);

    this.metallb = new Metallb("metallb", { parent: this });

    this.traefik = new Traefik("traefik", {
      parent: this,
      dependsOn: [this.metallb],
    });

    this.pihole = new PiHole("pihole", {
      parent: this,
      dependsOn: [this.metallb],
    });

    this.external_dns = new ExternalDns("external_dns", {
      parent: this,
      dependsOn: [this.metallb, this.pihole],
    });

    this.registerOutputs();
  }
}
