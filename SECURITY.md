# Security Policy

## Secret handling

- Never commit `.env`, private keys, database URLs, access tokens, or payment provider credentials.
- Store production values only in Vercel Environment Variables or the provider dashboard.
- Rotate any credential immediately if it appears in Git history, screenshots, chat, or logs.
- Use least-privilege tokens and prefer short-lived credentials where possible.

## GitHub account and repository protection

- Require two-factor authentication on the GitHub account.
- Keep the repository private unless a public release is intentional.
- Enable GitHub secret scanning, push protection, Dependabot alerts, and CodeQL where available.
- Protect the `main` branch so direct force-pushes and accidental deletions are blocked.
- Review collaborators regularly and remove unused access.

## Reporting

Security issues should be handled privately by the repository owner. Do not open public issues with secrets or exploit details.
