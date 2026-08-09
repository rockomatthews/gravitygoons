const args = process.argv.slice(2);
const read = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const destination = read("destination");
const source = read("source");
const medium = read("medium");
const content = read("content");
const campaign = read("campaign") ?? "goon_league_launch";

if (!destination || !source || !medium || !content) {
  console.error("Usage: npm run marketing:link -- --destination /collection --source x --medium organic_post --content launch_post");
  process.exit(1);
}

const url = new URL(destination, "https://gravitygoons.com");
url.searchParams.set("utm_source", source);
url.searchParams.set("utm_medium", medium);
url.searchParams.set("utm_campaign", campaign);
url.searchParams.set("utm_content", content);
console.log(url.toString());
