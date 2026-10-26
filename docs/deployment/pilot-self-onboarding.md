# Pilot self-onboarding

Set SELF_ONBOARDING_CONSENT=true in the server .env and restart both API and worker.
This enables the existing /kenalan Save action to activate a pending account once username and grade are present. Existing pending accounts can submit the form again; no bulk SQL update is needed.
The existing FE notice explains learning-data recording and AI/image processing. Records use SELF_DECLARED / LEARNER, not guardian approval. Product analytics is excluded. Revocation and account suspension checks remain unchanged. This switch does not enable AI providers or change their feature flags.
Set the flag to false to require the guardian path for subsequent pending activations. Existing grants are not revoked by changing the flag.
No schema migration or FE rebuild is needed. The current policy metadata remains synthetic-dev-v1; this implementation change does not constitute a reviewed production consent policy.
