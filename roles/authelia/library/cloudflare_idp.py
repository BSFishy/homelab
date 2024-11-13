#!/usr/bin/python

from ansible.module_utils.basic import AnsibleModule
from cloudflare import Cloudflare


def main():
    module_args = dict(
        api_key=dict(type="str", required=True, no_log=True),
        api_email=dict(type="str", required=True, no_log=True),
        account_id=dict(type="str", required=True),
        client_secret=dict(type="str", required=True, no_log=True),
        name=dict(type="str", required=True),
        state=dict(type="str", default="present", choices=["present", "absent"]),
    )

    module = AnsibleModule(argument_spec=module_args, supports_check_mode=True)

    api_key = module.params["api_key"]
    api_email = module.params["api_email"]
    account_id = module.params["account_id"]
    client_secret = module.params["client_secret"]
    name = module.params["name"]
    state = module.params["state"]

    client = Cloudflare(
        api_key=api_key,
        api_email=api_email,
    )

    idps = client.zero_trust.identity_providers.list(
        account_id=account_id,
    )
    idp = None
    for i in idps:
        if i.name == name:
            idp = i

    if state == "present":
        result = dict()
        if idp is None:
            idp = client.zero_trust.identity_providers.create(
                account_id=account_id,
                name=name,
                type="oidc",
                config=dict(
                    client_id="cloudflare",
                    client_secret=client_secret,
                    auth_url="https://auth.home.mattprovost.dev/api/oidc/authorization",
                    token_url="https://auth.home.mattprovost.dev/api/oidc/token",
                    certs_url="https://auth.home.mattprovost.dev/jwks.json",
                    claims=["preferred_username", "mail"],
                ),
            )

            result["changed"] = True
            result["msg"] = "Tunnel was created"
        else:
            result["changed"] = False
            result["msg"] = "Tunnel already existed"

        result["idp_id"] = idp.id
        module.exit_json(**result)
    else:
        if idp is None:
            module.exit_json(changed=False, msg="Tunnel does not exist")
        else:
            client.zero_trust.identity_providers.delete(
                idp.id,
                account_id=account_id,
            )

            module.exit_json(changed=True, msg="Tunnel was deleted")


if __name__ == "__main__":
    main()