-- Row-level security for tables exposed via PostgREST.
-- Server-side Drizzle uses DATABASE_URL (postgres role) and bypasses RLS.
-- Policies target the `authenticated` role when a Clerk JWT is configured in Supabase.

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- books
DROP POLICY IF EXISTS "books_select_own" ON public.books;
CREATE POLICY "books_select_own"
  ON public.books
  FOR SELECT
  TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "books_insert_own" ON public.books;
CREATE POLICY "books_insert_own"
  ON public.books
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "books_update_own" ON public.books;
CREATE POLICY "books_update_own"
  ON public.books
  FOR UPDATE
  TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "books_delete_own" ON public.books;
CREATE POLICY "books_delete_own"
  ON public.books
  FOR DELETE
  TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'));

-- chapters (scoped via parent book)
DROP POLICY IF EXISTS "chapters_select_own" ON public.chapters;
CREATE POLICY "chapters_select_own"
  ON public.chapters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = chapters.book_id
        AND books.user_id = (auth.jwt() ->> 'sub')
    )
  );

DROP POLICY IF EXISTS "chapters_insert_own" ON public.chapters;
CREATE POLICY "chapters_insert_own"
  ON public.chapters
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = chapters.book_id
        AND books.user_id = (auth.jwt() ->> 'sub')
    )
  );

DROP POLICY IF EXISTS "chapters_update_own" ON public.chapters;
CREATE POLICY "chapters_update_own"
  ON public.chapters
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = chapters.book_id
        AND books.user_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = chapters.book_id
        AND books.user_id = (auth.jwt() ->> 'sub')
    )
  );

DROP POLICY IF EXISTS "chapters_delete_own" ON public.chapters;
CREATE POLICY "chapters_delete_own"
  ON public.chapters
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = chapters.book_id
        AND books.user_id = (auth.jwt() ->> 'sub')
    )
  );

-- assets (scoped via parent book)
DROP POLICY IF EXISTS "assets_select_own" ON public.assets;
CREATE POLICY "assets_select_own"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = assets.book_id
        AND books.user_id = (auth.jwt() ->> 'sub')
    )
  );

DROP POLICY IF EXISTS "assets_insert_own" ON public.assets;
CREATE POLICY "assets_insert_own"
  ON public.assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = assets.book_id
        AND books.user_id = (auth.jwt() ->> 'sub')
    )
  );

DROP POLICY IF EXISTS "assets_update_own" ON public.assets;
CREATE POLICY "assets_update_own"
  ON public.assets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = assets.book_id
        AND books.user_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = assets.book_id
        AND books.user_id = (auth.jwt() ->> 'sub')
    )
  );

DROP POLICY IF EXISTS "assets_delete_own" ON public.assets;
CREATE POLICY "assets_delete_own"
  ON public.assets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = assets.book_id
        AND books.user_id = (auth.jwt() ->> 'sub')
    )
  );
