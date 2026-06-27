const CLOUDINARY_ENV_FOLDER =
  process.env.REACT_APP_CLOUDINARY_ENV_FOLDER || "dev";

const ROOT_FOLDER = `bam-league/${CLOUDINARY_ENV_FOLDER}`;

export const CLOUDINARY_CONFIG = {
  cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "",
  uploadPreset: process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "",
  environmentFolder: CLOUDINARY_ENV_FOLDER,
  rootFolder: ROOT_FOLDER,
  folders: {
    players: `${ROOT_FOLDER}/players`,
    teamLogos: `${ROOT_FOLDER}/team-logos`,
    leagueAssets: `${ROOT_FOLDER}/league-assets`,
    draftAnimations: `${ROOT_FOLDER}/draft-animations`,
  },
};

export const validateCloudinaryConfig = () => {
  if (!CLOUDINARY_CONFIG.cloudName) {
    throw new Error("ยังไม่ได้ตั้งค่า REACT_APP_CLOUDINARY_CLOUD_NAME");
  }

  if (!CLOUDINARY_CONFIG.uploadPreset) {
    throw new Error("ยังไม่ได้ตั้งค่า REACT_APP_CLOUDINARY_UPLOAD_PRESET");
  }

  return true;
};
