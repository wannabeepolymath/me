# Daksh Jain

A personal website presented as a 3D deck of playing cards on claret felt. Built with Vite, strict TypeScript, and Three.js, without a framework. Cloudflare serves the static build.

Edit the contact details and cards in `src/data.ts`. Cards are dealt in array order. Text beginning with `[fill` appears in pencil; replace the placeholders to print your own content.

```sh
bun install
bun run dev
bun run build
bun run deploy
```

Use `bun run typecheck` to check types and `bun run preview` to preview the production build. Deployment builds the site and uploads `dist/` with Wrangler.

`designs/` holds earlier single-file design explorations that are not deployed.
