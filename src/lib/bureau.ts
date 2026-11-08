import { queryOptions } from "@tanstack/react-query";
import { getPublicBureau } from "./bureau.functions";

export const bureauQuery = queryOptions({
  queryKey: ["bureau-public"],
  queryFn: () => getPublicBureau(),
  staleTime: 60_000,
});
