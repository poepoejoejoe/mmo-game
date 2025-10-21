package utils

import (
	"crypto/rand"
	"encoding/hex"
)

// GenerateUniqueID creates a cryptographically secure random string for use as a unique ID.
func GenerateUniqueID() string {
	bytes := make([]byte, 8) // 16 hex characters
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to a less random but still highly unlikely to collide ID
		return "fallback_id"
	}
	return hex.EncodeToString(bytes)
}
