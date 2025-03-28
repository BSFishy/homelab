package main

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/cloudflare/cloudflare-go"
	"github.com/pkg/errors"
	"github.com/samber/lo"
)

type ServiceConfig struct {
	Domain       string
	Protocol     string
	Port         uint32
	Access       bool
	AccessAdmin  bool
	CustomAccess bool
}

type Service struct {
	Name string
	// the name of the service in docker
	DockerService string
	Config        ServiceConfig
}

func NewService(serviceName string, domainInfo DomainInfo) Service {
	return Service{
		Name:          fmt.Sprintf("%s (%s)", domainInfo.Name, instance_name),
		DockerService: serviceName,
		Config: ServiceConfig{
			Domain:       domainInfo.Domain,
			Protocol:     domainInfo.Protocol,
			Port:         domainInfo.Port,
			Access:       domainInfo.Access,
			AccessAdmin:  domainInfo.AccessAdmin,
			CustomAccess: domainInfo.CustomAccess,
		},
	}
}

func (s *Service) Sync(ctx context.Context, api *cloudflare.API) (*cloudflare.UnvalidatedIngressRule, error) {
	if err := s.syncDnsRecord(ctx, api); err != nil {
		return nil, errors.Wrapf(err, "failed to sync dns records for %s", s.Name)
	}

	access, err := s.syncAccessApp(ctx, api)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to sync access app for %s", s.Name)
	}

	return &cloudflare.UnvalidatedIngressRule{
		Hostname: s.Config.Domain,
		Service:  s.ServiceUrl(),
		OriginRequest: lo.Ternary(access != nil, &cloudflare.OriginRequestConfig{
			Access: access,
		}, nil),
	}, nil
}

func (s *Service) syncDnsRecord(ctx context.Context, api *cloudflare.API) error {
	record := GetDNSRecord(ctx, s.Config.Domain)
	content := fmt.Sprintf("%s.cfargotunnel.com", tunnel_id)
	if record == nil {
		_, err := api.CreateDNSRecord(ctx, zone, cloudflare.CreateDNSRecordParams{
			Name:    s.Config.Domain,
			Content: content,
			Type:    "CNAME",
			Proxied: lo.ToPtr(true),
			Comment: "[AUTOGENERATED] homelab service",
		})
		if err != nil {
			return errors.Wrapf(err, "failed to create dns record %s", s.Config.Domain)
		}
	} else if record.Content != content || record.Type != "CNAME" || !*record.Proxied {
		_, err := api.UpdateDNSRecord(ctx, zone, cloudflare.UpdateDNSRecordParams{
			ID:      record.ID,
			Name:    s.Config.Domain,
			Content: content,
			Type:    "CNAME",
			Proxied: lo.ToPtr(true),
			Comment: lo.ToPtr("[AUTOGENERATED] homelab service"),
		})
		if err != nil {
			return errors.Wrapf(err, "failed to update dns record %s", s.Config.Domain)
		}
	}

	return nil
}

func (s *Service) syncAccessApp(ctx context.Context, api *cloudflare.API) (*cloudflare.AccessConfig, error) {
	if !s.Config.Access {
		return nil, nil
	}

	app := GetAccessApplication(ctx, s.Name)

	allowedIdps := []string{idp_id}
	autoRedirect := lo.ToPtr(true)
	if s.Config.CustomAccess {
		allowedIdps = []string{}
		autoRedirect = nil
	}

	if app == nil {
		application, err := api.CreateAccessApplication(ctx, account, cloudflare.CreateAccessApplicationParams{
			AllowAuthenticateViaWarp: lo.ToPtr(true),
			AllowedIdps:              allowedIdps,
			AutoRedirectToIdentity:   autoRedirect,
			Domain:                   s.Config.Domain,
			Name:                     s.Name,
			Type:                     cloudflare.SelfHosted,
			SkipInterstitial:         lo.ToPtr(true),
		})
		if err != nil {
			return nil, errors.Wrapf(err, "failed to create access application")
		}

		app = &application
	} else if !*app.AllowAuthenticateViaWarp || slices.Compare(app.AllowedIdps, allowedIdps) != 0 || app.AutoRedirectToIdentity != autoRedirect || app.Domain != s.Config.Domain || app.Type != cloudflare.SelfHosted || !*app.SkipInterstitial {
		application, err := api.UpdateAccessApplication(ctx, account, cloudflare.UpdateAccessApplicationParams{
			ID:                       app.ID,
			AllowAuthenticateViaWarp: lo.ToPtr(true),
			AllowedIdps:              allowedIdps,
			AutoRedirectToIdentity:   autoRedirect,
			Domain:                   s.Config.Domain,
			Name:                     s.Name,
			Type:                     cloudflare.SelfHosted,
			SkipInterstitial:         lo.ToPtr(true),
		})
		if err != nil {
			return nil, errors.Wrapf(err, "failed to update access application")
		}

		app = &application
	}

	if err := s.syncAccessPolicy(ctx, api, app); err != nil {
		return nil, errors.Wrapf(err, "failed to sync access policy")
	}

	return &cloudflare.AccessConfig{
		Required: true,
		// TODO: make this configurable
		TeamName: "mattprovost",
		AudTag:   []string{app.AUD},
	}, nil
}

