'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { addToWaitlist } from '@/app/actions/waitlist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const initialState = {
  success: false,
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full flex h-14 px-6 py-0 justify-center items-center gap-[10px] rounded-md bg-[#FEE3E5] text-black hover:bg-[#FEE3E5]/90 text-sm font-normal leading-normal"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {pending ? 'Submitting...' : 'Join Waitlist'}
    </Button>
  );
}

export function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [formState, formAction] = useActionState(addToWaitlist, initialState);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (formState.message) {
      if (formState.success) {
        toast.success(formState.message);
        onClose(); // Close modal on success
      } else {
        toast.error(formState.message);
      }
    }
  }, [formState, onClose]);

  // Reset form state if modal is reopened after a submission
  useEffect(() => {
    if (isOpen) {
      // Reset to initial state if you want to clear previous messages when modal reopens
      // This might not be desired if you want to show the last message until they try again
      // For now, we'll let it persist until a new submission or if they close and reopen.
    } else {
      // Optionally reset email field when modal closes
      setEmail(''); 
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#121212] border-[#353535] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#e2e2e2]">Join the Waitlist</DialogTitle>
          <DialogDescription className="text-[#e2e2e2] mt-2">
            Enter your email below to get early access and updates for QWK SHOT.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4 py-4">
          <div>
            <label htmlFor="waitlist-email" className="sr-only">
              Email address
            </label>
            <Input
              id="waitlist-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-14 bg-black border-[#353535] text-white placeholder:text-gray-500 focus:border-[#e2e2e2] text-base"
            />
          </div>
          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
} 