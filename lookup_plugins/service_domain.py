from ansible.plugins.lookup import LookupBase


class LookupModule(LookupBase):
    def run(self, terms, variables=None, **kwargs):
        service_name = terms[0]
        base_domain = variables.get("base_domain")
        if not base_domain:
            raise ValueError("The 'base_domain' variable is required.")
        return [f"{service_name}.{base_domain}"]
