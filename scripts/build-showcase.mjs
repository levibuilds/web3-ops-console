import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ["app.js", "styles.css", "favicon.svg", "production-snapshot.json"]) {
  await cp(path.join(root, "public", name), path.join(output, name));
}
await mkdir(path.join(output, "assets/visual-kit/showcase"), { recursive: true });
for (const directory of ["brand", "icons"]) {
  await cp(path.join(root, "assets/visual-kit", directory), path.join(output, "assets/visual-kit", directory), { recursive: true });
}
await cp(path.join(root, "assets/visual-kit/showcase/hero.webp"), path.join(output, "assets/visual-kit/showcase/hero.webp"));
const html = (await readFile(path.join(root, "public/index.html"), "utf8"))
  .replace('<script src="/app.js"></script>', '<script>window.SITES_STATIC = true;</script>\n    <script src="/app.js"></script>');
await writeFile(path.join(output, "index.html"), html);
console.log(`Built read-only showcase in ${output}`);
