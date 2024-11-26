package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/BSFishy/starr"
	"github.com/BSFishy/starr/prowlarr"
	"github.com/BSFishy/starr/radarr"
	"github.com/BSFishy/starr/sonarr"
	"github.com/cloudflare/cloudflare-go"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/client"
	"github.com/pkg/errors"
)

type manager struct {
	cli *client.Client
	api *cloudflare.API
	ss  starrs
}

func NewManager() *manager {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Fatalf("error creating Docker client: %v", err)
	}

	api, err := cloudflare.New(os.Getenv("CLOUDFLARE_API_KEY"), os.Getenv("CLOUDFLARE_API_EMAIL"))
	if err != nil {
		log.Fatal(err)
	}

	return &manager{
		cli: cli,
		api: api,
	}
}

func (m *manager) Close() {
	if err := m.cli.Close(); err != nil {
		log.Fatal(err)
	}
}

func (m *manager) RegisterLoops() {
	go m.dockerServiceLoop()
	go m.starrServiceLoop()
}

func (m *manager) GracefulShutdown() {
	fmt.Println("Started! Waiting to die...")

	done := make(chan os.Signal, 1)
	signal.Notify(done, syscall.SIGINT, syscall.SIGTERM)
	<-done

	fmt.Printf("Goodbye world...\n")
}

func (m *manager) dockerServiceLoop() {
	debouncer := NewDebouncer(m, 5*time.Second)
	debouncer.Trigger()

	messages, errs := m.cli.Events(context.Background(), events.ListOptions{})

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
}

func (m *manager) starrServiceLoop() {
	for {
		m.starrServiceIteration()
		time.Sleep(12 * time.Hour)
	}
}

func (m *manager) starrServiceIteration() {
	for _, p := range m.ss.prowlarrs {
		if err := m.syncProwlarr(&p); err != nil {
			fmt.Printf("failed to sync prowlarr: %s\n", err)
		}
	}

	for _, s := range m.ss.sonarrs {
		if err := m.syncSonarr(&s); err != nil {
			fmt.Printf("failed to sync sonarr: %s\n", err)
		}
	}

	for _, r := range m.ss.radarrs {
		if err := m.syncRadarr(&r); err != nil {
			fmt.Printf("failed to sync radarr: %s\n", err)
		}
	}
}