const everyonePolicyName = "Allow everyone"

func (s *Service) syncAccessPolicy(ctx context.Context, api *cloudflare.API, app *cloudflare.AccessApplication) error {
	if len(app.Policies) == 1 && s.compareRule(app.Policies[0]) {
		return nil
	}

	policies, _, err := api.ListAccessPolicies(ctx, account, cloudflare.ListAccessPoliciesParams{
		ApplicationID: app.ID,
	})
	if err != nil {
		return errors.Wrapf(err, "failed to list policies for app %s", app.Name)
	}

	var policy *cloudflare.AccessPolicy
	for _, p := range policies {
		if s.compareRule(p) {
			policy = &p
			break
		}
	}

	if policy == nil {
		p, err := api.CreateAccessPolicy(ctx, account, cloudflare.CreateAccessPolicyParams{
			ApplicationID: app.ID,
			Name:          s.policyName(),
			Decision:      "allow",
			Include:       []interface{}{s.policyRule()},
		})
		if err != nil {
			return errors.Wrapf(err, "failed to create policy %s", s.policyName())
		}

		policy = &p
	}

	allowedIdps := []string{idp_id}
	autoRedirect := lo.ToPtr(true)
	if s.Config.CustomAccess {
		allowedIdps = []string{}
		autoRedirect = nil
	}

	_, err = api.UpdateAccessApplication(ctx, account, cloudflare.UpdateAccessApplicationParams{
		ID:                       app.ID,
		AllowAuthenticateViaWarp: lo.ToPtr(true),
		AllowedIdps:              allowedIdps,
		AutoRedirectToIdentity:   autoRedirect,
		Domain:                   s.Config.Domain,
		Name:                     s.Name,
		Type:                     cloudflare.SelfHosted,
		SkipInterstitial:         lo.ToPtr(true),
		Policies:                 &[]string{policy.ID},
	})
	if err != nil {
		return errors.Wrapf(err, "failed to update application with policy %s", policy.Name)
	}

	return nil
}

func (s *Service) compareRule(policy cloudflare.AccessPolicy) bool {
	if cmp := strings.Compare(policy.Name, s.policyName()); cmp != 0 {
		return false
	}

	if cmp := len(policy.Include) - 1; cmp != 0 {
		return false
	}

	rule := policy.Include[0]
	if s.Config.CustomAccess {
		group, ok := rule.(cloudflare.AccessGroupAccessGroup)
		if !ok {
			return false
		}

		if group.Group.ID != group_id {
			return false
		}
	} else {
		if !s.Config.AccessAdmin {
			_, ok := rule.(cloudflare.AccessGroupEveryone)
			if !ok {
				return false
			}
		} else {
			oidc, ok := rule.(AccessGroupOIDC)
			if !ok || oidc.OIDC.IdentityProviderId != idp_id || oidc.OIDC.ClaimName != "groups" || oidc.OIDC.ClaimValue != "admins" {
				return false
			}
		}
	}

	return true
}

func (s *Service) policyName() string {
	if s.Config.CustomAccess {
		return "Allow group"
	}

	if s.Config.AccessAdmin {
		return "Allow admins"
	}

	return "Allow everyone"
}

func (s *Service) policyRule() interface{} {
	if s.Config.CustomAccess {
		return cloudflare.AccessGroupAccessGroup{
			Group: struct {
				ID string `json:"id"`
			}{
				ID: group_id,
			},
		}
	}

	if s.Config.AccessAdmin {
		return AccessGroupOIDC{
			OIDC: AccessGroupOIDCConfig{
				IdentityProviderId: idp_id,
				ClaimName:          "groups",
				ClaimValue:         "admins",
			},
		}
	}

	return cloudflare.AccessGroupEveryone{
		Everyone: struct{}{},
	}
}

func (s *Service) ServiceUrl() string {
	return fmt.Sprintf("%s://%s:%d", s.Config.Protocol, s.DockerService, s.Config.Port)
}

type AccessGroupOIDC struct {
	OIDC AccessGroupOIDCConfig `json:"oidc"`
}

type AccessGroupOIDCConfig struct {
	IdentityProviderId string `json:"identity_provider_id"`
	ClaimName          string `json:"claim_name"`
	ClaimValue         string `json:"claim_value"`
}
