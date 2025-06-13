
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthFormFields, signUpSchema, type SignUpFormValues } from '@/components/auth/AuthFormFields';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function SignUpPage() {
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      birthdate: '',
    },
  });
  const { signUp } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (values: SignUpFormValues) => {
    setIsLoading(true);
    setError(null);
    const result = await signUp(values);
    setIsLoading(false);
    if (result.success) {
      toast({
        title: 'Account Created!',
        description: 'You have successfully signed up. Welcome!',
      });
      router.push('/'); // Redirect to home or dashboard
    } else {
      if (result.error?.code === 'auth/email-already-in-use') {
        setError('This email address is already in use. Please try logging in or use a different email.');
      } else {
        setError(result.error?.message || 'An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <UserPlus className="mx-auto h-10 w-10 text-primary mb-3" />
          <CardTitle className="font-headline text-3xl">Create an Account</CardTitle>
          <CardDescription>Enter your details to get started with Sip-n-Read.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sign Up Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4"> {/* Reduced space-y for tighter form */}
              <AuthFormFields control={form.control} isSignUp />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>
            </form>
          </Form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
