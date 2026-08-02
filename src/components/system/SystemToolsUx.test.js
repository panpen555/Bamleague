import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdminGettingStarted from "./AdminGettingStarted";
import AdvancedSystemToolsSection from "./AdvancedSystemToolsSection";
import AdvancedCloudTools from "../cloud/AdvancedCloudTools";
import CloudTools from "../cloud/CloudTools";

describe("System Tools UX", () => {
  test("renders the Admin getting started guide", () => {
    const markup = renderToStaticMarkup(<AdminGettingStarted />);
    expect(markup).toContain("เริ่มต้นใช้งานสำหรับ Admin");
    expect(markup).toContain("Safe Publish");
    expect(markup).toContain("Cloudinary");
    expect(markup).toContain("Schema V3");
  });

  test("keeps destructive Clear out of routine Cloud tools", () => {
    const markup = renderToStaticMarkup(
      <CloudTools
        cloudStatus="Ready"
        uploadToCloud={() => {}}
        downloadFromCloud={() => {}}
        adminUser={{ uid: "masked" }}
        authLoading={false}
      />,
    );
    expect(markup).toContain("Upload To Cloud");
    expect(markup).toContain("Download Cloud Data");
    expect(markup).not.toContain("Clear Cloud Data");
  });

  test("renders Clear only in the advanced danger card", () => {
    const markup = renderToStaticMarkup(
      <AdvancedCloudTools
        clearCloudData={() => {}}
        adminUser={{ uid: "masked" }}
        authLoading={false}
      />,
    );
    expect(markup).toContain("อันตราย / กู้คืนระบบ");
    expect(markup).toContain("Clear Cloud Data");
  });

  test("keeps advanced tools collapsed by default", () => {
    const markup = renderToStaticMarkup(
      <AdvancedSystemToolsSection>
        <span>Migration</span>
      </AdvancedSystemToolsSection>,
    );
    expect(markup).toContain("<details");
    expect(markup).not.toContain("<details open");
    expect(markup).toContain("แสดงเครื่องมือขั้นสูง");
  });
});
