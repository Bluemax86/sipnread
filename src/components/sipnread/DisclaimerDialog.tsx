'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert } from "lucide-react";

interface DisclaimerDialogProps {
  open: boolean;
  onAcknowledge: () => void;
  // onOpenChange is passed to allow AlertDialog to close itself via Esc or overlay click,
  // and then trigger the onAcknowledge logic.
  onOpenChange: (open: boolean) => void;
}

export function DisclaimerDialog({ open, onAcknowledge, onOpenChange }: DisclaimerDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md shadow-xl">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-3">
            <ShieldAlert className="h-10 w-10 text-amber-500" />
          </div>
          <AlertDialogTitle className="text-center text-xl font-headline text-primary">
            Important Disclaimer
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-center text-muted-foreground pt-2 leading-relaxed">
            This application, Sip-n-Read, and its interpretations are provided for entertainment purposes only.
            The readings and any information provided should not be taken as advice or relied upon for making
            personal, financial, medical, or any other decisions. Users are solely responsible for their own
            actions and choices.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogAction
            onClick={onAcknowledge} // This click will also trigger onOpenChange(false) internally
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            I Understand & Acknowledge
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
