import type { Session } from "@supabase/supabase-js";
import { useAuthStore } from "./auth-store";

export type IdentityProvider = "email" | "google" | "apple";

export type Identity = {
  id: string;
  identityId: string;
  provider: IdentityProvider;
};

export function identitiesFromSession(session: Session | null): Identity[] {
  const raw = session?.user?.identities ?? [];
  return raw
    .map((i) => {
      const provider = i.provider as string;
      if (
        provider !== "email" &&
        provider !== "google" &&
        provider !== "apple"
      ) {
        return null;
      }
      return {
        id: i.id,
        identityId: (i as { identity_id?: string }).identity_id ?? i.id,
        provider: provider as IdentityProvider,
      };
    })
    .filter((x): x is Identity => x !== null);
}

export function canUnlink(all: Identity[], _target: Identity): boolean {
  return all.length > 1;
}

export function useIdentities(): Identity[] {
  const session = useAuthStore((s) => s.session);
  return identitiesFromSession(session);
}
