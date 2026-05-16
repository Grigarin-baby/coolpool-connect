import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { listHeroBanners } from "@/data/appwrite-repository";
import { Sparkles, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function HeroCarousel() {
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["hero-banners"],
    queryFn: () => listHeroBanners(false), // only fetch active banners
  });

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000, stopOnInteraction: false }),
  ]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  // Filter out banners based on start/end date logic
  const now = new Date();
  const activeBanners = banners.filter((banner) => {
    if (banner.startDate && new Date(banner.startDate) > now) return false;
    if (banner.endDate && new Date(banner.endDate) < now) return false;
    return true;
  });

  if (isLoading) {
    return (
      <section className="relative w-full h-[60vh] min-h-[55vh] max-h-[65vh] text-center flex flex-col items-center justify-center overflow-hidden bg-muted">
        <Skeleton className="absolute inset-0 w-full h-full" />
      </section>
    );
  }

  // Fallback to default hero if no banners
  if (activeBanners.length === 0) {
    return (
      <section className="relative pt-10 pb-44 sm:pt-20 sm:pb-40 md:pt-28 md:pb-48 bg-gradient-hero text-center flex flex-col items-center justify-center overflow-visible">
        <div className="absolute inset-0 bg-gradient-mesh opacity-90 pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] bg-primary-glow/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

        <div className="container mx-auto px-4 sm:px-5 relative z-10 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/40 backdrop-blur-md px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary mb-6 shadow-sm border border-primary/20">
            <Sparkles className="h-3.5 w-3.5" />
            Premium Intercity Ride-Sharing
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] font-heading text-balance lowercase">
            share the trip, <br className="hidden sm:block" />
            <span className="text-gradient-primary">split the fun.</span>
          </h1>
          <p className="mt-6 text-base sm:text-xl text-foreground/80 max-w-2xl mx-auto px-4 sm:px-0 leading-relaxed">
            Connect with verified hosts heading your way. Book your segment, share the travel costs,
            and enjoy a smarter, more social way to commute.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full h-[60vh] min-h-[55vh] max-h-[65vh] flex flex-col items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
        <div className="flex w-full h-full touch-pan-y">
          {activeBanners.map((banner) => (
            <div key={banner.id} className="relative flex-[0_0_100%] min-w-0 h-full">
              {banner.linkUrl ? (
                <a
                  href={banner.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0 z-10 block"
                >
                  <span className="sr-only">Go to {banner.title || "banner link"}</span>
                </a>
              ) : null}

              <img
                src={banner.imageUrl || ""}
                alt={banner.title || "Hero banner"}
                className="absolute inset-0 w-full h-full object-cover object-center"
                style={{
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45))" }}
              />

              {banner.title && (
                <div className="absolute inset-0 flex items-center justify-center z-0">
                  <div className="container mx-auto px-4 sm:px-5 relative max-w-4xl text-center">
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white font-heading text-balance drop-shadow-xl">
                      {banner.title}
                    </h2>
                    {banner.linkUrl && (
                      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-md px-6 py-2.5 text-sm font-bold text-white border border-white/30 transition-colors hover:bg-white/30">
                        Explore <ExternalLink className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Carousel Dots */}
      {activeBanners.length > 1 && (
        <div className="absolute bottom-[2rem] sm:bottom-[3rem] left-0 right-0 z-10 flex justify-center gap-2 pointer-events-none">
          {activeBanners.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === selectedIndex
                  ? "w-8 bg-primary shadow-[0_0_10px_rgba(107,70,193,0.8)]"
                  : "w-2 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
