import type { CSSProperties } from "react";
import Link from "next/link";
import { Fira_Sans } from "next/font/google";
import { ExppBrand } from "@/lib/ui/expp-brand";

const bodyFont = Fira_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

const featureItems = [
  {
    title: "Генератор заданий",
    description:
      "Собирает работу из ваших материалов, критериев и уровня группы за пару минут.",
    accentClassName: "from-cyan-400/25 to-cyan-500/5",
  },
  {
    title: "Проверка и аналитика",
    description:
      "Автопроверка, разбор типичных ошибок и прозрачные отчеты по каждому ученику и теме.",
    accentClassName: "from-sky-400/20 to-sky-500/5",
  },
  {
    title: "Единый рабочий контур",
    description:
      "Материалы, задания, дедлайны и история действий в одном месте для учителя, ученика и администратора.",
    accentClassName: "from-emerald-400/20 to-emerald-500/5",
  },
];

const workflowSteps = [
  {
    title: "Подключение школы",
    description: "Импорт классов, ролей и предметов. Без ручной рутины и таблиц.",
  },
  {
    title: "Запуск заданий",
    description: "Учитель создает и назначает работу, система автоматически собирает версии.",
  },
  {
    title: "Рост результатов",
    description: "Платформа подсвечивает слабые зоны и помогает корректировать программу.",
  },
];

interface PlatformLandingProps {
  notFound?: boolean;
}

export function PlatformLanding({ notFound = false }: PlatformLandingProps) {
  const titleText = notFound
    ? "Маршрут потерялся, но EXPP на месте"
    : "Платформа, где обучение, задания и аналитика работают как одна система";
  const descriptionText = notFound
    ? "Запрошенной страницы нет. Вернитесь в рабочее пространство или откройте главную витрину платформы."
    : "EXPP объединяет генерацию материалов, проверку работ и живую аналитику, чтобы школа двигалась быстрее без потери качества.";
  const primaryHref = notFound ? "/" : "/sign-up";
  const primaryLabel = notFound ? "На главную" : "Запустить платформу";
  const secondaryHref = "/sign-in";
  const secondaryLabel = notFound ? "Войти в кабинет" : "Войти";

  return (
    <main
      className={`${bodyFont.className} platform-shell relative isolate min-h-screen overflow-x-hidden bg-[var(--platform-canvas)] text-[var(--platform-text)]`}
    >
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-14 pt-6 md:px-10">
        <header className="flex items-center justify-between">
          <div className="platform-reveal">
            <ExppBrand href="/" />
          </div>
          <nav
            className="platform-reveal hidden items-center gap-6 text-sm text-[var(--platform-muted)] md:flex"
            style={{ animationDelay: "120ms" } as CSSProperties}
          >
            <Link href="/platform#features" className="transition-colors hover:text-[var(--platform-text)]">
              Возможности
            </Link>
            <Link href="/platform#flow" className="transition-colors hover:text-[var(--platform-text)]">
              Как это работает
            </Link>
            <Link href="/sign-in" className="rounded-md border border-white/20 px-4 py-2 text-[var(--platform-text)]">
              Войти
            </Link>
          </nav>
        </header>

        <section className="mt-14 grid flex-1 gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <h1
              className="platform-reveal font-sans text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl"
              style={{ animationDelay: "240ms" } as CSSProperties}
            >
              {titleText}
            </h1>
            <p
              className="platform-reveal max-w-2xl text-base leading-relaxed text-[var(--platform-muted)] sm:text-lg"
              style={{ animationDelay: "320ms" } as CSSProperties}
            >
              {descriptionText}
            </p>

            <div
              className="platform-reveal flex flex-wrap gap-3"
              style={{ animationDelay: "380ms" } as CSSProperties}
            >
              <Link
                href={primaryHref}
                className="rounded-md bg-[var(--platform-accent)] px-6 py-3 text-sm font-semibold text-slate-950 transition-colors duration-150 hover:bg-[var(--platform-accent-strong)]"
              >
                {primaryLabel}
              </Link>
              <Link
                href={secondaryHref}
                className="rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {secondaryLabel}
              </Link>
            </div>

            <dl
              className="platform-reveal grid max-w-xl gap-4 text-sm text-[var(--platform-muted)] sm:grid-cols-3"
              style={{ animationDelay: "440ms" } as CSSProperties}
            >
              <div className="border-t border-white/15 px-1 py-3">
                <dt className="text-xs uppercase tracking-wide text-cyan-100/90">До</dt>
                <dd className="mt-1 text-xl font-semibold text-white">70%</dd>
                <dd>экономии времени учителя</dd>
              </div>
              <div className="border-t border-white/15 px-1 py-3">
                <dt className="text-xs uppercase tracking-wide text-cyan-100/90">x3</dt>
                <dd className="mt-1 text-xl font-semibold text-white">скорость</dd>
                <dd>обратной связи ученику</dd>
              </div>
              <div className="border-t border-white/15 px-1 py-3">
                <dt className="text-xs uppercase tracking-wide text-cyan-100/90">24/7</dt>
                <dd className="mt-1 text-xl font-semibold text-white">доступ</dd>
                <dd>к материалам и результатам</dd>
              </div>
            </dl>
          </div>

          <aside
            className="platform-reveal border border-[var(--platform-border)] bg-[var(--platform-surface)] p-5"
            style={{ animationDelay: "320ms" } as CSSProperties}
          >
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-cyan-100/80">
              <span>Контрольный центр</span>
              <span className="border border-emerald-300/25 px-2 py-1 text-emerald-100">Онлайн</span>
            </div>
            <div className="mt-5 space-y-3">
              <div className="border-t border-white/10 p-4">
                <p className="text-sm text-[var(--platform-muted)]">Активные классы</p>
                <p className="mt-1 text-3xl font-semibold text-white">128</p>
              </div>
              <div className="border-t border-white/10 p-4">
                <p className="text-sm text-[var(--platform-muted)]">Проверено работ за сутки</p>
                <p className="mt-1 text-3xl font-semibold text-white">2 946</p>
              </div>
              <div className="border-t border-white/10 p-4">
                <p className="text-sm text-[var(--platform-muted)]">Средний отклик системы</p>
                <p className="mt-1 text-3xl font-semibold text-white">1.8 c</p>
              </div>
            </div>
          </aside>
        </section>

        <section id="features" className="mt-14 grid gap-4 md:grid-cols-3">
          {featureItems.map((item, index) => (
            <article
              key={item.title}
              className="platform-reveal border-t border-white/10"
              style={{ animationDelay: `${520 + index * 90}ms` } as CSSProperties}
            >
              <div className="space-y-3 p-5">
                <h2 className="font-sans text-xl font-semibold text-white">{item.title}</h2>
                <p className="text-sm leading-relaxed text-[var(--platform-muted)]">{item.description}</p>
              </div>
            </article>
          ))}
        </section>

        <section id="flow" className="mt-12 grid gap-4 md:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <article
              key={step.title}
              className="platform-reveal border-t border-white/10 p-5"
              style={{ animationDelay: `${780 + index * 90}ms` } as CSSProperties}
            >
              <h3 className="font-sans text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--platform-muted)]">{step.description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
