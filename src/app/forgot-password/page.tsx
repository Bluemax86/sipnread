
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Loader2, HelpCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
// import Link from 'next/link'; // Link was defined but not used. useRouter handles navigation.
import { useRouter } from 'next/navigation';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: 'Password Reset Email Sent',
        description: 'If an account exists for this email, a password reset link has been sent. Please check your inbox (and spam folder).',
      });
      setEmailSent(true); // To change the UI after sending
    } catch (error: unknown) {
      console.error("Error sending password reset email:", error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error instanceof Error && 'code' in error) {
        const firebaseError = error as { code: string; message: string };
        if (firebaseError.code === 'auth/user-not-found') {
          // We still show a generic message for security reasons, but log the specific error
          console.warn("Password reset attempted for non-existent user:", values.email);
           toast({
              title: 'Password Reset Email Sent',
              description: 'If an account exists for this email, a password reset link has been sent. Please check your inbox (and spam folder).',
          });
          setEmailSent(true);
        } else if (firebaseError.code === 'auth/invalid-email') {
          errorMessage = 'The email address is not valid.';
          form.setError('email', { type: 'manual', message: errorMessage });
        } else {
           toast({
              variant: 'destructive',
              title: 'Error',
              description: errorMessage,
          });
        }
      } else if (error instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message,
        });
      } else {
         toast({
            variant: 'destructive',
            title: 'Error',
            description: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <HelpCircle className="mx-auto h-10 w-10 text-primary mb-3" />
          <CardTitle className="font-headline text-3xl">Forgot Password?</CardTitle>
          <CardDescription>
            {emailSent 
              ? "Check your email for the reset link." 
              : "Enter your email address and we&apos;ll send you a link to reset your password."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!emailSent ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input placeholder="you@example.com" {...field} className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="text-center">
                <p className="text-muted-foreground mb-6">The email has been sent. If you don&apos;t see it within a few minutes, please check your spam or junk folder.</p>
            </div>
          )}
          <div className="mt-6 text-center">
            <Button variant="link" onClick={() => router.push('/login')} className="text-primary">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Log In
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
