package main

import (
	"fmt"
	"os"
	"time"

	"github.com/BSFishy/starr"
	"github.com/BSFishy/starr/prowlarr"
	"github.com/BSFishy/starr/radarr"
	"github.com/BSFishy/starr/sonarr"
)

type arr struct {
	Name string
	Host string
	Port uint32
}

type sonarrrr struct {
	Sonarr *sonarr.Sonarr
	arr
}

type prowlarrrr struct {
	Prowlarr *prowlarr.Prowlarr
	arr
}

type radarrrr struct {
	Radarr *radarr.Radarr
	arr
}

type starrs struct {
	sonarrs       []sonarrrr
	radarrs       []radarrrr
	prowlarrs     []prowlarrrr
	transmissions []arr
}

func NewStarr(serviceName string, domain DomainInfo) *starr.Config {
	return starr.New(os.Getenv(fmt.Sprintf("STARR_API_KEY_%s", domain.Name)), fmt.Sprintf("http://%s:%d", serviceName, domain.Port), 5*time.Second)
}
