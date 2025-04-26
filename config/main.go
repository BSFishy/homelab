package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"os"

	"github.com/charmbracelet/huh"
	"github.com/cloudflare/cloudflare-go"
	"github.com/pkg/errors"
)

func GenerateRandomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	_, err := rand.Read(b)
	if err != nil {
		return nil, err
	}

	return b, nil
}

func GenerateRandomStringBase64(n int) (string, error) {
	b, err := GenerateRandomBytes(n)
	return base64.StdEncoding.EncodeToString(b), err
}

func main() {
	ctx := context.Background()

	var (
		api_email     string
		api_key       string
		account_id    string
		group_id      string
		zone          string
		subdomain     string
		instance_name string
		pia_username  string
		pia_password  string
		api           *cloudflare.API
	)

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewNote().Description("Grab keys at https://dash.cloudflare.com/profile/api-tokens"),
			huh.NewInput().Title("What is your Cloudflare API Email").Value(&api_email),
			huh.NewInput().
				Title("What is your Cloudflare API Key").
				EchoMode(huh.EchoModePassword).
				Value(&api_key).
				Validate(func(key string) error {
					var err error
					api, err = cloudflare.New(key, api_email)
					if err != nil {
						return errors.Wrapf(err, "failed to initialize the cloudflare api")
					}

					_, err = api.UserDetails(ctx)
					if err != nil {
						return errors.New("Invalid API key and email pair")
					}

					return nil
				}),
		),
		huh.NewGroup(
			huh.NewSelect[string]().
				Title("What is your Cloudflare Account ID?").
				Value(&account_id).
				OptionsFunc(func() []huh.Option[string] {
					accounts, _, err := api.Accounts(ctx, cloudflare.AccountsListParams{})
					if err != nil {
						log.Fatalf("failed to list accounts: %s", err)
					}

					var options []huh.Option[string]
					for _, account := range accounts {
						options = append(options, huh.NewOption(account.Name, account.ID))
					}

					return options
				}, api),
		),
		huh.NewGroup(
			huh.NewSelect[string]().
				Title("What Cloudflare zone should be used?").
				Value(&zone).
				OptionsFunc(func() []huh.Option[string] {
					zones, err := api.ListZones(ctx)
					if err != nil {
						log.Fatalf("failed to get zones: %s", err)
					}

					var options []huh.Option[string]
					for _, zone := range zones {
						options = append(options, huh.NewOption(zone.Name, zone.Name))
					}

					return options
				}, api),
			huh.NewInput().
				Title("What should be the subdomain?").
				Description("This will be the subdomain services are hosted on. For example, a zone of example.com and subdomain of home will result in domains like service.home.example.com. An empty value will result in services being on the top-level zone, like service.example.com.").
				Suggestions([]string{"home", "homelab", "lab"}).
				Value(&subdomain),
			huh.NewInput().
				Title("What is the name of this instance?").
				Description("This will help to distinguish between different instances in Cloudflare.").
				Value(&instance_name),
			huh.NewSelect[string]().
				Title("What is your Cloudflare Access group ID?").
				Value(&group_id).
				OptionsFunc(func() []huh.Option[string] {
					account := cloudflare.AccountIdentifier(account_id)
					groups, _, err := api.ListAccessGroups(ctx, account, cloudflare.ListAccessGroupsParams{})
					if err != nil {
						log.Fatalf("failed to list access groups: %s", err)
					}

					var options []huh.Option[string]
					for _, group := range groups {
						options = append(options, huh.NewOption(group.Name, group.ID))
					}

					return options
				}, &account_id),
		),
		huh.NewGroup(
			huh.NewInput().Title("What is your PIA username?").Value(&pia_username),
			huh.NewInput().Title("What is your PIA password?").EchoMode(huh.EchoModePassword).Value(&pia_password),
		),
	)

	err := form.Run()
	if err != nil {
		log.Fatal(err)
	}

	tunnel_secret, err := GenerateRandomStringBase64(32)
	if err != nil {
		log.Fatal(err)
	}

	var baseDomain string
	if subdomain == "" {
		baseDomain = zone
	} else {
		baseDomain = fmt.Sprintf("%s.%s", subdomain, zone)
	}

	variables := map[string]string{
		"CLOUDFLARE_API_EMAIL":     api_email,
		"CLOUDFLARE_API_KEY":       api_key,
		"CLOUDFLARE_ACCOUNT_ID":    account_id,
		"CLOUDFLARE_ZONE":          zone,
		"CLOUDFLARE_BASE_DOMAIN":   baseDomain,
		"CLOUDFLARE_TUNNEL_SECRET": tunnel_secret,
		"CLOUDFLARE_GROUP_ID":      group_id,
		"INSTANCE_NAME":            instance_name,
		"PIA_USERNAME":             pia_username,
		"PIA_PASSWORD":             pia_password,
	}

	var env string
	for key, value := range variables {
		env = env + fmt.Sprintf("%s=%s\n", key, value)
	}

	err = os.WriteFile(".env", []byte(env), 0744)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("Configured your environment.")
}
