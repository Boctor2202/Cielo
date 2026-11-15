# iOS signing credentials (one-time)

Minimal copy of the mobile app config, so `eas credentials` can run without installing the whole monorepo
(the full `apps/mobile/app.json` lists config plugins that need `node_modules`). Keep the bundle identifier,
slug, owner and projectId in sync with `apps/mobile/app.json`.

```bash
cd tools/ios-credentials
npx eas-cli login
npx eas-cli credentials -p ios   # production > Build Credentials > Set up all > log in to Apple
```
