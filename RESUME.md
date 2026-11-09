---
name: Anand V A
role: Application Security Engineer
location: Bengaluru, India
email: anandva@proton.me
linkedin: linkedin.com/in/anand-va
---

# Anand V A

## Summary
Application security engineer with 2+ years at Deep Armor building detection and AI-assisted validation tooling. Co-authored Semgrep rules for OWASP Top 10 classes across Python, Java, JavaScript and TypeScript (under 15% false positives) that power an AI-driven SAST engine for an enterprise SaaS client. Now validates the engine's findings, including multi-step vulnerability chains, through code review and live testing. Also built AWS and Azure CSPM checks mapped to CIS, NIST, HIPAA and RBI.

## Experience

### Security Engineer II, Deep Armor | Mar 2026 - present
- **AI-SAST finding validation:** validate findings from an AI-powered SAST engine for an enterprise SaaS client, including multi-step vulnerability chains built from several individual findings. Confirm exploitability through source code review, live testing, architecture analysis and discussion with the client's developers.
- **Verdicts and prioritization:** classify each finding as true positive, false positive, not exploitable or uncertain, and assign P-ratings to confirmed vulnerabilities to set remediation order.
- **Agentic validation workflow:** designed 8-9 LLM skill files that guide an AI agent through structured finding investigation, including an independent sub-agent review for a second opinion. Verdicts are logged to a shared repository and tracking sheets through MCP integrations. Cuts first-pass investigation from 1-2 days to minutes, with every final verdict human-reviewed.

### Security Developer, Deep Armor | Jun 2024 - Feb 2026
- **SAST rule engineering:** co-authored custom Semgrep rules extending OWASP Top 10 coverage (SQL injection, command injection, XSS, CSRF, SSRF) across Python, Java, JavaScript and TypeScript. The rules fed an AI-powered SAST engine that analyzes findings individually and as multi-step attack chains. Tuned detection logic to hold false-positive rates below 15%.
- **Cloud security (CSPM):** engineered detection logic for a multi-cloud CSPM tool, building AWS and Azure misconfiguration checks mapped to CIS Benchmarks, NIST, HIPAA, RBI and other compliance frameworks. Added PDF export for compliance reports.
- **S3 exposure verification:** built a Python utility that confirms public S3 bucket exposure through multi-factor verification rather than a single configuration signal.
- **Post-quantum cryptography detection:** developed static analysis rules identifying post-quantum cryptography (PQC) library usage across 11 programming languages.
- **Security testing:** performed security testing of MFA implementations across web front-ends and API endpoints.

### Security Research Intern, Deep Armor | Aug 2023 - Jun 2024
- Automated cloud resource auditing with Python (Boto3, Azure SDKs). Authored the initial AWS and Azure compliance logic that became the foundation of the company's CSPM engine.

## Skills

### Security
- Application Security, SAST, Vulnerability Validation, Cloud Security (CSPM), Secret Detection, Web and API Security Testing, Post-Quantum Cryptography

### Tools
- Semgrep (custom rule authoring), Gitleaks, TruffleHog, Boto3, Azure SDK, Pytest, Moto, Linux

### Languages
- Python, Java, JavaScript, TypeScript, SQL

### Cloud and compliance
- AWS, Azure, CIS Benchmarks, NIST, HIPAA, RBI, GDPR

### AI
- Agentic security workflows, LLM skill files, Sub-agent review, MCP integrations, Prompt engineering

## Activities
- Represented Deep Armor and the Gauntlet platform at the Bengaluru Tech Summit.
- Competed in CTFs (cryptography, OSINT) as part of the Deep Armor team.

## Education

### B.E. Computer Science and Engineering, BNM Institute of Technology | May 2024
- CGPA: 9.11

## PDF
[view resume.pdf](/resume.pdf) / [download](/resume.pdf)
