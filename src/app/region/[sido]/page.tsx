import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllSido, filterBenefits, getSigunguBySido } from '@/lib/benefits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Metadata } from 'next';
import type { Category } from '@/types/benefit';

interface PageProps {
  params: Promise<{ sido: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sido } = await params;
  const decodedSido = decodeURIComponent(sido);

  return {
    title: `${decodedSido} 임산부 혜택 | 맘편해`,
    description: `${decodedSido}에서 제공하는 임신, 출산, 양육 지원 혜택을 확인하세요.`,
  };
}

const categoryColors: Record<Category, string> = {
  임신: 'bg-pink-100 text-pink-800 hover:bg-pink-100',
  출산: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  양육: 'bg-green-100 text-green-800 hover:bg-green-100',
};

export default async function RegionSidoPage({ params }: PageProps) {
  const { sido } = await params;
  const decodedSido = decodeURIComponent(sido);

  // Validate sido exists
  const allSido = getAllSido();
  if (!allSido.includes(decodedSido)) {
    notFound();
  }

  // Get benefits for this sido (includes national + sido + all sigungu)
  const benefits = filterBenefits({ sido: decodedSido });
  const districts = getSigunguBySido(decodedSido);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/benefits">
          <Button variant="outline" size="sm" className="mb-4">
            ← 전체 혜택 보기
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-3">{decodedSido} 임산부 혜택</h1>
        <p className="text-gray-600 text-lg">
          총 <span className="font-semibold text-blue-600">{benefits.length}개</span>의 혜택이
          있습니다
        </p>
      </div>

      {/* Search link */}
      <div className="mb-6">
        <Link href={`/benefits?sido=${encodeURIComponent(decodedSido)}`}>
          <Button>혜택 검색하기 →</Button>
        </Link>
      </div>

      {/* Districts list */}
      {districts.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>시군구별 혜택 보기</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {districts.map((sigungu) => (
                <Link
                  key={sigungu}
                  href={`/region/${encodeURIComponent(decodedSido)}/${encodeURIComponent(
                    sigungu
                  )}`}
                >
                  <Button variant="outline" className="w-full justify-start">
                    {sigungu}
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benefits preview */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">혜택 목록</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {benefits.slice(0, 12).map((benefit) => (
            <Link key={benefit.id} href={`/benefits/${benefit.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <CardTitle className="text-lg">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {benefit.summary}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {benefit.categories.map((cat) => (
                      <Badge
                        key={cat}
                        variant="secondary"
                        className={categoryColors[cat as Category]}
                      >
                        {cat}
                      </Badge>
                    ))}
                    {benefit.sigungu && (
                      <Badge variant="outline">{benefit.sigungu}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {benefits.length > 12 && (
          <div className="mt-6 text-center">
            <Link href={`/benefits?sido=${encodeURIComponent(decodedSido)}`}>
              <Button variant="outline">
                전체 {benefits.length}개 혜택 보기 →
              </Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
