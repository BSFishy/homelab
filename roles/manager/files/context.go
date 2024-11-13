package main

import (
	"context"

	"github.com/cloudflare/cloudflare-go"
)

const (
	tunnelConfigKey       = "homelab_manager:tunnelConfig"
	dnsRecordsKey         = "homelab_manager:dnsRecords"
	accessApplicationsKey = "homelab_manager:accessApplications"
)

func setSyncContext(ctx context.Context, tunnelConfig *cloudflare.TunnelConfigurationResult, dnsRecords []cloudflare.DNSRecord, accessApplications []cloudflare.AccessApplication) context.Context {
	ctx = context.WithValue(ctx, tunnelConfigKey, tunnelConfig)
	ctx = context.WithValue(ctx, dnsRecordsKey, dnsRecords)
	ctx = context.WithValue(ctx, accessApplicationsKey, accessApplications)

	return ctx
}

func TunnelConfig(ctx context.Context) *cloudflare.TunnelConfigurationResult {
	return ctx.Value(tunnelConfigKey).(*cloudflare.TunnelConfigurationResult)
}

func GetDNSRecord(ctx context.Context, name string) *cloudflare.DNSRecord {
	records := DnsRecords(ctx)
	for _, record := range records {
		if record.Name == name {
			return &record
		}
	}

	return nil
}

func DnsRecords(ctx context.Context) []cloudflare.DNSRecord {
	return ctx.Value(dnsRecordsKey).([]cloudflare.DNSRecord)
}

func GetAccessApplication(ctx context.Context, name string) *cloudflare.AccessApplication {
	applications := AccessApplications(ctx)
	for _, app := range applications {
		if app.Name == name {
			return &app
		}
	}

	return nil
}

func AccessApplications(ctx context.Context) []cloudflare.AccessApplication {
	return ctx.Value(accessApplicationsKey).([]cloudflare.AccessApplication)
}
