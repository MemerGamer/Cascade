import { createAuthClient } from "better-auth/react";
import { API_URLS } from "../lib/config";

export const authClient = createAuthClient({
  baseURL: API_URLS.AUTH,
  fetchOptions: {
    credentials: "include",
  },
});
