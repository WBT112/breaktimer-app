import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  const handleUnderstood = () => {
    // Mark app as initialized when user dismisses the modal
    ipcRenderer.invokeSetAppInitialized();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        data-testid="welcome-modal"
        className="max-w-[400px] w-[400px]"
        showCloseButton={false}
      >
        <DialogHeader className="text-left">
          <DialogTitle>BreakTimer läuft im Hintergrund</DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-balance pt-2">
            Die App ist jederzeit über dein Tray- oder Menüleistensymbol
            erreichbar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            data-testid="welcome-dismiss-button"
            onClick={handleUnderstood}
            className="w-full"
          >
            Verstanden, los geht&apos;s!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
