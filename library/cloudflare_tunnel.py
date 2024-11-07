#!/usr/bin/python

from ansible.module_utils.basic import AnsibleModule
import requests
from cloudflare import Cloudflare

def main():
    module_args = dict(
        api_key=dict(type='str', required=True, no_log=True),
        api_email=dict(type='str', required=True, no_log=True),
        account_id=dict(type='str', required=True),
        tunnel_secret=dict(type='str', required=True, no_log=True),
        name=dict(type='str', required=True),
        state=dict(type='str', default='present', choices=['present', 'absent'])
    )

    module = AnsibleModule(
        argument_spec=module_args,
        supports_check_mode=True
    )

    api_key = module.params['api_key']
    api_email = module.params['api_email']
    account_id = module.params['account_id']
    tunnel_secret = module.params['tunnel_secret']
    name = module.params['name']
    state = module.params['state']

    client = Cloudflare(
        api_key=api_key,
        api_email=api_email,
    )

    tunnels = client.zero_trust.tunnels.list(account_id=account_id)
    tunnel = None
    for tun in tunnels:
        if tun.deleted_at is None and tun.name == name:
            tunnel = tun

    if state == 'present':
        result = dict()
        if tunnel is None:
            tunnel = client.zero_trust.tunnels.create(account_id=account_id, name=name, tunnel_secret=tunnel_secret)

            result['changed'] = True
            result['msg'] = 'Tunnel was created'
            module.exit_json(changed=True, msg='Tunnel was created')
        else:
            result['changed'] = False
            result['msg'] = 'Tunnel already existed'

        token = client.zero_trust.tunnels.token.get(tunnel.id, account_id=account_id)
        # module.fail_json(msg=f"token: {token}")
        result["tunnel_id"] = tunnel.id
        result["tunnel_token"] = token
        module.exit_json(**result)
    else:
        if tunnel is None:
            module.exit_json(changed=False, msg='Tunnel does not exist')
        else:
            client.zero_trust.tunnels.delete(tunnel.id, account_id=account_id)

            module.exit_json(changed=True, msg='Tunnel was deleted')

if __name__ == '__main__':
    main()
