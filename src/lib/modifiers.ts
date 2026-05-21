import { Plastic, Weight, Wear } from '../types'

interface FlightMod {
  turn: number
  fade: number
}

/**
 * Plastic blend affects effective stability.
 * Base/baseline plastics (DX/Pro D/Electron) tend to be more understable.
 * Premium plastics (Star/Z/Neutron) hold their rated flight numbers.
 * Glow / specialty plastics are usually a touch more overstable.
 */
export const PLASTIC_MODS: Record<Plastic, FlightMod> = {
  Premium: { turn:  0.0, fade:  0.0 },
  Base:    { turn: -0.5, fade: -0.3 },
  Glow:    { turn:  0.2, fade:  0.2 },
}

/**
 * Weight modifier. Heavier discs fight wind better and are more overstable.
 * Standard = 167-172g, Max = 173-175g, Light = under 165g.
 */
export const WEIGHT_MODS: Record<Weight, FlightMod> = {
  Max:      { turn:  0.3, fade:  0.3 },
  Standard: { turn:  0.0, fade:  0.0 },
  Light:    { turn: -0.5, fade: -0.3 },
}

/**
 * Wear modifier. The more a disc is broken in, the more understable it gets.
 * Beat In can completely transform an overstable disc into a turnover machine.
 */
export const WEAR_MODS: Record<Wear, FlightMod> = {
  New:         { turn:  0.0, fade:  0.0 },
  'Broken In': { turn: -0.5, fade: -0.3 },
  'Beat In':   { turn: -1.5, fade: -0.8 },
}

