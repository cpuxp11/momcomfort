import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-pink-100 bg-white/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center min-h-[44px]">
          <span className="text-2xl font-bold text-pink-600">맘편해</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <Button variant="ghost" asChild size="lg" className="text-base hover:text-pink-600 hover:bg-pink-50 min-h-[44px]">
            <Link href="/timeline">타임라인</Link>
          </Button>
          <Button variant="ghost" asChild size="lg" className="text-base hover:text-pink-600 hover:bg-pink-50 min-h-[44px]">
            <Link href="/benefits">혜택 검색</Link>
          </Button>
          <Button variant="ghost" asChild size="lg" className="text-base hover:text-pink-600 hover:bg-pink-50 min-h-[44px]">
            <Link href="/health-centers">보건소</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
