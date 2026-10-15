<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Kindred architecture rules
- Server logic uses TanStack `createServerFn` in `src/lib/*.functions.ts` (never Supabase Edge Functions); privileged helpers live in `*.server.ts` and load `supabaseAdmin` inside handlers — keeps service role out of the client bundle.
- Design tokens are defined only in `src/styles.css` (locked names `--bg --surface --brand …` aliased to shadcn names); feature code uses token classes only — keeps light/dark consistent.
- Page shells come from `src/components/layout/page.tsx` (StandardPage/WidePage/DetailPage/WorkspacePage/Section); feature code never writes its own h1/h2 or page shell.
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate); roles are checked on the server with `has_role()`, UI role checks are cosmetic only.
- Demo accounts use the `@demo.kindred.app` domain and are created on demand by `demoSignIn`; they are excluded from the first-user-becomes-admin rule.
