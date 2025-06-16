
'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

interface TileInfo {
  title: string;
  imageSrc: string;
  imageAlt: string;
  aiHint: string;
  active: boolean;
  targetPath?: string;
  description: string;
}

const divinationTiles: TileInfo[] = [
  {
    title: 'Tea Leaf Reading',
    imageSrc: '/images/tile_1_tea.svg', // Updated path
    imageAlt: 'A cup with tea leaves patterned at the bottom',
    aiHint: 'tea leaves',
    active: true,
    targetPath: '/sipnread-home',
    description: 'Uncover insights from the ancient art of Tasseography. Explore the symbols in your tea cup.',
  },
  {
    title: 'Coffee Ground Reading',
    imageSrc: '/images/tile_2_coffee.svg', // Updated path
    imageAlt: 'Dark coffee grounds forming patterns in a white cup',
    aiHint: 'coffee grounds',
    active: false,
    description: 'Discover the messages hidden within your coffee grounds. (Coming Soon)',
  },
  {
    title: 'Tarot Card Reading',
    imageSrc: '/images/tile_3_tarot.svg', // Updated path
    imageAlt: 'A spread of ornate Tarot cards on a mystical background',
    aiHint: 'tarot cards',
    active: false,
    description: 'Seek guidance and explore possibilities through the wisdom of the Tarot. (Coming Soon)',
  },
  {
    title: 'Rune Casting',
    imageSrc: '/images/tile_4_runes.svg', // Updated path
    imageAlt: 'A set of ancient carved runes scattered on a wooden surface',
    aiHint: 'rune stones',
    active: false,
    description: 'Consult the ancient Viking runes for wisdom and direction. (Coming Soon)',
  },
];

export default function GatewayPage() {
  const router = useRouter();

  const handleTileClick = (tile: TileInfo) => {
    if (tile.active && tile.targetPath) {
      router.push(tile.targetPath);
    }
  };

  return (
    <div className="container mx-auto min-h-[calc(100vh-120px)] flex flex-col items-center justify-center py-8 px-4">
      <header className="text-center mb-10 md:mb-12">
        <Image
          src="/7_Logo.svg"
          alt="Sip-n-Read Logo"
          width={80}
          height={80}
          className="mx-auto mb-4"
          data-ai-hint="logo 7"
        />
        <h1 className="text-4xl md:text-5xl font-headline text-primary mb-2 tracking-tight">
          Choose Your Path
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Welcome to Sip-n-Read. Select a divination method below to begin your journey of discovery.
        </p>
      </header>

      <main className="w-full max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {divinationTiles.map((tile) => (
            <Card
              key={tile.title}
              onClick={() => handleTileClick(tile)}
              className={cn(
                'overflow-hidden shadow-lg transition-all duration-300 ease-in-out transform hover:shadow-xl',
                tile.active ? 'cursor-pointer hover:scale-105 group' : 'opacity-60 cursor-not-allowed bg-muted/30',
                'flex flex-col'
              )}
            >
              <div className="relative w-full h-48 md:h-56">
                <Image
                  src={tile.imageSrc}
                  alt={tile.imageAlt}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint={tile.aiHint}
                  className={cn(tile.active && 'group-hover:opacity-90 transition-opacity')}
                />
                {!tile.active && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <span className="text-white font-semibold text-lg px-4 py-2 bg-black/50 rounded">Coming Soon</span>
                  </div>
                )}
              </div>
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-xl md:text-2xl font-headline text-primary group-hover:text-accent transition-colors">
                  {tile.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-card-foreground leading-relaxed">
                  {tile.description}
                </p>
              </CardContent>
              {tile.active && (
                <div className="p-4 pt-0 mt-auto">
                   <Button variant="link" className="p-0 text-primary group-hover:underline">
                     Explore <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                   </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </main>
      <footer className="text-center mt-12 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read. All mystical rights reserved.</p>
      </footer>
    </div>
  );
}
    
