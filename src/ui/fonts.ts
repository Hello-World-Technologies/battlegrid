// src/ui/fonts.ts
//
// The app's two typefaces, both bundled as native font assets (see assets/fonts/
// and react-native.config.js) so these names resolve without a network.
// FONT_DISPLAY is Lilita One, the chunky game face used for titles, ribbons,
// buttons and big numbers; FONT_BODY is Poppins SemiBold for everything else.
// Both are SIL OFL. Screens import these instead of hard-coding font names so
// swapping either face stays a one-line change.

export const FONT_DISPLAY = 'LilitaOne-Regular';
export const FONT_BODY = 'Poppins-SemiBold';
export const FONT_BODY_BOLD = 'Poppins-Bold';
