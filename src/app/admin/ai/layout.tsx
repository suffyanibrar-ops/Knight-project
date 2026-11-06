import type { ReactNode } from "react";
import { AiTabs } from "@/components/admin/ai/tabs";

export default function AdminAiLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <AiTabs />
      {children}
    </div>
  );
}
