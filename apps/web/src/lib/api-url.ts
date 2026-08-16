import { getWebEnv } from "../config/env";

export function absoluteApiUrl(path: string): string {
  return new URL(path, getWebEnv().NEXT_PUBLIC_API_URL).toString();
}
