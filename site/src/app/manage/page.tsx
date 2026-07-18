import { OwnerControls } from "@/components/OwnerControls";
import Link from "next/link";

export default function ManagePage() {
  return <main className="manage-page shell"><Link className="back-link" href="/">← Impact Club</Link><p className="eyebrow">OWNER CONTROL ROOM</p><h1>Run the drop.</h1><p>Every action below creates a Base transaction. Contract ownership—not this page—enforces access.</p><OwnerControls /></main>;
}
