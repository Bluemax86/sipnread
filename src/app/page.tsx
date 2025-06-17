
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Loader2, AlertCircle, ImageOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface TileInfo {
  id: string; // Firestore document ID (e.g., "tea", "coffee")
  imageURL: string;
  imageAlt: string;
  aiHint: string;
  active: boolean;
  targetPath: string;
  readingMethodType: 'tea' | 'coffee' | 'tarot' | 'runes'; // Always lowercase
  position: number;
}

const VALID_READING_TYPES: TileInfo['readingMethodType'][] = ['tea', 'coffee', 'tarot', 'runes'];

export default function GatewayPage() {
  const router = useRouter();
  const [tiles, setTiles] = useState<TileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTiles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const tilesQuery = query(
          collection(db, 'appTiles'),
          orderBy('position', 'asc')
        );

        console.log("[GatewayPage] Fetching tiles from Firestore collection: 'appTiles', ordered by 'position ASC'");
        const querySnapshot = await getDocs(tilesQuery);
        
        console.log(`[GatewayPage] Firestore querySnapshot received. Number of documents: ${querySnapshot.docs.length}`);
        querySnapshot.docs.forEach((doc, index) => {
          console.log(`[GatewayPage] Raw Document ${index + 1} - ID: ${doc.id}, Data:`, JSON.parse(JSON.stringify(doc.data())));
        });

        const fetchedTilesData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const docId = doc.id; 
          const lowercasedDocId = docId.toLowerCase();

          if (!VALID_READING_TYPES.includes(lowercasedDocId as TileInfo['readingMethodType'])) {
            console.warn(`[GatewayPage] Filtering out tile. Original ID: "${docId}", Lowercased: "${lowercasedDocId}". Not in VALID_READING_TYPES: ${VALID_READING_TYPES.join(', ')}.`);
            return null;
          }
          const readingMethodType = lowercasedDocId as TileInfo['readingMethodType'];
          
          const altText = typeof data.imageAlt === 'string' && data.imageAlt.trim() !== ''
                                ? data.imageAlt
                                : `${readingMethodType.charAt(0).toUpperCase() + readingMethodType.slice(1)} Reading Tile`;

          const hint = typeof data.aiHint === 'string' && data.aiHint.trim() !== '' 
                        ? data.aiHint 
                        : readingMethodType;
          
          const path = typeof data.targetPath === 'string' && data.targetPath.startsWith('/')
                        ? data.targetPath
                        : '/get-reading';

          return {
            id: docId, 
            imageURL: data.tileURL && typeof data.tileURL === 'string' 
                        ? data.tileURL 
                        : 'https://placehold.co/300x450.png?text=Image+Not+Found',
            imageAlt: altText,
            aiHint: hint,
            active: typeof data.active === 'boolean' ? data.active : false,
            targetPath: path,
            readingMethodType: readingMethodType,
            position: typeof data.position === 'number' ? data.position : 0,
          } as TileInfo;
        }).filter(Boolean) as TileInfo[];
        
        if (fetchedTilesData.length === 0 && querySnapshot.docs.length > 0) {
          console.warn("[GatewayPage] All fetched items from 'appTiles' were filtered out after mapping. Check document IDs, `VALID_READING_TYPES` alignment, or mapping logic.");
        } else if (querySnapshot.docs.length === 0) {
          console.warn("[GatewayPage] No documents found in 'appTiles' collection matching the query.");
        }
        setTiles(fetchedTilesData);

      } catch (err) {
        console.error("[GatewayPage] Error fetching divination tiles from 'appTiles':", err);
        setError(err instanceof Error ? err.message : "Failed to load divination choices.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchTiles();
  }, []);

  const handleTileClick = (tile: TileInfo) => {
    if (tile.active && tile.targetPath) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedReadingType', tile.readingMethodType);
      }
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
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg text-muted-foreground">Loading choices...</p>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Choices</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : tiles.length === 0 ? (
           <Alert>
            <ImageOff className="h-4 w-4" />
            <AlertTitle>No Paths Available</AlertTitle>
            <AlertDescription>
              It seems there are no divination choices available at the moment. Please check back later or ensure 'appTiles' collection is correctly populated.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-2 gap-6 justify-items-center">
            {tiles.map((tile) => (
              <Card
                key={tile.id}
                onClick={() => handleTileClick(tile)}
                className={cn(
                  'relative overflow-hidden shadow-lg transition-all duration-300 ease-in-out transform hover:shadow-xl aspect-[2/3] w-full',
                  tile.active ? 'cursor-pointer hover:scale-105 group' : 'opacity-60 cursor-not-allowed bg-muted/30'
                )}
              >
                <div className="relative w-full h-full">
                  <Image
                    src={tile.imageURL}
                    alt={tile.imageAlt}
                    fill
                    sizes="(max-width: 767px) 50vw, (max-width: 1023px) 276px, 276px"
                    data-ai-hint={tile.aiHint}
                    className={cn(
                      'object-cover',
                      tile.active && 'group-hover:opacity-90 transition-opacity'
                    )}
                    unoptimized={tile.imageURL.startsWith('https://firebasestorage.googleapis.com')}
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
        )}
      </main>
      <footer className="text-center mt-12 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read. All mystical rights reserved.</p>
      </footer>
    </div>
  );
}
    
