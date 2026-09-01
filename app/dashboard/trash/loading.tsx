import { ModulePageSkeleton } from "@/components/ui/loading-states";

export default function Loading() {
  return <ModulePageSkeleton titleWidth="w-64" subtitleWidth="w-96" rows={7} cols={5} />;
}
