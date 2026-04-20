# AWS deployment

A minimal production setup for the Repair Shop app on AWS.

- **API.** Build the `server/` Docker image in CI, push to ECR, run it on ECS Fargate behind an Application Load Balancer. Health check hits `GET /healthz`.

- **Frontend.** `bun run build` outputs a static `dist/`. Upload it to S3 and serve through CloudFront.

- **Database.** Postgres on RDS.

- **Secrets and config.** `JWT_SECRET`, `DATABASE_URL`, and `CORS_ORIGINS` go in AWS Secrets Manager. The ECS task pulls them in as env vars at startup. Nothing sensitive in git.

- **Migrations.** Before each deploy, run `alembic upgrade head` as a one-off ECS task using the same API image. If it fails, the deploy stops.

- **CI/CD.** GitHub Actions on `main`:
  1. Run tests (already in `.github/workflows/test.yml`).
  2. Build and push both images to ECR, tagged with the git SHA.
  3. Run the migration task.
  4. Update the ECS service to the new image.
  5. Sync the frontend `dist/` to S3 and invalidate CloudFront.
