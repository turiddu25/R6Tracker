export type SeasonConfig = {
  key: string;
  name: string;
  startsAt: string;
};

export const seasons: SeasonConfig[] = [
  {
    key: "y10s2",
    name: "Operation Daybreak",
    startsAt: "2025-06-10T13:00:00.000Z",
  },
  {
    key: "y10s3",
    name: "Operation High Stakes",
    startsAt: "2025-09-02T13:00:00.000Z",
  },
  {
    key: "y10s4",
    name: "Operation Deep Freeze Legacy",
    startsAt: "2025-12-02T13:00:00.000Z",
  },
  {
    key: "y11s1",
    name: "Operation Prep Phase",
    startsAt: "2026-03-10T13:00:00.000Z",
  },
  {
    key: "y11s2",
    name: "Operation System Override",
    startsAt: "2026-06-02T13:00:00.000Z",
  },
];

export function getSeasonForDate(value: string | Date = new Date()) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  const sorted = seasons
    .slice()
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return (
    sorted.findLast((season) => new Date(season.startsAt).getTime() <= timestamp) ??
    sorted[0]
  );
}
