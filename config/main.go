package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"os"

	"github.com/charmbracelet/huh"
)

// GenerateRandomBytes returns securely generated random bytes.
// It will return an error if the system's secure random
// number generator fails to function correctly, in which
// case the caller should not continue.
func GenerateRandomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	_, err := rand.Read(b)
	// Note that err == nil only if we read len(b) bytes.
	if err != nil {
		return nil, err
	}

	return b, nil
}

// GenerateRandomStringBase64 returns a URL-safe, base64 encoded
// securely generated random string.
// It will return an error if the system's secure random
// number generator fails to function correctly, in which
// case the caller should not continue.
func GenerateRandomStringBase64(n int) (string, error) {
	b, err := GenerateRandomBytes(n)
	return base64.StdEncoding.EncodeToString(b), err
}

func main() {
	var (
		api_email    string
		api_key      string
		account_id   string
		group_id     string
		pia_username string
		pia_password string
	)

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().Title("What is your Cloudflare API Email").Value(&api_email),
			huh.NewInput().Title("What is your Cloudflare API Key").EchoMode(huh.EchoModePassword).Value(&api_key),
			huh.NewInput().Title("What is your Cloudflare Account ID?").Value(&account_id),
			huh.NewInput().Title("What is your Cloudflare Access group ID?").Value(&group_id),
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

	variables := map[string]string{
		"CLOUDFLARE_API_EMAIL":     api_email,
		"CLOUDFLARE_API_KEY":       api_key,
		"CLOUDFLARE_ACCOUNT_ID":    account_id,
		"CLOUDFLARE_TUNNEL_SECRET": tunnel_secret,
		"CLOUDFLARE_GROUP_ID":      group_id,
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
