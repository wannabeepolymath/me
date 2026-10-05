# Daksh Jain

A personal website presented as a meadow at bee scale. You are the bee: land on a flower to read about one of the things Daksh is into, then fly to the hive to say hello. Built with Vite, strict TypeScript, and Three.js, without a framework. Cloudflare serves the static build.

Edit the contact details and flowers in `src/data.ts`. A flower whose lines all start with `[fill` stays a closed bud until you fill one in. `src/main.ts` runs the page (packet, tags, notes, pollen); `src/meadow.ts` is the 3D scene. If WebGL is unavailable, the tags become a plain list.

```sh
bun install
bun run dev
bun run build
bun run deploy
```

Use `bun run typecheck` to check types and `bun run preview` to preview the production build. Deployment builds the site and uploads `dist/` with Wrangler.

The previous deck-of-cards site is tagged `deck-of-jacks`. `designs/` holds the single-file design explorations; this site is built from `designs/wannabee.html`.
