---
name: deploy-functions
description: Build and deploy Firebase Functions to production
disable-model-invocation: true
---

Deploy the Firebase Functions:

1. Build functions: `npm --prefix functions run build`
2. Deploy: `firebase deploy --only functions`
3. Verify deployment by checking function URLs in output

If deployment fails with rate limiting, wait 60 seconds and retry.
