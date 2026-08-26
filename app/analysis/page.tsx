import AnalysisPage from "@/components/AnalysisPage";

export default async function AnalysisRoute({ searchParams }: { searchParams: Promise<{ steamid?: string; consent?: string }> }) {
  const params = await searchParams;
  return <AnalysisPage steamid={params.steamid ?? ""} consent={params.consent === "1"} />;
}
