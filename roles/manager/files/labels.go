package main

import (
	"fmt"
	"strconv"
	"strings"
)

type DomainInfo struct {
	Name         string
	Domain       string
	Protocol     string
	Port         uint32
	Access       bool
	AccessAdmin  bool
	CustomAccess bool

	Transmission bool
	Sonarr       bool
	Radarr       bool
	Readarr      bool
	Prowlarr     bool
}

func extractDomainInfo(labels map[string]string) []DomainInfo {
	intermediate := make(map[string]map[string]string)
	for label, value := range labels {
		split, ok := matchLabelPrefix(label, "dev", "mattprovost", "?")
		if !ok {
			continue
		}

		serviceName := split[2]
		rest := strings.Join(split[3:], ".")

		service, ok := intermediate[serviceName]
		if !ok {
			service = make(map[string]string)
			intermediate[serviceName] = service
		}

		service[rest] = value
	}

	domains := []DomainInfo{}

	for serviceName, serviceInfo := range intermediate {
		p, ok := serviceInfo["port"]
		if !ok {
			p = "80"
		}

		port, err := strconv.Atoi(p)
		if err != nil {
			fmt.Printf("failed to convert %s port to number: %s. defaulting to 80\n", serviceName, err)
			port = 80
		}

		protocol, ok := serviceInfo["protocol"]
		if !ok {
			protocol = "http"
		}

		domains = append(domains, DomainInfo{
			Name:         serviceName,
			Domain:       serviceInfo["domain"],
			Port:         uint32(port),
			Protocol:     protocol,
			Access:       serviceInfo["access"] == "true",
			AccessAdmin:  serviceInfo["access.admin"] == "true",
			CustomAccess: serviceInfo["access.custom"] == "true",

			Transmission: serviceInfo["transmission"] == "true",
			Sonarr:       serviceInfo["sonarr"] == "true",
			Radarr:       serviceInfo["radarr"] == "true",
			Readarr:      serviceInfo["readarr"] == "true",
			Prowlarr:     serviceInfo["prowlarr"] == "true",
		})
	}

	return domains
}

func matchLabelPrefix(label string, path ...string) ([]string, bool) {
	split := strings.Split(label, ".")
	if len(split) < len(path) {
		return nil, false
	}

	for i, part := range path {
		if part == "?" {
			continue
		}

		if part != split[i] {
			return nil, false
		}
	}

	return split, true
}
