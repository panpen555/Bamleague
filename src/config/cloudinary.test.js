describe("Cloudinary public configuration", () => {
  const originalCloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const originalPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

  afterEach(() => {
    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME = originalCloudName;
    process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET = originalPreset;
    jest.resetModules();
  });

  test("reports the missing Cloud Name clearly", () => {
    delete process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    delete process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
    jest.resetModules();
    const { validateCloudinaryConfig } = require("./cloudinary");
    expect(() => validateCloudinaryConfig()).toThrow(
      "REACT_APP_CLOUDINARY_CLOUD_NAME",
    );
  });

  test("reports the missing Upload Preset clearly", () => {
    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME = "public-cloud-name";
    delete process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
    jest.resetModules();
    const { validateCloudinaryConfig } = require("./cloudinary");
    expect(() => validateCloudinaryConfig()).toThrow(
      "REACT_APP_CLOUDINARY_UPLOAD_PRESET",
    );
  });
});
