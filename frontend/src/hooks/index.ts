import { useMutation } from "@tanstack/react-query";
import api from "../lib/api";
import type {
  UserProfile,
  ChatMessage,
  GenerateResponse,
  UpgradeResponse,
} from "../types";

export function useGenerate() {
  return useMutation<
    GenerateResponse,
    Error,
    | { mode: "wizard"; profile: UserProfile }
    | { mode: "chat"; messages: ChatMessage[] }
  >({
    mutationFn: (body) =>
      api.post("/api/v1/generate", body).then((r) => r.data),
  });
}

export function useUpgrade() {
  return useMutation<UpgradeResponse, Error, { raw_prompt: string }>({
    mutationFn: (body) => api.post("/api/v1/upgrade", body).then((r) => r.data),
  });
}

export function useLogin() {
  return useMutation<
    { access_token: string },
    Error,
    { email: string; password: string }
  >({
    mutationFn: (body) =>
      api.post("/api/v1/auth/login", body).then((r) => r.data),
  });
}

export function useRegister() {
  return useMutation<
    { access_token: string },
    Error,
    { email: string; password: string }
  >({
    mutationFn: (body) =>
      api.post("/api/v1/auth/register", body).then((r) => r.data),
  });
}

export function useFeedback() {
  return useMutation<
    { ok: boolean },
    Error,
    { prompt_id?: string; rating: number; comment?: string }
  >({
    mutationFn: (body) =>
      api.post("/api/v1/feedback", body).then((r) => r.data),
  });
}

export function useContact() {
  return useMutation<
    { ok: boolean },
    Error,
    { name: string; email: string; message: string }
  >({
    mutationFn: (body) => api.post("/api/v1/contact", body).then((r) => r.data),
  });
}
