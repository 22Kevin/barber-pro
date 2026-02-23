import { useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export function useGoogleAuth(onSuccess: (user: GoogleUserInfo) => void) {
  // Gera o redirectUri correto para cada plataforma:
  // - Web: usa a URL atual do servidor (ex: https://8081-xxx.manus.computer)
  // - Nativo (iOS/Android): usa o scheme do app
  // No web, makeRedirectUri sem argumentos usa a URL atual do browser automaticamente
  // No nativo, usa o scheme do app
  const redirectUri = makeRedirectUri(
    Platform.OS !== "web"
      ? { scheme: "manus20260223005104", path: "oauth" }
      : {}
  );

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
    redirectUri,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { authentication } = response;
      if (authentication?.accessToken) {
        fetchUserInfo(authentication.accessToken)
          .then(onSuccess)
          .catch(console.error);
      }
    }
  }, [response]);

  async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  }

  return {
    promptAsync,
    loading: !request,
  };
}
