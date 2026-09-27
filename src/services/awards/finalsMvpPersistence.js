export const SELECTED_FINALS_MVP_STORAGE_KEY = "selectedFinalsMvpId";

export const normalizeSelectedFinalsMvpId = (value) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
};

export const getSelectedFinalsMvpIdFromBackup = (rawData) => {
  const data =
    rawData?.data && typeof rawData.data === "object"
      ? rawData.data
      : rawData;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "";
  }

  return normalizeSelectedFinalsMvpId(data.selectedFinalsMvpId);
};