func (m *manager) syncProwlarr(pr *prowlarrrr) error {
	p := pr.Prowlarr

	fmt.Printf("Syncing prowlarr\n")
	dlClients, err := p.GetDownloadClients()
	if err != nil {
		return errors.Wrapf(err, "failed to get download clients")
	}

	for _, t := range m.ss.transmissions {
		var client *prowlarr.DownloadClientOutput
		for _, c := range dlClients {
			if c.Name == t.Name {
				client = c
				break
			}
		}

		fields := map[string]interface{}{
			"host":   t.Host,
			"port":   t.Port,
			"useSsl": false,
		}

		downloadClient := &prowlarr.DownloadClientInput{
			Enable:             true,
			Name:               t.Name,
			Priority:           1,
			Implementation:     "Transmission",
			Protocol:           "torrent",
			ConfigContract:     "TransmissionSettings",
			Tags:               []int{},
			Fields:             toFields(fields),
			Categories:         []interface{}{},
			SupportsCategories: false,
		}

		if client == nil {
			// create new download client
			_, err := p.AddDownloadClient(downloadClient)
			if err != nil {
				fmt.Printf("failed to add download client to prowlarr: %s\n", err)
				continue
			}
		} else {
			// check if we should update download client
			if !client.Enable || client.Implementation != "Transmission" || client.Protocol != "torrent" || client.ConfigContract != "TransmissionSettings" || !fieldsMatch(client.Fields, fields) {
				downloadClient.ID = client.ID
				_, err := p.UpdateDownloadClient(downloadClient, false)
				if err != nil {
					fmt.Printf("failed to update download client in prowlarr: %s\n", err)
					continue
				}
			}
		}
	}

	apps, err := p.GetApplications()
	if err != nil {
		return errors.Wrapf(err, "failed to get prowlarr applications")
	}

	for _, s := range m.ss.sonarrs {
		var son *prowlarr.ApplicationOutput
		for _, app := range apps {
			if app.Name == s.Name {
				son = app
			}
		}

		fields := map[string]interface{}{
			"prowlarrUrl":                   fmt.Sprintf("http://%s:%d", pr.Host, pr.Port),
			"baseUrl":                       fmt.Sprintf("http://%s:%d", s.Host, s.Port),
			"apiKey":                        os.Getenv(fmt.Sprintf("STARR_API_KEY_%s", s.Name)),
			"syncCategories":                []int{5000, 5010, 5020, 5030, 5040, 5045, 5050, 5090},
			"animeSyncCategories":           []int{5070},
			"syncAnimeStandardFormatSearch": true,
			"syncRejectBlocklistedTorrentHashesWhileGrabbing": false,
		}

		application := &prowlarr.ApplicationInput{
			Name:               s.Name,
			Implementation:     "Sonarr",
			ImplementationName: "Sonarr",
			ConfigContract:     "SonarrSettings",
			Tags:               []int{},
			SyncLevel:          "fullSync",
			Fields:             toFields(fields),
		}

		if son == nil {
			// create new app
			_, err := p.AddApplication(application)
			if err != nil {
				fmt.Printf("failed to add application to prowlarr: %s\n", err)
				continue
			}
		} else {
			// update app
			if son.Implementation != "Sonarr" || son.ImplementationName != "Sonarr" || son.ConfigContract != "SonarrSettings" || son.SyncLevel != "fullSync" || !fieldsMatch(son.Fields, fields) {
				application.ID = son.ID
				_, err := p.UpdateApplication(application, false)
				if err != nil {
					fmt.Printf("failed to update application in prowlarr: %s\n", err)
					continue
				}
			}
		}
	}

	for _, r := range m.ss.radarrs {
		var rad *prowlarr.ApplicationOutput
		for _, app := range apps {
			if app.Name == r.Name {
				rad = app
			}
		}

		fields := map[string]interface{}{
			"prowlarrUrl":                   fmt.Sprintf("http://%s:%d", pr.Host, pr.Port),
			"baseUrl":                       fmt.Sprintf("http://%s:%d", r.Host, r.Port),
			"apiKey":                        os.Getenv(fmt.Sprintf("STARR_API_KEY_%s", r.Name)),
			"syncCategories":                []int{5000, 5010, 5020, 5030, 5040, 5045, 5050, 5090},
			"animeSyncCategories":           []int{5070},
			"syncAnimeStandardFormatSearch": true,
			"syncRejectBlocklistedTorrentHashesWhileGrabbing": false,
		}

		application := &prowlarr.ApplicationInput{
			Name:               r.Name,
			Implementation:     "Radarr",
			ImplementationName: "Radarr",
			ConfigContract:     "RadarrSettings",
			Tags:               []int{},
			SyncLevel:          "fullSync",
			Fields:             toFields(fields),
		}

		if rad == nil {
			// create new app
			_, err := p.AddApplication(application)
			if err != nil {
				fmt.Printf("failed to add application to prowlarr: %s\n", err)
				continue
			}
		} else {
			// update app
			if rad.Implementation != application.Implementation || rad.ImplementationName != application.ImplementationName || rad.ConfigContract != application.ConfigContract || rad.SyncLevel != application.SyncLevel || !fieldsMatch(rad.Fields, fields) {
				application.ID = rad.ID
				_, err := p.UpdateApplication(application, false)
				if err != nil {
					fmt.Printf("failed to update application in prowlarr: %s\n", err)
					continue
				}
			}
		}
	}

	fmt.Printf("successfully synced prowlarr\n")

	return nil
}

