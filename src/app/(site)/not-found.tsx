import Link from "next/link";
import theme from "@/themes/active";

/** `notFound()` inside the public site, rendered within the theme's SiteShell. */
export default function SiteNotFound() {
  if (theme.NotFoundPage) return <theme.NotFoundPage />;
  return (
    <section style={{ padding: "8rem 1.5rem" }}>
      <h1>Page not found</h1>
      <Link href="/">Back to the homepage</Link>
    </section>
  );
}
