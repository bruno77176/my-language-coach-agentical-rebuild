// Constants for the iOS Universal Links + Android App Links well-known files.
// Values must match apps/mobile/app.config.ts exactly. Bundle IDs and Team ID
// changes ship with an app rebuild — keep these in sync at that time.

export const IOS_APP_ID = "428X7TF9S6.com.brunomoise.mylanguagecoach";
export const ANDROID_PACKAGE = "com.anonymous.mylanguagecoach";

export type AppleAppSiteAssociation = {
  applinks: {
    apps: string[];
    details: Array<{ appID: string; paths: string[] }>;
  };
};

export type AssetLinks = Array<{
  relation: string[];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}>;

export function buildAppleAppSiteAssociation(): AppleAppSiteAssociation {
  return {
    applinks: {
      apps: [],
      details: [
        {
          appID: IOS_APP_ID,
          paths: ["/auth/*"],
        },
      ],
    },
  };
}

export function buildAssetLinks(sha256Fingerprint: string): AssetLinks {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: [sha256Fingerprint],
      },
    },
  ];
}
