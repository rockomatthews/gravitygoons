import { getArenaMatch } from "@/lib/arena";

function stamp(value: string) { return new Date(value).toISOString().replaceAll(/[-:]/g, "").replace(".000", ""); }
function safe(value: string) { return value.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\n", "\\n"); }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await getArenaMatch(id);
  const scheduledStartAt = result?.match.scheduledStartAt;
  if (!result || !scheduledStartAt) return new Response("Scheduled match not found.", { status: 404 });
  const match = result.match;
  const start = new Date(scheduledStartAt);
  const end = new Date(start.getTime() + 45 * 60_000);
  const title = `${match.athletes[0].name} vs ${match.athletes[1].name} — Gravity Goons`;
  const body = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Gravity Goons//Arena//EN","BEGIN:VEVENT",`UID:${id}@gravitygoons.com`,`DTSTAMP:${stamp(new Date().toISOString())}`,`DTSTART:${stamp(start.toISOString())}`,`DTEND:${stamp(end.toISOString())}`,`SUMMARY:${safe(title)}`,`DESCRIPTION:${safe(`${match.discipline} live ranked match. Watch at https://gravitygoons.com/arena/matches/${id}`)}`,`URL:https://gravitygoons.com/arena/matches/${id}`,"END:VEVENT","END:VCALENDAR",""] .join("\r\n");
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="gravity-goons-${id}.ics"` } });
}
