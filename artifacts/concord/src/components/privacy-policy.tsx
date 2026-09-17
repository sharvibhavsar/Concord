import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, Lock, EyeOff, UserCheck } from "lucide-react";

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="w-6 h-6" />
            <DialogTitle className="text-xl font-serif">Privacy Policy</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Last updated: July 20, 2026
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4 mt-4">
          <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
            <section className="space-y-2">
              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Lock className="w-4 h-4 text-primary" /> 1. What Information We Collect
              </h3>
              <p>
                We collect information you provide directly during registration and profile creation:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Full Name, Email Address, and Birthdate.</li>
                <li>Country, Timezone, and Working Schedule Preferences.</li>
                <li>Profile Pictures (if explicitly uploaded).</li>
                <li>Tasks, Deadlines, Categories, and Productivity preferences.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <UserCheck className="w-4 h-4 text-primary" /> 2. Why & How Data is Used
              </h3>
              <p>
                Your personal data is used solely to provide core application features, such as organizing your daily task schedules, generating calendar insights, sending task reminder notifications, and synchronizing your user preferences across devices.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <EyeOff className="w-4 h-4 text-primary" /> 3. Data Protection & Zero Sharing
              </h3>
              <p className="font-medium text-foreground bg-primary/10 p-3 rounded-lg border border-primary/20">
                <strong>Our Guarantee:</strong> Personal data is never shared or sold to third parties under any circumstances. All data transmissions are strictly protected using HTTPS/TLS encrypted communication and secured storage.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">4. User Rights to Edit or Delete Data</h3>
              <p>
                You retain complete control over your information at all times. You may view, modify, or update your profile details in Settings. Furthermore, you can permanently delete your entire account and all associated records (tasks, analytics, notifications, and uploaded images) through the Delete Account option.
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
