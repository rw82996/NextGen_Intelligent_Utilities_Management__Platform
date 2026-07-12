import { gridAssets } from "@/lib/data";
import AssetDetailClient from "./asset-detail-client";

// Pre-render one static page per asset for `output: export`.
export function generateStaticParams() {
  return gridAssets.map((a) => ({ id: a.assetId }));
}

export const dynamicParams = false;

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssetDetailClient id={id} />;
}
