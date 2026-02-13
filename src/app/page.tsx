import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTotalCount, getCategoryCounts, getAllSido } from "@/lib/benefits";
import { ArrowRight, Baby, Heart, Home as HomeIcon } from "lucide-react";

export default function HomePage() {
  const totalCount = getTotalCount();
  const categoryCounts = getCategoryCounts();
  const sidoCount = getAllSido().length;

  // Count health centers (this is a placeholder - update when you have actual health center data)
  const healthCenterCount = 104;

  // Stage data
  const stages = [
    {
      id: "임신",
      title: "임신",
      emoji: "🤰",
      description: "임신 중 받을 수 있는 검진비, 영양제, 교통비 등 다양한 지원 혜택",
      count: categoryCounts["임신"] || 0,
      icon: Heart,
      color: "from-pink-100 to-rose-100",
      hoverColor: "hover:from-pink-200 hover:to-rose-200",
    },
    {
      id: "출산",
      title: "출산",
      emoji: "👶",
      description: "출산 축하금, 의료비 지원, 산후조리 등 출산 시기의 필수 혜택",
      count: categoryCounts["출산"] || 0,
      icon: Baby,
      color: "from-orange-100 to-amber-100",
      hoverColor: "hover:from-orange-200 hover:to-amber-200",
    },
    {
      id: "양육",
      title: "양육",
      emoji: "🍼",
      description: "육아용품, 어린이집, 교육비 등 아이 키우는 데 필요한 모든 지원",
      count: categoryCounts["양육"] || 0,
      icon: HomeIcon,
      color: "from-amber-100 to-yellow-100",
      hoverColor: "hover:from-amber-200 hover:to-yellow-200",
    },
  ];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <section className="mb-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
          엄마가 될 당신을 위한
          <br />
          <span className="text-pink-600">모든 혜택, 한 곳에서</span>
        </h1>
        <p className="mb-8 text-lg text-gray-600 sm:text-xl">
          임신부터 출산, 양육까지. 복잡한 정부 지원 혜택을
          <br className="hidden sm:block" />
          우리 동네 기준으로 쉽고 빠르게 찾아보세요.
        </p>
        <Button asChild size="lg" className="bg-pink-600 hover:bg-pink-700 text-lg px-8 py-6">
          <Link href="/benefits">
            혜택 찾아보기
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </section>

      {/* Stats Bar */}
      <section className="mb-16">
        <Card className="border-pink-200 bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="text-center">
                <div className="text-3xl font-bold text-pink-600">{totalCount.toLocaleString()}개</div>
                <div className="mt-1 text-sm text-muted-foreground">등록된 혜택</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-pink-600">{sidoCount}개</div>
                <div className="mt-1 text-sm text-muted-foreground">시도 지역</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-pink-600">{healthCenterCount}개</div>
                <div className="mt-1 text-sm text-muted-foreground">보건소 정보</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Stage Cards */}
      <section>
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
          단계별로 찾아보기
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {stages.map((stage) => (
            <Link key={stage.id} href={`/benefits?stage=${encodeURIComponent(stage.id)}`}>
              <Card className={`h-full transition-all duration-300 hover:shadow-lg border-pink-200 bg-gradient-to-br ${stage.color} ${stage.hoverColor}`}>
                <CardHeader>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-5xl">{stage.emoji}</span>
                    <stage.icon className="h-8 w-8 text-pink-600" />
                  </div>
                  <CardTitle className="text-2xl">{stage.title}</CardTitle>
                  <CardDescription className="text-base text-gray-700">
                    {stage.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-pink-700">
                      {stage.count.toLocaleString()}개 혜택
                    </span>
                    <ArrowRight className="h-5 w-5 text-pink-600" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Additional Info Section */}
      <section className="mt-16 text-center">
        <Card className="border-pink-200 bg-white/60">
          <CardContent className="pt-6">
            <h3 className="mb-3 text-xl font-bold text-gray-900">
              어디서부터 시작해야 할지 모르겠다면?
            </h3>
            <p className="mb-4 text-gray-600">
              가까운 보건소에서 임신부 등록과 함께 맞춤 상담을 받아보세요.
            </p>
            <Button asChild variant="outline" className="border-pink-300 text-pink-600 hover:bg-pink-50">
              <Link href="/health-centers">
                우리 동네 보건소 찾기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
