import { Skeleton } from "@/components/ui/loader";
import type { User } from "@/lib/types";
import { PasswordForm, ProfileForm } from "./profile-forms";

export function SettingsContent({ user }: { user: User }) {
  return (
    <div className="grid max-w-3xl gap-6">
      <ProfileForm user={{ name: user.name, email: user.email, phone: user.phone, whatsapp_updates: user.whatsapp_updates }} whatsapp={user.type === "customer"} />
      <PasswordForm />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="grid max-w-3xl gap-6" aria-busy>
      <Skeleton className="h-80 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}
