// *** WARNING: this file was generated by crd2pulumi. ***
// *** Do not edit by hand unless you're certain you know what you are doing! ***

import * as pulumi from "@pulumi/pulumi";
import * as utilities from "../../utilities";

// Export members:
export { IPAddressPoolArgs } from "./ipaddressPool";
export type IPAddressPool = import("./ipaddressPool").IPAddressPool;
export const IPAddressPool: typeof import("./ipaddressPool").IPAddressPool = null as any;
utilities.lazyLoad(exports, ["IPAddressPool"], () => require("./ipaddressPool"));

export { L2AdvertisementArgs } from "./l2advertisement";
export type L2Advertisement = import("./l2advertisement").L2Advertisement;
export const L2Advertisement: typeof import("./l2advertisement").L2Advertisement = null as any;
utilities.lazyLoad(exports, ["L2Advertisement"], () => require("./l2advertisement"));


const _module = {
    version: utilities.getVersion(),
    construct: (name: string, type: string, urn: string): pulumi.Resource => {
        switch (type) {
            case "kubernetes:metallb.io/v1beta1:IPAddressPool":
                return new IPAddressPool(name, <any>undefined, { urn })
            case "kubernetes:metallb.io/v1beta1:L2Advertisement":
                return new L2Advertisement(name, <any>undefined, { urn })
            default:
                throw new Error(`unknown resource type ${type}`);
        }
    },
};
pulumi.runtime.registerResourceModule("crds", "metallb.io/v1beta1", _module)
