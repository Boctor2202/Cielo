import type { CvData } from "./types";

const h = (m: number) => Math.floor(m / 60);

/**
 * What the cover-letter writer gets to know about the pilot: identity, licences, hours (whole hours, the
 * figures recruiters screen on), types flown, experience, languages. Nothing else leaves the device.
 */
export function letterPilot(data: CvData, extra: { rank?: string; employer?: string; base?: string } = {}) {
  const p = data.profile;
  const x = data.hours;
  return {
    name: p.fullName,
    headline: p.headline,
    rank: extra.rank,
    currentEmployer: extra.employer,
    homeBase: extra.base,
    nationality: p.nationality,
    rightToWork: p.rightToWork,
    summary: p.summary,
    licences: data.licences.map((l) => ({ kind: l.kind, code: l.code, authority: l.authority, validUntil: l.validUntil ?? undefined })),
    hours: {
      total: h(x.totalMin),
      pic: h(x.picMin),
      picUnderSupervision: h(x.picusMin),
      copilot: h(x.copilotMin),
      multiPilot: h(x.multiPilotMin),
      multiEngine: h(x.multiEngineMin),
      jet: h(x.jetMin),
      turboprop: h(x.turbopropMin),
      turbine: h(x.turbineMin),
      night: h(x.nightMin),
      ifr: h(x.ifrMin),
      instructor: h(x.instructorMin),
      simulator: h(x.fstdMin),
      last12Months: h(x.last12mMin),
      last90Days: h(x.last90dMin),
      lastFlight: x.lastFlight,
    },
    types: x.byType.slice(0, 12).map((t) => ({ icao: t.icao, name: t.name, multiPilot: t.multiPilot, hours: h(t.totalMin), pic: h(t.picMin), copilot: h(t.copilotMin), lastFlown: t.lastFlown })),
    experience: p.experience.slice(0, 8).map((e) => ({ role: e.role, employer: e.employer, location: e.location, from: e.start, to: e.end ?? "present", aircraft: e.aircraft, highlights: e.bullets.filter(Boolean).slice(0, 4) })),
    education: p.education.slice(0, 4).map((e) => ({ title: e.title, school: e.school, end: e.end })),
    languages: p.languages.map((l) => ({ name: l.name, icaoLevel: l.icaoLevel, level: l.level })),
    skills: p.skills.slice(0, 12),
  };
}
