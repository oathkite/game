# Terrain alpha / crater edge verification

- Removed the artificial dark crater stroke; circular destruction retained.
- Cleaned source alpha and encoded losslessly; source RGB unchanged.
- Switched enlarged artwork interpolation to linear / high quality.
- Maps: 86 tests passed; reviewed rock-arch checksum update after alpha cleanup.
- Browser canvas: transparency, chunk-boundary cut, original edge color and restore pass.
- Chromium production: load, opening, actual shot, collision removal and next turn pass.
- after.png captures normal gameplay zoom after a real shot.

The image is still 1672 × 941. Interpolation reduces pixel blocks, but close-up
rock detail remains softer than the tank; this is not a completed high-resolution
art replacement.
