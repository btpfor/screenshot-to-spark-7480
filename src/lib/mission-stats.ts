export const missionStats = [
  { value: 300, prefix: "+", suffix: "", label: "chauffeurs" },
  { value: 100, prefix: "", suffix: "%", label: "solidaires" },
  { value: 3, prefix: "", suffix: "", label: "responsables" },
];

export function countAtProgress(value: number, progress: number) {
  const bounded = Math.min(1, Math.max(0, progress));
  return Math.round(value * (1 - (1 - bounded) ** 3));
}