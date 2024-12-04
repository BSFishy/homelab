package main

import (
	"fmt"
	"log"
	"sync"
	"time"
)

// Debouncer struct holds the debounce logic
type Debouncer struct {
	timer    *time.Timer
	eventCh  chan interface{}
	m        *manager
	interval time.Duration
	mu       sync.Mutex
}

// NewDebouncer initializes and returns a Debouncer
func NewDebouncer(m *manager, interval time.Duration) *Debouncer {
	d := &Debouncer{
		interval: interval,
		eventCh:  make(chan interface{}, 1),
		m:        m,
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
	d.mu.Lock()
	defer d.mu.Unlock()

	fmt.Println("Function executed at", time.Now())
	if err := syncServices(d.m); err != nil {
		log.Printf("error syncing services: %s", err)
	}

	fmt.Println("Function finished executing at", time.Now())
}

// Trigger signals an event to the debouncer
func (d *Debouncer) Trigger() {
	select {
	case d.eventCh <- struct{}{}:
	default:
		log.Printf("channel is full... skipping trigger")
	}
}
