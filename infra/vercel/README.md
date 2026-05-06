# Vercel Infrastructure Notes

Vercel is the frontend target for `apps/web`. Railway is not the frontend host.

GOV-01 does not deploy. Before any preview, verify `NEXT_PUBLIC_API_BASE_URL`, session-cookie posture, CORS/CSRF expectations, custom domain routing, and synthetic/no-real-PII labelling.
