package server

import (
	"encoding/json"
	"fmt"
)

type Message struct {
	To      string  `json:"to"`
	From    string  `json:"from"`
	Xval    float64 `json:"xval"`
	Yval    float64 `json:"yval"`
	Gestval string  `json:"gestval"`
	DimX	float64 `json:"xdim"`
	DimY	float64 `json:"ydim"`
}

// ParseData parses a JSON-encoded message with basic validation
func ParseData(data []byte) (*Message, error) {
	var message Message
	if err := json.Unmarshal(data, &message); err != nil {
		return nil, fmt.Errorf("invalid message format: %w", err)
	}

	// Optional: Add basic validation
	if message.From == "" {
		return nil, fmt.Errorf("sender (from) is required")
	}
	if message.To == "" {
		return nil, fmt.Errorf("recipient (to) is required")
	}

	return &message, nil
}
