/**
 * Arm-speed model. Converts a player's max distance with a driver to an
 * estimated arm speed in mph. Tune as you collect real-world data.
 */
export function armSpeedFromMaxDistance(maxDistance: number): number {
  if (maxDistance < 250) return 50  // Beginner
  if (maxDistance < 325) return 60  // Intermediate
  if (maxDistance < 400) return 70  // Advanced
  return 75                         // Power
}

export function skillTier(
  maxDistance: number,
): 'Beginner' | 'Intermediate' | 'Advanced' | 'Power' {
  if (maxDistance < 250) return 'Beginner'
  if (maxDistance < 325) return 'Intermediate'
  if (maxDistance < 400) return 'Advanced'
  return 'Power'
}

/**
 * Required arm speed (mph) for a disc to fly as rated. Below this, the disc
 * flies more overstable (it stalls); at or above, it flies closer to its
 * rated numbers.
 */
export function requiredArmSpeed(discSpeed: number): number {
  if (discSpeed <= 4)  return 45
  if (discSpeed <= 7)  return 55
  if (discSpeed <= 10) return 62
  if (discSpeed <= 13) return 68
  return 72
}

/**
 * Design distance — realistic max distance for this disc class with an arm at
 * its required speed. The recommendation engine scales this up/down based on
 * the player's actual arm speed (so pros get pro distances, beginners don't).
 */
export function designDistance(discSpeed: number): number {
  if (discSpeed <= 3)  return 220
  if (discSpeed <= 5)  return 290
  if (discSpeed <= 7)  return 370
  if (discSpeed <= 9)  return 420
  if (discSpeed <= 11) return 470
  if (discSpeed <= 13) return 500
  return 530
}
