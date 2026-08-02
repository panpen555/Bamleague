export const cloneRecoveryPayload = (payload) =>
  JSON.parse(JSON.stringify(payload));

export const runWithRequiredRecovery = async ({
  createRecovery,
  operation,
}) => {
  if (typeof createRecovery !== "function") {
    throw new Error("Recovery step is required.");
  }
  if (typeof operation !== "function") {
    throw new Error("Protected operation is required.");
  }

  const recovery = await createRecovery();
  const result = await operation();
  return { recovery, result };
};

export const createRecoveryEnvelope = ({
  kind,
  sourceSchema,
  data,
  createdAt = new Date().toISOString(),
}) =>
  cloneRecoveryPayload({
    app: "BAM_LEAGUE_SYSTEM",
    recoveryKind: kind,
    sourceSchema,
    createdAt,
    data,
  });
