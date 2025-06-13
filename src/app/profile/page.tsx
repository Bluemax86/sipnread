
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext'; // UserProfile type is imported from AuthContext
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, UserCircle, LogIn, UserPlus, Mail, Save, XCircle, Camera, FileText, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isValid } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { app as firebaseApp } from '@/lib/firebase';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

const profileFormSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(100),
  profilePicFile: z
    .instanceof(File)
    .optional()
    .nullable()
    .refine(file => !file || file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(file => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), 'Only .jpg, .jpeg, .png, .webp, .gif allowed.'),
  bio: z.string().max(500).optional().nullable(),
  birthdate: z.string().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface UpdateUserProfileCallableData {
  name: string;
  profilePicUrl?: string | null;
  bio?: string | null;
  birthdate?: string | null;
}

export default function ProfilePage() {
  const { user, userProfile, loading, loadingProfile, refreshUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // const [localFilePreview, setLocalFilePreview] = useState<string | null>(null); // localFilePreview was unused
  // State to hold the URL that will be passed to AvatarImage src
  const [avatarDisplaySrc, setAvatarDisplaySrc] = useState<string | undefined>(undefined);
  // State to hold the key for AvatarImage to force re-render
  const [avatarDisplayKey, setAvatarDisplayKey] = useState<string>(`initial-avatar-${Date.now()}`);


  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: '', profilePicFile: null, bio: '', birthdate: '' },
  });

  useEffect(() => {
    if (loadingProfile) {
      return;
    }

    form.reset({
      name: userProfile?.name || '',
      profilePicFile: null, 
      bio: userProfile?.bio || '',
      birthdate: userProfile?.birthdate instanceof Timestamp && isValid(userProfile.birthdate.toDate())
        ? format(userProfile.birthdate.toDate(), 'yyyy-MM-dd')
        : '',
    });
    // setLocalFilePreview(null); // Tied to unused localFilePreview

    if (userProfile && userProfile.profilePicUrl) {
      const timestamp = userProfile.updatedAt instanceof Timestamp 
                        ? userProfile.updatedAt.toMillis() 
                        : Date.now();
      const cacheBustedUrl = `${userProfile.profilePicUrl}${userProfile.profilePicUrl.includes('?') ? '&' : '?'}v_prof_main=${timestamp}`;
      setAvatarDisplaySrc(cacheBustedUrl);
      setAvatarDisplayKey(`${userProfile.uid}-avatar-${timestamp}`);
    } else if (userProfile) {
      setAvatarDisplaySrc(undefined); 
      setAvatarDisplayKey(`${userProfile.uid}-avatar-no-pic-${Date.now()}`);
    } else {
      setAvatarDisplaySrc(undefined);
      setAvatarDisplayKey(`initial-avatar-fallback-${Date.now()}`);
    }
  }, [userProfile, loadingProfile, form]); 

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue('profilePicFile', file, { shouldValidate: true });
      const previewUrl = URL.createObjectURL(file);
      // setLocalFilePreview(previewUrl); // Tied to unused localFilePreview
      setAvatarDisplaySrc(previewUrl); 
      setAvatarDisplayKey(`local-preview-${Date.now()}`); 
    } else {
      form.setValue('profilePicFile', null);
      // setLocalFilePreview(null); // Tied to unused localFilePreview
      if (userProfile && userProfile.profilePicUrl) {
        const timestamp = userProfile.updatedAt instanceof Timestamp ? userProfile.updatedAt.toMillis() : Date.now();
        const cacheBustedUrl = `${userProfile.profilePicUrl}${userProfile.profilePicUrl.includes('?') ? '&' : '?'}v_prof_revert=${timestamp}`;
        setAvatarDisplaySrc(cacheBustedUrl);
        setAvatarDisplayKey(`${userProfile.uid}-avatar-${timestamp}`);
      } else {
        setAvatarDisplaySrc(undefined);
        setAvatarDisplayKey(userProfile ? `${userProfile.uid}-avatar-no-pic-${Date.now()}` : `initial-avatar-cleared-${Date.now()}`);
      }
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
      return;
    }
    setIsSubmitting(true);

    let newProfilePicUrlToSave = userProfile?.profilePicUrl || null; 

    if (values.profilePicFile) {
      try {
        const storage = getStorage(firebaseApp);
        const imagePath = `profile-pictures/${user.uid}/profileImage`;
        const imageRef = storageRef(storage, imagePath);
        await uploadBytes(imageRef, values.profilePicFile);
        newProfilePicUrlToSave = await getDownloadURL(imageRef); 
      } catch (error) {
        console.error("Error uploading profile picture:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload profile picture.' });
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const functions = getFunctions(firebaseApp);
      const updateUserProfileCallable = httpsCallable<UpdateUserProfileCallableData, { success: boolean; message: string }>(
        functions,
        'updateUserProfileCallable'
      );
      const result = await updateUserProfileCallable({
        name: values.name,
        profilePicUrl: newProfilePicUrlToSave, 
        bio: values.bio,
        birthdate: values.birthdate,
      });

      if (result.data.success) {
        toast({ title: 'Profile Updated', description: result.data.message });
        form.setValue('profilePicFile', null); 
        // setLocalFilePreview(null); // Tied to unused localFilePreview
        await refreshUserProfile(); 
      } else {
        toast({ variant: 'destructive', title: 'Update Failed', description: result.data.message });
      }
    } catch (error: unknown) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error instanceof Error ? error.message : 'An unknown error occurred' });
    } finally {
      setIsSubmitting(false);
      window.scrollTo(0, 0);
    }
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return <UserCircle className="h-5 w-5" />;
  };
  
  if (loading || (loadingProfile && !userProfile && user)) { 
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
        <UserCircle className="h-16 w-16 text-primary mb-4" />
        <p>Please log in to view your profile.</p>
        <div className="mt-6 flex gap-4">
          <Button onClick={() => router.push('/login')}>
            <LogIn className="mr-2 h-4 w-4" /> Login
          </Button>
          <Button variant="outline" onClick={() => router.push('/signup')}>
            <UserPlus className="mr-2 h-4 w-4" /> Sign Up
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center space-y-3">
                <Avatar className="h-24 w-24 ring-2 ring-primary ring-offset-2">
                  <AvatarImage
                    key={avatarDisplayKey} 
                    src={avatarDisplaySrc} 
                    alt={userProfile?.name || 'User'}
                    data-ai-hint="person avatar"
                  />
                  <AvatarFallback className="text-3xl">{getInitials(userProfile?.name, userProfile?.email)}</AvatarFallback>
                </Avatar>
                <FormField
                  control={form.control}
                  name="profilePicFile"
                  render={() => ( 
                    <FormItem className="w-full">
                      <FormLabel><Camera className="mr-2 h-4 w-4 inline" />Profile Picture</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept={ACCEPTED_IMAGE_TYPES.join(',')}
                          onChange={handleFileChange}
                          className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel><UserCircle className="mr-2 h-4 w-4 inline" />Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel><Mail className="mr-2 h-4 w-4 inline" />Email</FormLabel>
                <Input value={userProfile?.email || ''} readOnly disabled className="bg-muted/50" />
              </FormItem>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel><FileText className="mr-2 h-4 w-4 inline" />Bio</FormLabel>
                    <FormControl>
                      <Textarea placeholder="About yourself" {...field} value={field.value || ''} className="min-h-[100px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="birthdate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel><CalendarDays className="mr-2 h-4 w-4 inline" />Birthdate</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                <XCircle className="mr-2 h-4 w-4" /> Cancel
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
