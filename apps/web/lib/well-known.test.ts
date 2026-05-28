import { describe, expect, it } from "vitest";
import {
  buildAppleAppSiteAssociation,
  buildAssetLinks,
  IOS_APP_ID,
  ANDROID_PACKAGE,
} from "./well-known";

describe("buildAppleAppSiteAssociation", () => {
  it("returns AASA shape claiming /auth/* for the iOS app", () => {
    const aasa = buildAppleAppSiteAssociation();
    expect(aasa).toEqual({
      applinks: {
        apps: [],
        details: [
          {
            appID: IOS_APP_ID,
            paths: ["/auth/*"],
          },
        ],
      },
    });
  });

  it("uses the correct Team ID + bundle ID", () => {
    expect(IOS_APP_ID).toBe("428X7TF9S6.com.brunomoise.mylanguagecoach");
  });
});

describe("buildAssetLinks", () => {
  it("returns Digital Asset Links shape for the Android package", () => {
    const links = buildAssetLinks("AB:CD:EF");
    expect(links).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: ANDROID_PACKAGE,
          sha256_cert_fingerprints: ["AB:CD:EF"],
        },
      },
    ]);
  });

  it("uses the correct Android package name", () => {
    expect(ANDROID_PACKAGE).toBe("com.anonymous.mylanguagecoach");
  });
});
