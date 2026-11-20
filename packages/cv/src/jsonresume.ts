import type { CvData } from "./types";

/**
 * JSON Resume (https://jsonresume.org/schema) with an extra "flightExperience" block in hours:
 * a structured copy screening software can read without guessing the layout.
 */
export function toJsonResume(cv: CvData) {
  const { profile: p, hours: h } = cv;
  const hrs = (m: number) => Math.round(m / 60);
  return {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: p.fullName,
      label: p.headline ?? p.target?.title,
      email: p.email,
      phone: p.phone,
      summary: p.summary,
      location: p.location ? { city: p.location } : undefined,
      profiles: p.linkedin ? [{ network: "LinkedIn", url: p.linkedin }] : [],
    },
    work: p.experience.map((x) => ({ name: x.employer, position: x.role, location: x.location, startDate: x.start, endDate: x.end, highlights: x.bullets.filter(Boolean), aircraft: x.aircraft })),
    education: p.education.map((x) => ({ institution: x.school, studyType: x.title, startDate: x.start, endDate: x.end })),
    certificates: cv.licences.map((l) => ({ name: l.code, issuer: l.authority, date: l.issuedOn ?? undefined, validUntil: l.validUntil ?? undefined, number: l.number, kind: l.kind })),
    languages: p.languages.map((x) => ({ language: x.name, fluency: x.icaoLevel ? `ICAO level ${x.icaoLevel}` : x.level })),
    skills: p.skills.map((s) => ({ name: s })),
    flightExperience: {
      unit: "hours",
      asOf: h.asOf,
      total: hrs(h.totalMin),
      pilotInCommand: hrs(h.picMin),
      picUnderSupervision: hrs(h.picusMin),
      coPilot: hrs(h.copilotMin),
      multiPilot: hrs(h.multiPilotMin),
      multiEngine: hrs(h.multiEngineMin),
      turbine: hrs(h.turbineMin),
      jet: hrs(h.jetMin),
      turboprop: hrs(h.turbopropMin),
      night: hrs(h.nightMin),
      ifr: hrs(h.ifrMin),
      simulator: hrs(h.fstdMin),
      last12Months: hrs(h.last12mMin),
      last90Days: hrs(h.last90dMin),
      lastFlight: h.lastFlight,
      byType: h.byType.map((t) => ({ icao: t.icao, name: t.name, total: hrs(t.totalMin), pilotInCommand: hrs(t.picMin), picUnderSupervision: hrs(t.picusMin ?? 0), coPilot: hrs(t.copilotMin), lastFlown: t.lastFlown })),
    },
    meta: { lastModified: new Date().toISOString() },
  };
}
