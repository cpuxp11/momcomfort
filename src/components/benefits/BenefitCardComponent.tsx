import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BenefitCard } from '@/types/benefit';
import { STAGE_CONFIG } from '@/lib/constants';

interface BenefitCardComponentProps {
  benefit: BenefitCard;
}

export default function BenefitCardComponent({ benefit }: BenefitCardComponentProps) {
  const regionText = benefit.sido === '전국'
    ? '전국'
    : benefit.sigungu
      ? `${benefit.sido} ${benefit.sigungu}`
      : benefit.sido;

  return (
    <Link href={`/benefits/${benefit.id}`} className="block h-full">
      <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50">
        <CardHeader>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {benefit.categories.map(category => {
              const config = STAGE_CONFIG[category];
              return (
                <Badge
                  key={category}
                  variant="outline"
                  className={`${config.bgColor} ${config.color} border text-xs`}
                >
                  <span className="mr-1">{config.icon}</span>
                  {config.label}
                </Badge>
              );
            })}
          </div>
          <CardTitle className="text-lg font-semibold leading-tight">
            {benefit.title}
          </CardTitle>
          <CardDescription className="line-clamp-2 text-sm mt-2">
            {benefit.summary}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium">기관:</span>
              <span>{benefit.orgName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">지역:</span>
              <span>{regionText}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
