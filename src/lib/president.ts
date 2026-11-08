import { queryOptions } from "@tanstack/react-query";
import { getPublicPresident } from "./president.functions";

export const presidentQuery = queryOptions({
  queryKey: ["president-public"],
  queryFn: () => getPublicPresident(),
  staleTime: 0,
});
export type PresidentMessage = NonNullable<Awaited<ReturnType<typeof getPublicPresident>>>;