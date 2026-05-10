import { useMutation } from "@tanstack/react-query";
import { translateMessageApi } from "./api-translate";

export function useTranslateMessage() {
  return useMutation({
    mutationFn: (messageId: string) => translateMessageApi(messageId),
  });
}
