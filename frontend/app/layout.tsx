import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentForge — Autonomous Multi-Agent Software Engineering Platform",
  description:
    "Transform plain-English requirements into production-ready code using a 5-agent AI pipeline: Product Manager, Architect, Developer, QA Engineer, and Code Reviewer.",
  keywords: ["AI", "multi-agent", "code generation", "LangGraph", "Gemini"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-wrapper">{children}</div>
      </body>
    </html>
  );
}
