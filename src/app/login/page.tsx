
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthFormFields, loginSchema, type LoginFormValues } from '@/components/auth/AuthFormFields';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function LoginPage() {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });
  const { signIn, user, userProfile, loading, loadingProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !loadingProfile && user && userProfile) {
      if (userProfile.role === 'tassologist') {
        router.replace('/tassologist/dashboard');
      } else {
        router.replace('/');
      }
    }
  }, [user, userProfile, loading, loadingProfile, router]);

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    setError(null);
    const result = await signIn(values);
    setIsSubmitting(false);
    if (result.success) {
      toast({
        title: 'Logged In!',
        description: 'Welcome back to Sip-n-Read!',
      });
      // Redirection logic is now primarily handled by the useEffect above,
      // but we can also attempt an immediate redirect based on the profile from signIn result.
      if (result.userProfile?.role === 'tassologist') {
        router.push('/tassologist/dashboard');
      } else {
        router.push('/');
      }
    } else {
       if (result.error?.code === 'auth/invalid-credential' || result.error?.code === 'auth/user-not-found' || result.error?.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please try again.');
      } else if (result.error?.code === 'auth/visibility-check-was-unavailable') {
        setError('There was a temporary issue connecting to the authentication service. Please try again in a few moments. If the problem persists, please check your network connection.');
      }
       else {
        setError(result.error?.message || 'An unexpected error occurred. Please try again.');
      }
    }
  };
  
  if (loading || loadingProfile) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }


  return (
    <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-10 w-10 text-primary mb-3" />
          <CardTitle className="font-headline text-3xl">Welcome Back!</CardTitle>
          <CardDescription>Log in to continue your journey with Sip-n-Read.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Login Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <AuthFormFields control={form.control} />
              <div className="text-right">
                <Link href="/forgot-password" passHref>
                  <Button variant="link" type="button" className="px-0 text-sm h-auto">
                    Forgot password?
                  </Button>
                </Link>
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging In...
                  </>
                ) : (
                  'Log In'
                )}
              </Button>
            </form>
          </Form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign Up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
