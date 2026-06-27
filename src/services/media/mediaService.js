import { CLOUDINARY_CONFIG } from "../../config/cloudinary";
import { uploadImageToCloudinary } from "./cloudinaryProvider";

const makeSafeFolderName = (value = "unknown") => {
  return String(value)
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80);
};

export const uploadPlayerPhoto = async (file, playerId = "new") => {
  const safePlayerId = makeSafeFolderName(playerId);

  const result = await uploadImageToCloudinary(
    file,
    `${CLOUDINARY_CONFIG.folders.players}/${safePlayerId}`
  );

  return result.url;
};

export const uploadTeamLogo = async (file, teamName = "team") => {
  const safeTeamName = makeSafeFolderName(teamName);

  const result = await uploadImageToCloudinary(
    file,
    `${CLOUDINARY_CONFIG.folders.teamLogos}/${safeTeamName}`
  );

  return result.url;
};

export const uploadLeagueAsset = async (file, assetType = "general") => {
  const safeAssetType = makeSafeFolderName(assetType);

  const result = await uploadImageToCloudinary(
    file,
    `${CLOUDINARY_CONFIG.folders.leagueAssets}/${safeAssetType}`
  );

  return result.url;
};
