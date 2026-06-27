import {
  CLOUDINARY_CONFIG,
  validateCloudinaryConfig,
} from "../../config/cloudinary";

const validateImageFile = (file) => {
  if (!file) {
    throw new Error("ไม่พบไฟล์รูปภาพ");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
  }

  const maxSizeMB = 10;
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`ไฟล์รูปใหญ่เกิน ${maxSizeMB}MB`);
  }
};

export const uploadImageToCloudinary = async (file, folder) => {
  validateCloudinaryConfig();
  validateImageFile(file);

  const targetFolder = folder || CLOUDINARY_CONFIG.rootFolder;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  formData.append("folder", targetFolder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message || "อัปโหลดรูปขึ้น Cloudinary ไม่สำเร็จ"
    );
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
    provider: "cloudinary",
    folder: targetFolder,
  };
};
