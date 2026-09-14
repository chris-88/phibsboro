/**
 * Every string this story shows, in one frozen object (S2.8). Keeping the copy in one module makes
 * the jargon ban (AC10) and the fifteen-word ceiling (AC11) one grep and one unit test over one
 * file, rather than a hunt through JSX. British English, full stops, no exclamation marks, no
 * "just", no "simply", and never the word this story is forbidden to use.
 *
 * iOS step one is assembled in JSX in `install-sheet.tsx`, because it carries the share glyph inline
 * in the sentence; only its plain siblings live here.
 */
export const installCopy = {
  cardLine: 'Put Phibsboro on your home screen. One tap next time.',
  install: 'Install',
  showMe: 'Show me how',
  notNow: 'Not now',
  sheetTitle: 'Add to your home screen',
  installLine: 'Add Phibsboro to your home screen.',
  iosStep2: 'Scroll down. Tap Add to Home Screen.',
  iosStep3: 'Tap Add.',
  androidStep1: 'Tap the three dots at the top right.',
  androidStep2: 'Tap Install app, or Add to Home screen.',
  androidStep3: 'Tap Install.',
} as const
