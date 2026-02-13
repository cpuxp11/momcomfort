import { getHealthCentersByRegion, getAllHealthCenters } from '@/lib/health-centers';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '우리 동네 보건소 | 맘편해',
  description: '전국 지자체 보건소 임산부 서비스 페이지 바로가기',
};

export default function HealthCentersPage() {
  const healthCentersByRegion = getHealthCentersByRegion();
  const totalCount = getAllHealthCenters().length;

  // Sort regions alphabetically
  const regions = Object.keys(healthCentersByRegion).sort((a, b) =>
    a.localeCompare(b, 'ko')
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-3">우리 동네 보건소</h1>
        <p className="text-gray-600 text-lg">
          전국 <span className="font-semibold text-blue-600">{totalCount}개</span> 지자체 보건소
          임산부 서비스 페이지 바로가기
        </p>
      </div>

      {/* Info card */}
      <Card className="mb-8 bg-blue-50 border-blue-200 p-6">
        <p className="text-gray-700 leading-relaxed">
          각 지역 보건소에서 제공하는 임산부 지원 서비스를 확인하세요.
          <br />
          산전검사, 출산준비교실, 엽산제 지원 등 다양한 혜택이 있습니다.
        </p>
      </Card>

      {/* Accordion by region */}
      <Accordion type="single" collapsible className="w-full">
        {regions.map((region) => {
          const centers = healthCentersByRegion[region];
          return (
            <AccordionItem key={region} value={region}>
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                  <span>{region}</span>
                  <span className="text-sm font-normal text-gray-500">
                    ({centers.length}개)
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {centers.map((center) => (
                    <Link
                      key={center.district}
                      href={center.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-3 px-4 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="text-left w-full">
                          <div className="font-medium">{center.district}</div>
                          {center.category && (
                            <div className="text-xs text-gray-500 mt-1">
                              {center.category}
                            </div>
                          )}
                        </div>
                      </Button>
                    </Link>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Back to home */}
      <div className="mt-8 text-center">
        <Link href="/">
          <Button variant="outline">홈으로 돌아가기</Button>
        </Link>
      </div>
    </div>
  );
}
