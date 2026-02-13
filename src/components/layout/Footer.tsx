export default function Footer() {
  return (
    <footer className="border-t border-pink-100 bg-white/60 py-8">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center space-y-4 text-center">
          {/* Data source */}
          <div className="text-sm text-muted-foreground">
            <p>데이터 출처: <span className="font-medium text-foreground">보조금24 (행정안전부)</span></p>
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground max-w-2xl">
            <p>
              본 서비스는 정부 공공데이터를 기반으로 제공되며, 실제 혜택의 신청 자격, 절차, 금액 등은
              해당 기관의 공식 홈페이지에서 반드시 확인해 주시기 바랍니다.
            </p>
          </div>

          {/* Copyright */}
          <div className="text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} 맘편해. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
