import Link from "next/link";
import { getUi } from "@/lib/content";

export default async function NotFound() {
  const ui = await getUi();
  return <div className="empty-page"><h1>{ui.app_name}</h1><p>{ui.phrases.out_of_scope}</p><Link className="back-link" href="/">{ui.reader.back}</Link></div>;
}
