package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cloudflare/cloudflare-go"
	"github.com/docker/docker/client"
)

// Debouncer struct holds the debounce logic
type Debouncer struct {
	timer    *time.Timer
	eventCh  chan interface{}
	cli      *client.Client
	api      *cloudflare.API
	interval time.Duration
}

// NewDebouncer initializes and returns a Debouncer
func NewDebouncer(client *client.Client, api *cloudflare.API, interval time.Duration) *Debouncer {
	d := &Debouncer{
		interval: interval,
		eventCh:  make(chan interface{}, 1),
		cli:      client,
		api:      api,
	}
	go d.start()
	return d
}

// start begins the debounce process
func (d *Debouncer) start() {
	for range d.eventCh {
		if d.timer != nil {
			d.timer.Stop()
		}
		d.timer = time.AfterFunc(d.interval, d.execute)
	}
}

// execute is the function to be debounced
func (d *Debouncer) execute() {
	fmt.Println("Function executed at", time.Now())
	if err := syncServices(d.cli, d.api); err != nil {
		log.Printf("error syncing services: %s", err)
	}
}

// Trigger signals an event to the debouncer
func (d *Debouncer) Trigger() {
	select {
	case d.eventCh <- struct{}{}:
	default:
		log.Printf("channel is full... skipping trigger")
	}
}