func (m *manager) syncSonarr(so *sonarrrr) error {
	fmt.Printf("Syncing sonarr\n")

	s := so.Sonarr
	dlClients, err := s.GetDownloadClients()
	if err != nil {
		return errors.Wrapf(err, "failed to get download clients for sonarr")
	}

	for _, t := range m.ss.transmissions {
		var client *sonarr.DownloadClientOutput
		for _, c := range dlClients {
			if c.Name == t.Name {
				client = c
				break
			}
		}

		fields := map[string]interface{}{
			"host":   t.Host,
			"port":   t.Port,
			"useSsl": false,
		}

		downloadClient := &sonarr.DownloadClientInput{
			Enable:         true,
			Name:           t.Name,
			Priority:       1,
			Implementation: "Transmission",
			Protocol:       "torrent",
			ConfigContract: "TransmissionSettings",
			Tags:           []int{},
			Fields:         toFields(fields),
		}

		if client == nil {
			// add new download client
			_, err := s.AddDownloadClient(downloadClient)
			if err != nil {
				fmt.Printf("failed to add download client to sonarr: %s\n", err)
				continue
			}
		} else {
			// check if client needs to be updated
			if !client.Enable || client.Implementation != downloadClient.Implementation || client.Protocol != downloadClient.Protocol || client.ConfigContract != downloadClient.ConfigContract || !fieldsMatch(client.Fields, fields) {
				downloadClient.ID = client.ID
				_, err := s.UpdateDownloadClient(downloadClient, false)
				if err != nil {
					fmt.Printf("failed to update download client %s in sonarr: %s\n", t.Name, err)
				}
			}
		}
	}

	fmt.Printf("successfully synced sonarr\n")
	return nil
}

func (m *manager) syncRadarr(ra *radarrrr) error {
	fmt.Printf("Syncing radarr\n")

	r := ra.Radarr
	dlClients, err := r.GetDownloadClients()
	if err != nil {
		return errors.Wrapf(err, "failed to get download clients for radarr")
	}

	for _, t := range m.ss.transmissions {
		var client *radarr.DownloadClientOutput
		for _, c := range dlClients {
			if c.Name == t.Name {
				client = c
				break
			}
		}

		fields := map[string]interface{}{
			"host":   t.Host,
			"port":   t.Port,
			"useSsl": false,
		}

		downloadClient := &radarr.DownloadClientInput{
			Enable:         true,
			Name:           t.Name,
			Priority:       1,
			Implementation: "Transmission",
			Protocol:       "torrent",
			ConfigContract: "TransmissionSettings",
			Tags:           []int{},
			Fields:         toFields(fields),
		}

		if client == nil {
			// add new download client
			_, err := r.AddDownloadClient(downloadClient)
			if err != nil {
				fmt.Printf("failed to add download client to radarr: %s\n", err)
				continue
			}
		} else {
			// check if client needs to be updated
			if !client.Enable || client.Implementation != downloadClient.Implementation || client.Protocol != downloadClient.Protocol || client.ConfigContract != downloadClient.ConfigContract || !fieldsMatch(client.Fields, fields) {
				downloadClient.ID = client.ID
				_, err := r.UpdateDownloadClient(downloadClient, false)
				if err != nil {
					fmt.Printf("failed to update download client %s in radarr: %s\n", t.Name, err)
				}
			}
		}
	}

	fmt.Printf("successfully synced radarr\n")
	return nil
}

func toFields(fields map[string]interface{}) []*starr.FieldInput {
	var out []*starr.FieldInput
	for key, value := range fields {
		out = append(out, &starr.FieldInput{
			Name:  key,
			Value: value,
		})
	}

	return out
}

func fieldsMatch(a []*starr.FieldOutput, b map[string]interface{}) bool {
	for _, field := range a {
		key := field.Name
		bField, ok := b[key]
		if !ok {
			continue
		}

		if bField != field.Value {
			return false
		}
	}

	return true
}
