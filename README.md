# Fotowedstrijd grader

Hosted grader for the Noorderlichtjagers fotokalender contest.

**Live:** https://fotowedstrijd.mailmoose.app/

## Auth

NLJ list admins only. Opening the site redirects to
`https://nlj.mailmoose.app/contest-grade/handoff`, which uses the normal NLJ
admin login (password or passkey) and returns a short-lived `gradeToken` to this
origin. The token is sent as `Authorization: Bearer …` to
`https://api.mailmoose.app/lists/noorderlichtjagers/contest-grade/…`.

## Deploy

GitHub Pages via `.github/workflows/pages.yml` on `main`. Custom domain
`fotowedstrijd.mailmoose.app` (CNAME in repo + Route53 override of
`*.mailmoose.app` → API Gateway).

```bash
# DNS (Route53 mailmoose.app zone) — explicit host beats the wildcard:
# CNAME fotowedstrijd → opensolvers.github.io
```

## Local copy

The AWS-direct local tool still lives in the mailmoose repo:
`tools/fotowedstrijd-grader/`.
