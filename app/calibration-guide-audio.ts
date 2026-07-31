const CUES: Array<{ src: string; matches: string[] }> = [
  { src: "/calibration-guide/01-hear-me.m4a", matches: ["can you hear me"] },
  {
    src: "/calibration-guide/02-save-later.m4a",
    matches: ["save this for later"],
  },
  {
    src: "/calibration-guide/03-there-you-are.m4a",
    matches: ["there you are", "keep up with you"],
  },
  {
    src: "/calibration-guide/04-say-anything.m4a",
    matches: ["first thing", "say literally anything"],
  },
  {
    src: "/calibration-guide/05-loud-clear.m4a",
    matches: ["havoc can hear you", "loud, clear"],
  },
  {
    src: "/calibration-guide/06-game-face.m4a",
    matches: ["game face", "open your mouth", "mouth open"],
  },
  { src: "/calibration-guide/08-wiiider.m4a", matches: ["wiiider"] },
  { src: "/calibration-guide/07-wider.m4a", matches: ["wider"] },
  {
    src: "/calibration-guide/09-perfect.m4a",
    matches: ["perfect", "hold that"],
  },
  {
    src: "/calibration-guide/10-probably-safe.m4a",
    matches: ["probably safe", "test some movement"],
  },
  {
    src: "/calibration-guide/11-freeze-gun.m4a",
    matches: ["freeze gun"],
  },
  {
    src: "/calibration-guide/12-ice-cube.m4a",
    matches: ["you’re an ice cube", "you're an ice cube"],
  },
  {
    src: "/calibration-guide/13-muscle.m4a",
    matches: ["put some muscle"],
  },
  {
    src: "/calibration-guide/14-all-you-got.m4a",
    matches: ["all you’ve got", "all you've got"],
  },
  {
    src: "/calibration-guide/15-new-plan.m4a",
    matches: ["isn’t breaking", "isn't breaking", "unbreakable"],
  },
  {
    src: "/calibration-guide/16-ice-delivery.m4a",
    matches: ["bringing the ice"],
  },
  { src: "/calibration-guide/17-zoom-out.m4a", matches: ["zoom out"] },
  {
    src: "/calibration-guide/18-whole-party.m4a",
    matches: ["get a drink", "whole party", "there it is"],
  },
  {
    src: "/calibration-guide/19-flip-drink.m4a",
    matches: ["flip your phone", "drink the secret juice"],
  },
  {
    src: "/calibration-guide/20-bottoms-up.m4a",
    matches: ["bottoms up"],
  },
  {
    src: "/calibration-guide/21-complete.m4a",
    matches: ["drinking yourself", "all done"],
  },
];

export function resolveCalibrationGuideClip(message: string) {
  const normalized = message.toLocaleLowerCase("en-US");
  return CUES.find((cue) =>
    cue.matches.some((match) => normalized.includes(match)),
  )?.src;
}
