"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ConnectionStatusIndicator } from "@/components/shared/connection-status";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <div className="flex min-h-screen w-full bg-muted/40">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-screen-2xl">
              {children}
            </div>
          </main>
        </div>
        <ConnectionStatusIndicator />
      </div>
  );
}
