package main

import (
	"cmp"
	"context"
	"fmt"
	"log"
	"os"
	"slices"

	"github.com/BSFishy/starr/prowlarr"
	"github.com/BSFishy/starr/sonarr"
	"github.com/cloudflare/cloudflare-go"
	"github.com/docker/docker/api/types"
)

var (
	zone      *cloudflare.ResourceContainer
	account   = cloudflare.AccountIdentifier(os.Getenv("CLOUDFLARE_ACCOUNT_ID"))
	tunnel_id = os.Getenv("CLOUDFLARE_TUNNEL_ID")
	group_id  = os.Getenv("CLOUDFLARE_GROUP_ID")
	idp_id    = os.Getenv("CLOUDFLARE_IDP_ID")
)

func main() {
	// Create the manager
	manager := NewManager()
	defer manager.Close()

	// Grab the zone ID from the env var
	zone_id, err := manager.api.ZoneIDByName(os.Getenv("CLOUDFLARE_ZONE"))
	if err != nil {
		log.Fatal(err)
	}

	// Grab the SDK identifier from the zone id
	zone = cloudflare.ZoneIdentifier(zone_id)

	// Register background loops to do work
	manager.RegisterLoops()

	// Handle graceful shutdowns
	manager.GracefulShutdown()
}

func syncServices(m *manager) error {
	ctx := context.Background()

	// get dockerServices as source of truth for configuration
	dockerServices, err := m.cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return err
	}

	// first we extract ingress rules from the list of services
	var services []Service
	var ss starrs
	for _, svc := range dockerServices {
		serviceName := svc.Spec.Name
		labels := svc.Spec.Labels

		domainInfo := extractDomainInfo(labels)
		for _, domain := range domainInfo {
			services = append(services, NewService(serviceName, domain))

			r := arr{
				Name: domain.Name,
				Host: serviceName,
				Port: domain.Port,
			}

			if domain.Transmission {
				ss.transmissions = append(ss.transmissions, r)
			}

			if domain.Sonarr {
				ss.sonarrs = append(ss.sonarrs, sonarrrr{
					Sonarr: sonarr.New(NewStarr(serviceName, domain)),
					arr:    r,
				})
			}

			if domain.Prowlarr {
				ss.prowlarrs = append(ss.prowlarrs, prowlarrrr{
					Prowlarr: prowlarr.New(NewStarr(serviceName, domain)),
					arr:      r,
				})
			}
		}
	}

	// update the starrs and sync them together
	m.ss = ss
	go m.starrServiceIteration()

	// sort the services by name for consistency
	slices.SortFunc(services, func(a, b Service) int {
		return cmp.Compare(a.Name, b.Name)
	})

	// grab the current configuration to do an incremental update
	tunnelConfig, err := m.api.GetTunnelConfiguration(ctx, account, tunnel_id)
	if err != nil {
		return err
	}

	// get dns records to incrementally update
	cfZones, _, err := m.api.ListDNSRecords(ctx, zone, cloudflare.ListDNSRecordsParams{})
	if err != nil {
		return err
	}

	// get access apps to incrementally update
	cfApps, _, err := m.api.ListAccessApplications(ctx, account, cloudflare.ListAccessApplicationsParams{})
	if err != nil {
		return err
	}

	// setup context for synchronizing
	ctx = setSyncContext(ctx, &tunnelConfig, cfZones, cfApps)

	// sync the services and aggregate the ingress rules
	var ingressRules []cloudflare.UnvalidatedIngressRule
	for _, svc := range services {
		rule, err := svc.Sync(ctx, m.api)
		if err != nil {
			fmt.Printf("Failed to sync %s, skipping: %s\n", svc.Name, err)
			continue
		}

		ingressRules = append(ingressRules, *rule)
	}

	// add the catch-all rule
	ingressRules = append(ingressRules, cloudflare.UnvalidatedIngressRule{
		Hostname: "",
		Service:  "http_status:503",
	})

	// update the tunnel configuration
	_, err = m.api.UpdateTunnelConfiguration(ctx, account, cloudflare.TunnelConfigurationParams{
		TunnelID: tunnel_id,
		Config: cloudflare.TunnelConfiguration{
			Ingress: ingressRules,
			WarpRouting: &cloudflare.WarpRoutingConfig{
				Enabled: true,
			},
		},
	})
	if err != nil {
		return err
	}

	fmt.Printf("Successfully updated config\n")

	return nil
}
