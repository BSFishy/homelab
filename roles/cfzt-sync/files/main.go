package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
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

func syncServices(cli *client.Client, api *cloudflare.API) error {
	ctx := context.Background()

	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return err
	}

	config, err := api.GetTunnelConfiguration(ctx, account, tunnel_id)
	if err != nil {
		return err
	}

	var ingressRules []cloudflare.UnvalidatedIngressRule
	for _, svc := range services {
		serviceName := svc.Spec.Name
		labels := svc.Spec.Labels

		if domain, ok := labels["dev.mattprovost.domain"]; ok {
			targetPort := uint32(80)
			if p, ok := labels["dev.mattprovost.port"]; ok {
				np, err := strconv.Atoi(p)
				if err != nil {
					fmt.Printf("failed to parse port for %s: %s\n", serviceName, p)
					continue
				}

				targetPort = uint32(np)
			}

			var rule *cloudflare.UnvalidatedIngressRule
			for i, r := range config.Config.Ingress {
				if r.Hostname == domain {
					rule = &r
					config.Config.Ingress = remove(config.Config.Ingress, i)
					break
				}
			}

			service := fmt.Sprintf("http://%s:%d", serviceName, targetPort)
			if rule == nil {
				rule = &cloudflare.UnvalidatedIngressRule{
					Hostname: domain,
					Service:  service,
				}
			} else {
				rule.Service = service
			}

			ingressRules = append(ingressRules, *rule)
		}
	}

	zones, _, err := api.ListDNSRecords(ctx, zone, cloudflare.ListDNSRecordsParams{})
	if err != nil {
		return err
	}

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

	ingressRules = append(ingressRules, cloudflare.UnvalidatedIngressRule{
		Hostname: "",
		Service:  "http_status:503",
	})

	config.Config.Ingress = ingressRules

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
