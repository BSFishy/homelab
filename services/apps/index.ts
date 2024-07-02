import * as pulumi from "@pulumi/pulumi";
import { Glance } from "./glance";

export class Applications extends pulumi.ComponentResource {
  public readonly glance: Glance;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:component:applications", name, {}, opts);

    this.glance = new Glance("glance", { parent: this });

    this.registerOutputs();
  }
}
