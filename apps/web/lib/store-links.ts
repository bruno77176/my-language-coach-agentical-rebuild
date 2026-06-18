export const DEFAULT_IOS_URL = "https://apps.apple.com/app/id6746396786";
export const DEFAULT_ANDROID_URL =
  "https://play.google.com/store/apps/details?id=com.anonymous.mylanguagecoach";

export interface StoreLinks {
  ios: string;
  android: string;
}

export function getStoreLinks(): StoreLinks {
  return {
    ios: process.env.NEXT_PUBLIC_IOS_URL || DEFAULT_IOS_URL,
    android: process.env.NEXT_PUBLIC_ANDROID_URL || DEFAULT_ANDROID_URL,
  };
}
