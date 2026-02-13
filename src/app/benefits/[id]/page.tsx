import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllBenefits, getBenefitById, getRelatedBenefits } from '@/lib/benefits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Metadata } from 'next';
import type { Category } from '@/types/benefit';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const benefits = getAllBenefits();
  return benefits.map((benefit) => ({
    id: benefit.id,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const benefit = getBenefitById(id);

  if (!benefit) {
    return {
      title: '혜택을 찾을 수 없습니다',
    };
  }

  return {
    title: `${benefit.서비스명} | 맘편해`,
    description: benefit.서비스목적요약,
  };
}

const categoryColors: Record<Category, string> = {
  임신: 'bg-pink-100 text-pink-800 hover:bg-pink-100',
  출산: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  양육: 'bg-green-100 text-green-800 hover:bg-green-100',
};

function renderTextWithLineBreaks(text: string) {
  return text.split(/\r\n|\n/).map((line, i) => (
    <span key={i}>
      {line}
      {i < text.split(/\r\n|\n/).length - 1 && <br />}
    </span>
  ));
}

export default async function BenefitDetailPage({ params }: PageProps) {
  const { id } = await params;
  const benefit = getBenefitById(id);

  if (!benefit) {
    notFound();
  }

  const relatedBenefits = getRelatedBenefits(benefit, 4);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back button */}
      <div className="mb-6">
        <Link href="/benefits">
          <Button variant="outline" size="sm">
            ← 목록으로 돌아가기
          </Button>
        </Link>
      </div>

      {/* Title and badges */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">{benefit.서비스명}</h1>
        <div className="flex flex-wrap gap-2 mb-4">
          {benefit._categories.map((cat) => (
            <Badge key={cat} className={categoryColors[cat as Category]}>
              {cat}
            </Badge>
          ))}
          <Badge variant="outline">{benefit._region}</Badge>
        </div>
      </div>

      {/* Summary card */}
      <Card className="mb-8 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-lg leading-relaxed whitespace-pre-line">
            {renderTextWithLineBreaks(benefit.서비스목적요약)}
          </p>
        </CardContent>
      </Card>

      {/* Detail sections */}
      <div className="space-y-6">
        {/* 지원내용 */}
        {benefit.지원내용 && (
          <>
            <section>
              <h2 className="text-2xl font-semibold mb-3">지원내용</h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {renderTextWithLineBreaks(benefit.지원내용)}
              </div>
            </section>
            <Separator />
          </>
        )}

        {/* 지원대상 */}
        {benefit.지원대상 && (
          <>
            <section>
              <h2 className="text-2xl font-semibold mb-3">지원대상</h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {renderTextWithLineBreaks(benefit.지원대상)}
              </div>
            </section>
            <Separator />
          </>
        )}

        {/* 선정기준 */}
        {benefit.선정기준 && (
          <>
            <section>
              <h2 className="text-2xl font-semibold mb-3">선정기준</h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {renderTextWithLineBreaks(benefit.선정기준)}
              </div>
            </section>
            <Separator />
          </>
        )}

        {/* 신청방법/신청기한 */}
        {(benefit.신청방법 || benefit.신청기한) && (
          <>
            <section>
              <h2 className="text-2xl font-semibold mb-3">신청방법 및 신청기한</h2>
              <div className="space-y-2 text-gray-700">
                {benefit.신청방법 && (
                  <div>
                    <span className="font-medium">신청방법: </span>
                    <span className="whitespace-pre-line">
                      {renderTextWithLineBreaks(benefit.신청방법)}
                    </span>
                  </div>
                )}
                {benefit.신청기한 && (
                  <div>
                    <span className="font-medium">신청기한: </span>
                    <span className="whitespace-pre-line">
                      {renderTextWithLineBreaks(benefit.신청기한)}
                    </span>
                  </div>
                )}
              </div>
            </section>
            <Separator />
          </>
        )}

        {/* 접수기관/전화문의 */}
        {(benefit.접수기관 || benefit.전화문의) && (
          <>
            <section>
              <h2 className="text-2xl font-semibold mb-3">접수기관 및 문의</h2>
              <div className="space-y-2 text-gray-700">
                {benefit.접수기관 && (
                  <div>
                    <span className="font-medium">접수기관: </span>
                    <span className="whitespace-pre-line">
                      {renderTextWithLineBreaks(benefit.접수기관)}
                    </span>
                  </div>
                )}
                {benefit.전화문의 && (
                  <div>
                    <span className="font-medium">전화문의: </span>
                    <span className="whitespace-pre-line">
                      {renderTextWithLineBreaks(benefit.전화문의)}
                    </span>
                  </div>
                )}
              </div>
            </section>
            <Separator />
          </>
        )}
      </div>

      {/* CTA button */}
      {benefit.상세조회URL && (
        <div className="mt-8 flex justify-center">
          <Link href={benefit.상세조회URL} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="px-8">
              정부24에서 자세히 보기 →
            </Button>
          </Link>
        </div>
      )}

      {/* Related benefits */}
      {relatedBenefits.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-6">관련 혜택</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedBenefits.map((related) => (
              <Link key={related.id} href={`/benefits/${related.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">{related.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {related.summary}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {related.categories.map((cat) => (
                        <Badge
                          key={cat}
                          variant="secondary"
                          className={categoryColors[cat as Category]}
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
