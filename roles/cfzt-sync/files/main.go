package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"slices"
	"syscall"
	"time"

	"github.com/cloudflare/cloudflare-go"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

var (
	zone      *cloudflare.ResourceContainer
	account   = cloudflare.AccountIdentifier(os.Getenv("CLOUDFLARE_ACCOUNT_ID"))
	tunnel_id = os.Getenv("CLOUDFLARE_TUNNEL_ID")
	group_id  = os.Getenv("CLOUDFLARE_GROUP_ID")
)

func main() {
	ctx := context.Background()

	done := make(chan os.Signal, 1)
	signal.Notify(done, syscall.SIGINT, syscall.SIGTERM)

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Fatalf("error creating Docker client: %v", err)
	}
	defer cli.Close()

	api, err := cloudflare.New(os.Getenv("CLOUDFLARE_API_KEY"), os.Getenv("CLOUDFLARE_API_EMAIL"))
	if err != nil {
		log.Fatal(err)
	}

	zone_id, err := api.ZoneIDByName(os.Getenv("CLOUDFLARE_ZONE"))
	if err != nil {
		log.Fatal(err)
	}

	zone = cloudflare.ZoneIdentifier(zone_id)

	debouncer := NewDebouncer(cli, api, 5*time.Second)
	debouncer.Trigger()

	messages, errs := cli.Events(ctx, events.ListOptions{})

	go func() {
		for {
			select {
			case event := <-messages:
				if event.Type == "service" {
					debouncer.Trigger()
				}
			case err := <-errs:
				fmt.Println("Error:", err)
			}
		}
	}()

	<-done
}

func getService(ctx context.Context, cli *client.Client, name string) (*swarm.Service, error) {
	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return nil, err
	}

	for _, service := range services {
		if service.Spec.Name == name {
			return &service, nil
		}
	}

	return nil, fmt.Errorf("no service named %s", name)
}

type ruleInfo struct {
	ingressRule *cloudflare.UnvalidatedIngressRule
	DomainInfo
}

