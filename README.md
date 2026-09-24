# ao-card

## Local development

Install dependencies from the lockfile:

```bash
npm install
```

Start the dev server (`next dev`). It serves the app at [http://localhost:3000](http://localhost:3000):

```bash
npm run dev
```

Typecheck the project. There is no `typecheck` script; `tsconfig.json` already sets `"noEmit": true`, and this command runs the TypeScript compiler directly:

```bash
npx tsc --noEmit
```
