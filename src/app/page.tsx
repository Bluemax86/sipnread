
'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TileInfo {
  imageSrc: string;
  imageAlt: string;
  aiHint: string;
  active: boolean;
  targetPath?: string;
}

const divinationTiles: TileInfo[] = [
  {
    imageSrc: '/images/tile_1_tea.svg',
    imageAlt: 'A cup with tea leaves patterned at the bottom',
    aiHint: 'tea leaves',
    active: true,
    targetPath: '/sipnread-home',
  },
  {
    imageSrc: '/images/tile_2_coffee.svg',
    imageAlt: 'Dark coffee grounds forming patterns in a white cup',
    aiHint: 'coffee grounds',
    active: false,
  },
  {
    imageSrc: '/images/tile_3_tarot.svg',
    imageAlt: 'A spread of ornate Tarot cards on a mystical background',
    aiHint: 'tarot cards',
    active: false,
  },
  {
    imageSrc: '/images/tile_4_runes.svg',
    imageAlt: 'A set of ancient carved runes scattered on a wooden surface',
    aiHint: 'rune stones',
    active: false,
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
          src="/swirl-logo.png"
          alt="Sip-n-Read Swirl Logo"
          width={80}
          height={80}
          className="mx-auto mb-4"
          data-ai-hint="logo swirl"
        />
        <h1 className="text-4xl md:text-5xl font-headline text-primary mb-2 tracking-tight">
          Choose Your Path
        </h1>
      </header>

      <main className="w-full max-w-xl">
        <div className="grid grid-cols-2 gap-6 md:gap-8 justify-items-center">
          {divinationTiles.map((tile) => (
            <Card
              key={tile.imageAlt}
              onClick={() => handleTileClick(tile)}
              className={cn(
                'relative overflow-hidden shadow-lg transition-all duration-300 ease-in-out transform hover:shadow-xl aspect-[2/3] w-full',
                tile.active ? 'cursor-pointer hover:scale-105 group' : 'opacity-60 cursor-not-allowed bg-muted/30'
              )}
            >
              <div className="relative w-full h-full">
                <Image
                  src={tile.imageSrc}
                  alt={tile.imageAlt}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint={tile.aiHint}
                  className={cn(tile.active && 'group-hover:opacity-90 transition-opacity')}
                />
                {!tile.active && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-2">
                    <span className="text-white font-semibold text-sm sm:text-lg text-center bg-black/50 rounded px-2 py-1">Coming Soon</span>
                  </div>
                )}
              </div>
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
