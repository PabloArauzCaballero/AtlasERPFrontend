import { Card, CardTitle } from './card';

interface BackendGapProps {
  title: string;
  missingContract: string;
  recommendedEndpoint: string;
}

export function BackendGap({ missingContract, recommendedEndpoint, title }: BackendGapProps) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardTitle>{title}</CardTitle>
      <p className="mt-2 text-sm text-red-700">{missingContract}</p>
      <p className="mt-4 rounded-lg bg-white p-3 font-mono text-xs text-on-surface-variant">{recommendedEndpoint}</p>
    </Card>
  );
}
