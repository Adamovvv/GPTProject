"use client";
import * as React from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CarouselApi = UseEmblaCarouselType[1];
type CarouselProps = { opts?: Parameters<typeof useEmblaCarousel>[0]; setApi?: (api: CarouselApi) => void; onSelect?: (index:number) => void; orientation?: "horizontal" | "vertical"; className?: string; children: React.ReactNode };
const CarouselContext = React.createContext<{ carouselRef: ReturnType<typeof useEmblaCarousel>[0]; api: CarouselApi; scrollPrev: () => void; scrollNext: () => void; canScrollPrev: boolean; canScrollNext: boolean; orientation: "horizontal" | "vertical" } | null>(null);
export function Carousel({ orientation="horizontal", opts, setApi, onSelect, className, children, ...props }: CarouselProps & React.HTMLAttributes<HTMLDivElement>) {
 const [carouselRef, api] = useEmblaCarousel({ ...opts, axis: orientation === "horizontal" ? "x" : "y" });
 const [canScrollPrev,setCanScrollPrev]=React.useState(false); const [canScrollNext,setCanScrollNext]=React.useState(false);
 const onEmblaSelect=React.useCallback((embla: NonNullable<CarouselApi>)=>{setCanScrollPrev(embla.canScrollPrev());setCanScrollNext(embla.canScrollNext());},[]);
 const scrollPrev=React.useCallback(()=>api?.scrollPrev(),[api]); const scrollNext=React.useCallback(()=>api?.scrollNext(),[api]);
 React.useEffect(()=>{if(!api)return;onEmblaSelect(api);api.on("reInit",onEmblaSelect);api.on("select",onEmblaSelect);return()=>{api.off("select",onEmblaSelect);api.off("reInit",onEmblaSelect)};},[api,onEmblaSelect]);
 React.useEffect(()=>{if(api&&setApi)setApi(api)},[api,setApi]);
 React.useEffect(()=>{if(!api||!onSelect)return;const update=()=>onSelect(api.selectedScrollSnap());api.on('select',update);update();return()=>{api.off('select',update)};},[api,onSelect]);
 return <CarouselContext.Provider value={{carouselRef,api,scrollPrev,scrollNext,canScrollPrev,canScrollNext,orientation}}><div onKeyDownCapture={e=>{if(e.key==="ArrowLeft"){e.preventDefault();scrollPrev()}else if(e.key==="ArrowRight"){e.preventDefault();scrollNext()}}} className={cn("relative",className)} role="region" aria-roledescription="carousel" {...props}>{children}</div></CarouselContext.Provider>;
}
export function CarouselContent({className,...props}:React.HTMLAttributes<HTMLDivElement>){const c=React.useContext(CarouselContext);if(!c)throw new Error("CarouselContent must be used within Carousel");return <div ref={c.carouselRef} className="overflow-hidden"><div className={cn("flex",c.orientation==="horizontal"?"-ml-4":"-mt-4 flex-col",className)} {...props}/></div>}
export function CarouselItem({className,...props}:React.HTMLAttributes<HTMLDivElement>){const c=React.useContext(CarouselContext);if(!c)throw new Error("CarouselItem must be used within Carousel");return <div role="group" aria-roledescription="slide" className={cn("min-w-0 shrink-0 grow-0 basis-full",c.orientation==="horizontal"?"pl-4":"pt-4",className)} {...props}/>}
export function CarouselPrevious({className,...props}:React.ComponentProps<typeof Button>){const c=React.useContext(CarouselContext);if(!c)throw new Error("CarouselPrevious must be used within Carousel");return <Button variant="outline" size="icon" className={cn("absolute h-8 w-8 rounded-full",c.orientation==="horizontal"?"-left-3 top-1/2 -translate-y-1/2":"left-1/2 -top-3 -translate-x-1/2 rotate-90",className)} disabled={!c.canScrollPrev} onClick={c.scrollPrev} {...props}><ArrowLeft className="h-4 w-4"/><span className="sr-only">Предыдущее фото</span></Button>}
export function CarouselNext({className,...props}:React.ComponentProps<typeof Button>){const c=React.useContext(CarouselContext);if(!c)throw new Error("CarouselNext must be used within Carousel");return <Button variant="outline" size="icon" className={cn("absolute h-8 w-8 rounded-full",c.orientation==="horizontal"?"-right-3 top-1/2 -translate-y-1/2":"-bottom-3 left-1/2 -translate-x-1/2 rotate-90",className)} disabled={!c.canScrollNext} onClick={c.scrollNext} {...props}><ArrowRight className="h-4 w-4"/><span className="sr-only">Следующее фото</span></Button>}
