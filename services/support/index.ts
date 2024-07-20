import * as pulumi from "@pulumi/pulumi";
import { OpenLdap } from "./open_ldap";
import { ready } from "../util";

export class Support extends pulumi.ComponentResource {
  public readonly open_ldap: OpenLdap;

  public readonly ready: pulumi.Output<Array<pulumi.Resource>>;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:component:support", name, {}, opts);

    this.open_ldap = new OpenLdap("open-ldap", { parent: this });

    this.ready = ready([this.open_ldap.ready]);

    this.registerOutputs();
  }
}
