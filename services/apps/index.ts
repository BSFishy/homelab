import * as pulumi from "@pulumi/pulumi";
import { Glance } from "./glance";
import { ready } from "../util";

export class Applications extends pulumi.ComponentResource {
  public readonly glance: Glance;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:component:applications", name, {}, opts);

    this.glance = new Glance("glance", { parent: this });

    this.ready = ready([this.glance.ready]);

    this.registerOutputs();
  }
}
