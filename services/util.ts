import * as pulumi from "@pulumi/pulumi";

export function ready(
  resources: Array<
    pulumi.Input<pulumi.Resource> | pulumi.Input<pulumi.Resource[]> | undefined
  >,
) {
  return pulumi
    .all(resources.filter(Boolean))
    .apply((ready) => ready.flat()) as pulumi.Output<Array<pulumi.Resource>>;
}
