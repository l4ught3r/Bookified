import "material-symbols";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { appFontClassNames, geistSans } from "@/lib/fonts/reading";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bookified",
  description:
    "A smart book-reading platform with an AI assistant. Read, analyze, and discuss books using artificial intelligence.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${appFontClassNames} bg-background`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#f5f0e6" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#383530" media="(prefers-color-scheme: dark)" />
      </head>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
