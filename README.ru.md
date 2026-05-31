<div align="right">
  <a href="README.md">English</a> | <a href="README.ru.md">Русский</a>
</div>

<div align="center">
  <br />
  <img src="public/icon.svg" alt="Bookified" width="96" height="96" />
  <br />
  <h1>Bookified</h1>
  <p><strong>Личная библиотека электронных книг с офлайн-чтением и AI-ассистентом</strong></p>
  <br />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <br />
  <img src="https://img.shields.io/badge/Clerk-Auth-6C47FF?style=for-the-badge&logo=clerk&logoColor=white" alt="Clerk" />
  <img src="https://img.shields.io/badge/Supabase-Storage-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Postgres-Drizzle-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="Postgres" />
  <br />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Gemini-AI-8E75B2?style=for-the-badge&logo=google&logoColor=white" alt="Gemini" />
</div>

---

## О проекте

**Bookified** — веб-приложение для хранения и чтения собственных электронных книг. Загружайте файлы, управляйте библиотекой, читайте в браузере с настройкой типографики, сохраняйте прогресс локально и синхронизируйте метаданные после входа. Встроенный AI-ассистент отвечает на вопросы по текущей книге и главе с помощью Google Gemini.

Интерфейс на **русском** и **английском** (`next-intl`, префикс локали в URL: `/ru/...`, `/en/...`).

### Основные маршруты

| Маршрут                     | Описание                                                             |
| --------------------------- | -------------------------------------------------------------------- |
| `/[locale]/library`         | Библиотека: поиск, фильтры, избранное, офлайн-загрузка               |
| `/[locale]/add-book`        | Загрузка новой книги                                                 |
| `/[locale]/reader/[bookId]` | Ридер: потоковый текст (EPUB/FB2/TXT) или PDF                        |
| `/[locale]`                 | Домашняя страница ридера; при возможности открывает последнюю сессию |

---

## Возможности

- **Загрузка нескольких форматов** — EPUB, FB2, PDF, TXT (до 100 MB на файл)
- **Парсинг** — главы, оглавление, обложки, встроенные шрифты и изображения в Supabase Storage
- **Ридер с вёрсткой** — типографика (шрифт, размер, межстрочный интервал, поля), TOC, тулбар выделения (копировать / спросить AI)
- **PDF-ридер** — постраничная навигация, масштаб, подгонка по ширине, стрелки на клавиатуре
- **Библиотека** — сетка и список, поиск, фильтры по статусу (читаю / прочитано / избранное), сортировка
- **Офлайн** — IndexedDB (Dexie): кэш книг и прогресс; локальные книги доступны без входа
- **Облачная синхронизация** — после входа через Clerk метаданные библиотеки в Postgres, файлы в Supabase
- **AI-ассистент** — стриминг-чат с контекстом книги/главы; для длинных глав — релевантные фрагменты (~2500 слов); быстрая модель для коротких вопросов
- **Темы** — светлая / тёмная (`next-themes`)
- **Защита от дублей** — по хэшу содержимого и идентификатору при загрузке

---

## Технологический стек

| Слой           | Технология                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| Фреймворк      | [Next.js 16](https://nextjs.org/) (App Router, Route Handlers)                                                  |
| UI             | [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) |
| Аутентификация | [Clerk](https://clerk.com/)                                                                                     |
| База данных    | [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/)                            |
| Файлы          | [Supabase Storage](https://supabase.com/storage)                                                                |
| Офлайн         | [Dexie](https://dexie.org/) (IndexedDB)                                                                         |
| i18n           | [next-intl](https://next-intl-docs.vercel.app/)                                                                 |
| AI             | [Vercel AI SDK](https://sdk.vercel.ai/) + `@ai-sdk/google` (Gemini)                                             |
| PDF            | [react-pdf](https://github.com/wojtekmaj/react-pdf) + pdfjs-dist                                                |
| EPUB           | [@lingo-reader/epub-parser](https://www.npmjs.com/package/@lingo-reader/epub-parser), cheerio                   |

Опционально (локально): **Playwright** для браузерного извлечения типографики EPUB (`BOOKIFIED_PLAYWRIGHT_TYPOGRAPHY`).

---

## Поддерживаемые форматы

| Формат | Загрузка | Чтение      | Примечание                        |
| ------ | -------- | ----------- | --------------------------------- |
| EPUB   | Да       | Потоковый   | Полный pipeline, своя типографика |
| FB2    | Да       | Потоковый   | В т.ч. `.fb2.zip`                 |
| PDF    | Да       | Постранично | Просмотр через pdf.js             |
| TXT    | Да       | Потоковый   | Обычный текст                     |

---

## Требования

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/) (рекомендуется) или Node.js 20+
- [PostgreSQL](https://www.postgresql.org/) — например, Supabase Postgres
- Проект [Supabase](https://supabase.com/) с **Storage** bucket
- Приложение [Clerk](https://clerk.com/)
- API-ключ [Google AI](https://aistudio.google.com/) для ассистента

---

## Быстрый старт

### 1. Клонирование и установка

```bash
git clone https://github.com/l4ught3r/Bookified.git
cd Bookified
bun install
```

### 2. Переменные окружения

Создайте `.env` в корне проекта:

````env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Postgres (строка подключения Supabase, Drizzle)
DATABASE_URL=postgresql://...

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_SECRET_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_BUCKET_NAME=bookified

# Gemini (AI-ассистент)
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash
GEMINI_MODEL_FAST=gemini-3.1-flash-lite

### 3. База данных

```bash
bun run db:push
bun run db:apply-rls
````

### 4. Локальный запуск

```bash
bun run dev
```

Откройте [http://localhost:3000](http://localhost:3000) — произойдёт редирект на `/en` или `/ru`.

---
