export const PRIMARY_DAWS = [
  { id: "ableton-live", label: "Ableton Live" },
  { id: "fl-studio", label: "FL Studio" },
  { id: "logic-pro", label: "Logic Pro" },
  { id: "bitwig-studio", label: "Bitwig Studio" },
  { id: "reaper", label: "Reaper" },
] as const;

export type PrimaryDawId = (typeof PRIMARY_DAWS)[number]["id"];

export const PRIMARY_DAW_IDS = PRIMARY_DAWS.map((daw) => daw.id) as [PrimaryDawId, ...PrimaryDawId[]];
