import Link from "next/link";

const destinations = [
  { href: "/", label: "BAR", mark: "G" },
  { href: "/collection", label: "GOONS", mark: "#" },
  { href: "/gooniverse", label: "MAP", mark: "◇" },
  { href: "/arena", label: "ARENA", mark: "1V1" },
  { href: "/profile", label: "ME", mark: "●" },
] as const;

export function MobileNav() {
  return <nav className="mobile-app-nav" aria-label="Mobile site navigation">
    {destinations.map((item) => <Link key={item.href} href={item.href}><b>{item.mark}</b><span>{item.label}</span></Link>)}
  </nav>;
}
