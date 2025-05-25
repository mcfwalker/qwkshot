'use server';

import { supabase } from '@/lib/supabase'; // Changed to standard Supabase client
import { z } from 'zod';

// Define a schema for email validation
const EmailSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
});

interface AddToWaitlistResult {
  success: boolean;
  message: string;
}

export async function addToWaitlist(prevState: any, formData: FormData): Promise<AddToWaitlistResult> {
  const email = formData.get('email');

  const validationResult = EmailSchema.safeParse({ email });

  if (!validationResult.success) {
    return {
      success: false,
      message: validationResult.error.errors[0]?.message || 'Invalid email address provided.',
    };
  }

  const validatedEmail = validationResult.data.email;

  try {
    // The RLS policy "Allow public insert to waitlist" ON public.waitlist_entries
    // should allow this insert operation even with the non-admin client.
    const { data, error } = await supabase
      .from('waitlist_entries')
      .insert([{ email: validatedEmail }]);

    if (error) {
      console.error('Supabase error adding to waitlist:', error);
      if (error.code === '23505') { // Unique violation (email already exists)
        return {
          success: false,
          message: 'This email is already on the waitlist.',
        };
      }
      return {
        success: false,
        message: 'Could not add email to waitlist. Please try again.',
      };
    }

    return {
      success: true,
      message: 'Successfully added to the waitlist! We will be in touch.',
    };
  } catch (e) {
    console.error('Unexpected error adding to waitlist:', e);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    };
  }
} 