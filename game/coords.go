package game

// NormalizeCoords scales game coordinates to fit within Redis's valid geo ranges.
func NormalizeCoords(x, y int) (float64, float64) {
	// Longitude: [-180, 180]
	// Latitude:  [-85.05, 85.05]
	normalizedLon := (float64(x) / float64(WorldSize)) * 180.0
	normalizedLat := (float64(y) / float64(WorldSize)) * 85.0

	// Clamp values to be safe
	if normalizedLon > 180.0 {
		normalizedLon = 180.0
	} else if normalizedLon < -180.0 {
		normalizedLon = -180.0
	}

	if normalizedLat > 85.0 {
		normalizedLat = 85.0
	} else if normalizedLat < -85.0 {
		normalizedLat = -85.0
	}

	return normalizedLon, normalizedLat
}
