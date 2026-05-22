import { SignIn } from "@clerk/nextjs";
import { getTranslations } from "next-intl/server";
import { CLERK_AUTH_APPEARANCE_OVERRIDE } from "@/lib/constants";

const SignInPage = async ({ params }: { params: Promise<{ locale: "en" | "ru" }> }) => {
  const { locale } = await params;
  const t = await getTranslations("Auth");

  return (
    <main className="wrapper container">
      <section className="flex flex-col items-center mb-10">
        <h2 className="text-3xl font-serif font-bold text-[#212a3b] mb-8">{t("signInTitle")}</h2>
        <SignIn
          routing="path"
          path={`/${locale}/sign-in`}
          fallbackRedirectUrl={`/${locale}`}
          appearance={{
            elements: {
              headerTitle: "text-2xl",
              headerSubtitle: "text-sm",
              formFieldLabel: "text-xs",
              formFieldInput: "text-sm",
              formButtonPrimary: "text-sm",
              footerActionText: "text-xs",
              footerActionLink: "text-xs",
              CLERK_AUTH_APPEARANCE_OVERRIDE,
            },
          }}
        />
      </section>
    </main>
  );
};

export default SignInPage;
