import { WorkspaceTabs } from "@/components/admin/workspace/workspace-tabs";
import { PageHeader } from "@/components/app/page-header";

export default function WorkspaceLayout({ children }: LayoutProps<"/admin/workspace">) {
  return (
    <>
      <PageHeader title="Workspace" description="Everything customers can book: locations, spaces, prices, passes and the rules around them." />
      <WorkspaceTabs />
      {children}
    </>
  );
}
