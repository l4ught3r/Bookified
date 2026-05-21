import { SignIn } from "@clerk/nextjs";
import { CLERK_AUTH_APPEARANCE_OVERRIDE } from "@/lib/constants";

const SignInPage = () => {
  return (
    <main className="wrapper container">
      <section className="flex flex-col items-center mb-10">
        <h2 className="text-3xl font-serif font-bold text-[#212a3b] mb-8">Sign in</h2>
        <SignIn appearance={{ elements: CLERK_AUTH_APPEARANCE_OVERRIDE }} />
      </section>
    </main>
  );
};

export default SignInPage;
