import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, AlertTriangle, KeyRound, CheckCircle2 } from "lucide-react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <FileText className="w-6 h-6" />
            <DialogTitle className="text-xl font-serif">Terms & Conditions</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Last updated: July 20, 2026
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4 mt-4">
          <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
            <section className="space-y-2">
              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" /> 1. User Responsibility & Account Conduct
              </h3>
              <p>
                By using Concord, you agree to:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Use the application responsibly and lawfully.</li>
                <li>Provide accurate, truthful information during registration.</li>
                <li>Maintain the strict confidentiality of your login credentials.</li>
                <li>Avoid any attempts to perform unauthorized access or disrupt application services.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <KeyRound className="w-4 h-4 text-primary" /> 2. Credential Confidentiality
              </h3>
              <p>
                You are responsible for all activities conducted under your account password. If you suspect unauthorized access to your credentials, update your password immediately.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> 3. Productivity & Scheduling Disclaimer
              </h3>
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-foreground space-y-2">
                <p>
                  <strong>Important Notice:</strong> Concord provides productivity suggestions and scheduling aids only.
                </p>
                <p className="text-muted-foreground text-xs">
                  Automated schedules and productivity recommendations are not guaranteed to be accurate. Users remain solely responsible for reviewing and confirming all schedules, task deadlines, and operational decisions. Concord is intended solely as a personal productivity tool and is not designed or licensed for medical, legal, or financial advice.
                </p>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
