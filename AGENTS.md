# Knight Medical Billing — Development and Deployment Rules

## Deployment policy
After completing a requested website code change:

1. Finish the entire requested task before deploying. Do not deploy after individual file edits.
2. Run:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test:deploy-safety`
3. If any check fails, do not deploy. Fix the issue and rerun the checks.
4. If all checks pass, run `./ops/deploy-vps.sh` to deploy the completed changes to the production VPS.
5. Report the deployment result and release identifier. Never claim deployment succeeded unless the script confirms it.

## Production safety
- Never modify, delete, replace, seed, or migrate the production SQLite database unless the user explicitly requests that operation.
- Never overwrite production media, uploads, or `/etc/knight/` configuration or secrets.
- Never print, request, commit, or transfer `.env` files or credentials.
- Never run deployment commands as root.
- Never bypass the existing `ops/deploy.sh` backup, health-check, or rollback process.
- Never deploy if the user says not to deploy or asks only for review, planning, or local testing.
- Do not push, commit, merge, or alter Git history as part of deployment.
- Do not change DNS, firewall, SSH, system users, or unrelated VPS configuration.
- Do not deploy incomplete work or work with failing checks.

## Deployment command
Use only:

`./ops/deploy-vps.sh`
