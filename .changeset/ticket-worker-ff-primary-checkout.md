---
"@n8io/ai": patch
---

ticket-worker: after merging, fast-forward the primary checkout with `git -C <primary> merge --ff-only origin/main`, never `update-ref`, which moves the ref but leaves that checkout's files behind as staged reverts.
