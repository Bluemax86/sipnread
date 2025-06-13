
'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { UserCircle, LogIn, LogOut, UserPlus, Home, List, History, User, LayoutDashboard, BookOpenText } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { user, userProfile, signOut, loading, loadingProfile } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const isTassologist = userProfile?.role === 'tassologist';
  const homePath = isTassologist ? '/tassologist/dashboard' : '/';
  const homeIcon = isTassologist ? <LayoutDashboard className="h-4 w-4 md:mr-2" /> : <Home className="h-4 w-4 md:mr-2" />;
  const homeText = isTassologist ? "Dashboard" : "Home";
  
  const getInitials = () => {
    if (userProfile?.name) {
      return userProfile.name.charAt(0).toUpperCase();
    }
    if (userProfile?.email) {
      return userProfile.email.charAt(0).toUpperCase();
    }
    return <User className="h-5 w-5" />;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href={homePath} className="mr-6 flex items-center space-x-2">
          <BookOpenText className="h-7 w-7 text-primary" />
          <span className="font-bold text-primary">Sip-n-Read</span>
        </Link>
        <nav className="flex items-center space-x-2 sm:space-x-4 lg:space-x-6 flex-1">
           <Button variant="ghost" asChild className="text-sm font-medium text-muted-foreground transition-colors px-2 sm:px-3">
             <Link href={homePath} title={homeText}>
                {homeIcon}
                <span className="hidden md:inline">{homeText}</span>
             </Link>
           </Button>
           {userProfile?.role === 'tassologist' ? (
             <Button variant="ghost" asChild className="text-sm font-medium text-muted-foreground transition-colors px-2 sm:px-3">
               <Link href="/tassologist/past-readings" title="Past Readings">
                  <History className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Past Readings</span>
               </Link>
             </Button>
           ) : (
             user && ( 
                <Button variant="ghost" asChild className="text-sm font-medium text-muted-foreground transition-colors px-2 sm:px-3">
                <Link href="/my-readings" title="My Readings">
                    <List className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">My Readings</span>
                </Link>
                </Button>
             )
           )}
        </nav>
        <div className="flex items-center space-x-1 sm:space-x-2">
          {loading || loadingProfile ? (
            <Button variant="ghost" disabled>Loading...</Button>
          ) : user && userProfile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userProfile.profilePicUrl || undefined} alt={userProfile.name || userProfile.email} data-ai-hint="person avatar"/>
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userProfile.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userProfile.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" asChild size="sm" className="px-2 sm:px-3">
                <Link href="/login">
                  <LogIn className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Login</span>
                </Link>
              </Button>
              <Button asChild size="sm" className="px-2 sm:px-3">
                <Link href="/signup">
                  <UserPlus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign Up</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
