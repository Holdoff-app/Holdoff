# Security Policy

## Reporting a Vulnerability

If you believe you have found a security or privacy vulnerability in HoldOff,
please report it privately. Do **not** open a public GitHub issue.

- **Email:** security@smsholdoff.com
- **Include:** what you found, the steps to reproduce it, and the impact you think it has.
- **Response:** we aim to acknowledge within 3 business days and to give you a
  status update at least every 7 days until the issue is resolved.
- Please give us a reasonable opportunity to fix the issue before disclosing it
  publicly. We will not pursue legal action against researchers who report in
  good faith and avoid privacy violations, data destruction, and service disruption.

HoldOff handles message content and contact data, so we treat any report
touching user data as our highest priority.

## Supported Versions

HoldOff is pre-1.0 and ships from `main`. Only the latest released version
receives security updates.

| Version        | Supported |
| -------------- | --------- |
| Latest release | ✅        |
| Older releases | ❌        |

## Secrets

Never commit credentials, connection strings, or API keys — including in
**repository names**, branch names, or commit messages. Configuration belongs
in environment variables. If a secret is exposed, rotate it first, then remove it.
