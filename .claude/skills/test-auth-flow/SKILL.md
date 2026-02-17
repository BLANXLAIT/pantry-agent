---
name: test-auth-flow
description: Test the Kroger OAuth authentication flow end-to-end
disable-model-invocation: true
---

Test the auth flow:

1. Kill any process on port 3000: `lsof -ti:3000 | xargs kill -9 2>/dev/null || true`
2. Build if needed: `npm run build`
3. Run auth: `node dist/cli.js auth`
4. Complete login in browser (opens automatically)
5. Verify: `node dist/cli.js auth --status`

Expected output after successful auth:

```
✓ Authenticated with Kroger
  Scope: cart.basic:write profile.compact
  Expires: [timestamp]
```
