import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllSido, filterBenefits, getSigunguBySido } from '@/lib/benefits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Metadata } from 'next';
import type { Category } from '@/types/benefit';

interface PageProps {
  params: Promise<{ sido: string; sigungu: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sido, sigungu } = await params;
  const decodedSido = decodeURIComponent(sido);
  const decodedSigungu = decodeURIComponent(sigungu);

  return {
    title: `${decodedSido} ${decodedSigungu} 임산부 혜택 | 맘편해`,
    description: `${decodedSido} ${decodedSigungu}에서 제공하는 임신, 출산, 양육 지원 혜택을 확인하세요.`,
  };
}

const categoryColors: Record<Category, string> = {
  임신: 'bg-pink-100 text-pink-800 hover:bg-pink-100',
  출산: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  양육: 'bg-green-100 text-green-800 hover:bg-green-100',
};

export default async function RegionSigunguPage({ params }: PageProps) {
  const { sido, sigungu } = await params;
  const decodedSido = decodeURIComponent(sido);
  const decodedSigungu = decodeURIComponent(sigungu);

  // Validate sido and sigungu exist
  const allSido = getAllSido();
  if (!allSido.includes(decodedSido)) {
    notFound();
  }

  const districts = getSigunguBySido(decodedSido);
  if (!districts.includes(decodedSigungu)) {
    notFound();
  }

  // Get benefits for this sigungu (includes national + sido + sigungu)
  const benefits = filterBenefits({ sido: decodedSido, sigungu: decodedSigungu });

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex gap-2 mb-4">
          <Link href="/benefits">
            <Button variant="outline" size="sm">
              ← 전체 혜택
            </Button>
          </Link>
          <Link href={`/region/${encodeURIComponent(decodedSido)}`}>
            <Button variant="outline" size="sm">
              {decodedSido}
            </Button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-3">
          {decodedSido} {decodedSigungu} 임산부 혜택
        </h1>
        <p className="text-gray-600 text-lg">
          총 <span className="font-semibold text-blue-600">{benefits.length}개</span>의 혜택이
          있습니다
        </p>
      </div>

      {/* Search link */}
      <div className="mb-6">
        <Link
          href={`/benefits?sido=${encodeURIComponent(decodedSido)}&sigungu=${encodeURIComponent(
            decodedSigungu
          )}`}
        >
          <Button>혜택 검색하기 →</Button>
        </Link>
      </div>

      {/* Benefits list */}
      {benefits.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600">
            현재 등록된 혜택이 없습니다.
            <br />
            전국 단위 혜택과 시도 단위 혜택을 확인해보세요.
          </p>
        </Card>
      ) : (
        <section>
          <h2 className="text-2xl font-semibold mb-6">혜택 목록</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {benefits.map((benefit) => (
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
        </section>
      )}

      {/* Other districts in this sido */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">
          {decodedSido} 다른 지역 혜택 보기
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {districts
            .filter((d) => d !== decodedSigungu)
            .map((d) => (
              <Link
                key={d}
                href={`/region/${encodeURIComponent(decodedSido)}/${encodeURIComponent(d)}`}
              >
                <Button variant="outline" className="w-full justify-start">
                  {d}
                </Button>
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