func syncServices(cli *client.Client, api *cloudflare.API) error {
	ctx := context.Background()

	// get services as source of truth for configuration
	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return err
	}

	// grab the current configuration to do an incremental update
	config, err := api.GetTunnelConfiguration(ctx, account, tunnel_id)
	if err != nil {
		return err
	}

	// first we extract ingress rules from the list of services
	var ingressRules []*cloudflare.UnvalidatedIngressRule
	var domainInfos []ruleInfo
	for _, svc := range services {
		serviceName := svc.Spec.Name
		labels := svc.Spec.Labels

		domainInfo := extractDomainInfo(labels)
		for _, domain := range domainInfo {
			var rule *cloudflare.UnvalidatedIngressRule
			for i, r := range config.Config.Ingress {
				if r.Hostname == domain.Domain {
					rule = &r
					config.Config.Ingress = remove(config.Config.Ingress, i)
					break
				}
			}

			service := fmt.Sprintf("%s://%s:%d", domain.Protocol, serviceName, domain.Port)
			if rule == nil {
				rule = &cloudflare.UnvalidatedIngressRule{
					Hostname: domain.Domain,
					Service:  service,
				}
			} else {
				rule.Service = service
			}

			ingressRules = append(ingressRules, rule)
			domainInfos = append(domainInfos, ruleInfo{
				DomainInfo:  domain,
				ingressRule: rule,
			})
		}
	}

	// get dns records to incrementally update
	zones, _, err := api.ListDNSRecords(ctx, zone, cloudflare.ListDNSRecordsParams{})
	if err != nil {
		return err
	}

	// delete dns records for deleted services
	for _, rule := range config.Config.Ingress {
		if rule.Hostname == "" {
			continue
		}

		var record *cloudflare.DNSRecord
		for _, z := range zones {
			if rule.Hostname == z.Name {
				record = &z
				break
			}
		}

		if record == nil {
			fmt.Printf("no zone associated with existing ingress rule %s (%s)\n", rule.Hostname, rule.Service)
			continue
		}

		if err = api.DeleteDNSRecord(ctx, zone, record.ID); err != nil {
			fmt.Printf("failed to delete: %s\n", err)
		}
	}

	// create dns records for new services
	for _, rule := range ingressRules {
		var record *cloudflare.DNSRecord
		for i, z := range zones {
			if rule.Hostname == z.Name {
				record = &z
				zones = remove(zones, i)
				break
			}
		}

		if record != nil {
			continue
		}

		proxied := true
		_, err = api.CreateDNSRecord(ctx, zone, cloudflare.CreateDNSRecordParams{
			Name:    rule.Hostname,
			Content: fmt.Sprintf("%s.cfargotunnel.com", tunnel_id),
			Type:    "CNAME",
			Proxied: &proxied,
			Comment: "[AUTOGENERATED] homelab service",
		})
		if err != nil {
			fmt.Printf("failed to create dns record %s: %s\n", rule.Hostname, err)
		}
	}

	// get access apps to incrementally update
	apps, _, err := api.ListAccessApplications(ctx, account, cloudflare.ListAccessApplicationsParams{})
	if err != nil {
		return err
	}

	// delete access apps for deleted services
	for _, rule := range config.Config.Ingress {
		if rule.OriginRequest == nil || rule.OriginRequest.Access == nil || !rule.OriginRequest.Access.Required {
			continue
		}

		var app *cloudflare.AccessApplication
		for _, a := range apps {
			if slices.Contains(rule.OriginRequest.Access.AudTag, a.AUD) {
				app = &a
				break
			}
		}

		if app == nil {
			fmt.Printf("no app associated with existing ingress rule %s (%s)\n", rule.Hostname, rule.Service)
			continue
		}

		err = api.DeleteAccessApplication(ctx, account, app.ID)
		if err != nil {
			fmt.Printf("failed to delete app %s\n", app.Name)
		}
	}

	// grab a list of policies
	policies, _, err := api.ListAccessPolicies(ctx, account, cloudflare.ListAccessPoliciesParams{})
	if err != nil {
		return err
	}

	// try to find a policy to use
	var policy *cloudflare.AccessPolicy
	for _, p := range policies {
		if p.Decision != "allow" {
			continue
		}

		for _, rule := range p.Include {
			if r, ok := rule.(cloudflare.AccessGroupAccessGroup); ok {
				if r.Group.ID == group_id {
					policy = &p
					break
				}
			}
		}

		if policy != nil {
			break
		}
	}

	// create a new policy if we didnt find one
	if policy == nil {
		p, err := api.CreateAccessPolicy(ctx, account, cloudflare.CreateAccessPolicyParams{
			Decision: "allow",
			Name:     "[AUTOGENERATED] Allow group",
			Include: []interface{}{
				cloudflare.AccessGroupAccessGroup{
					Group: struct {
						ID string `json:"id"`
					}{
						ID: group_id,
					},
				},
			},
		})
		if err != nil {
			return err
		}

		policy = &p
	}

	// create access apps for new services
	for _, domain := range domainInfos {
		if !domain.Access {
			continue
		}

		var app *cloudflare.AccessApplication
		for _, a := range apps {
			if slices.Contains(a.SelfHostedDomains, domain.Domain) {
				app = &a
				break
			}
		}

		if app != nil {
			continue
		}

		t := true
		a, err := api.CreateAccessApplication(ctx, account, cloudflare.CreateAccessApplicationParams{
			AllowAuthenticateViaWarp: &t,
			Domain:                   domain.Domain,
			Name:                     domain.Name,
			Type:                     cloudflare.SelfHosted,
			SkipInterstitial:         &t,
			Policies:                 []string{policy.ID},
		})
		if err != nil {
			fmt.Printf("failed to create application for ")
		}

		or := domain.ingressRule.OriginRequest
		if or == nil {
			or = &cloudflare.OriginRequestConfig{}
			domain.ingressRule.OriginRequest = or
		}

		access := or.Access
		if access == nil {
			access = &cloudflare.AccessConfig{}
			or.Access = access
		}

		access.AudTag = []string{a.AUD}
		access.Required = true
		access.TeamName = "mattprovost"
	}

	// add the catch-all rule
	ingressRules = append(ingressRules, &cloudflare.UnvalidatedIngressRule{
		Hostname: "",
		Service:  "http_status:503",
	})

	// update the ingress rules
	config.Config.Ingress = copied(ingressRules)

	// update the tunnel configuration
	_, err = api.UpdateTunnelConfiguration(ctx, account, cloudflare.TunnelConfigurationParams{
		TunnelID: tunnel_id,
		Config:   config.Config,
	})
	if err != nil {
		return err
	}

	fmt.Printf("Successfully updated config\n")

	return nil
}

func remove[T any](s []T, i int) []T {
	s[i] = s[len(s)-1]
	return s[:len(s)-1]
}

func copied[T any](s []*T) (out []T) {
	for _, v := range s {
		out = append(out, *v)
	}

	return
}