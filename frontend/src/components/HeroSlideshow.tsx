import { useEffect, useMemo, useRef, useState } from 'react';

export interface HeroSlide {
  image: string;
  /** Used for the dot's accessible label and the caption. */
  title: string;
  /** Optional attribution line, shown over the hero while the photo is visible. */
  credit?: string;
}

/** The five campus photographs. Sources and licences are recorded in
 *  `public/images/CREDITS.md` — keep the two in step when adding a photo. */
export const heroSlides: HeroSlide[] = [
  {
    image: '/images/046-fud-gate.jpg',
    title: 'The main gate of Federal University Dutse',
    credit: 'Photo: Gwanki, Wikimedia Commons (CC BY-SA 4.0)',
  },
  {
    image: '/images/047-fud-college-of-health-sciences.jpg',
    title: 'College of Health Sciences, Federal University Dutse',
    credit: 'Photo: Abdoul Mzee, Wikimedia Commons (CC BY-SA 3.0)',
  },
  {
    image: '/images/048-fud-campus.jpg',
    title: 'Federal University Dutse campus',
    credit: 'Photo: Abdoul Mzee, Wikimedia Commons (CC BY-SA 3.0)',
  },
  {
    image: '/images/049-fud-graduation.jpg',
    title: 'Graduation day at Federal University Dutse',
    credit: 'Photo: Abdoul Mzee, Wikimedia Commons (CC BY-SA 3.0)',
  },
  {
    image: '/images/050-fud-graduation-atrium.jpg',
    title: 'Students of Federal University Dutse',
    credit: 'Photo: Abdoul Mzee, Wikimedia Commons (CC BY-SA 3.0)',
  },
];

/** Bundled artwork that ships with the app. If a photograph is missing or fails to
 *  load, the slide falls back to one of these so the hero is never left blank. */
const fallbackSlides: HeroSlide[] = [
  { image: '/images/slide-campus.svg', title: 'Federal University Dutse campus' },
  { image: '/images/slide-care.svg', title: 'Quality care for the university community' },
  { image: '/images/slide-students.svg', title: 'Serving students, staff and the community' },
  { image: '/images/slide-health.svg', title: 'Modern clinic services on campus' },
];

const ROTATE_MS = 6000;

/** Automatic, crossfading, full-bleed background slideshow with clickable
 *  progress dots. Timers are cleaned up; CSS honours prefers-reduced-motion.
 *  Any slide whose image fails to load is swapped for bundled artwork. */
export function HeroSlideshow({ slides = heroSlides }: { slides?: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<string, true>>({});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Memoised so the array identity is stable across renders (only the URLs matter).
  const list = useMemo(() => (slides.length > 0 ? slides : fallbackSlides), [slides]);

  // Probe every image once up front; whichever fail are replaced by fallback artwork.
  useEffect(() => {
    let cancelled = false;
    const probes = list.map((slide) => {
      const img = new Image();
      img.onerror = () => {
        if (!cancelled) setFailed((prev) => (prev[slide.image] ? prev : { ...prev, [slide.image]: true }));
      };
      img.src = slide.image;
      return img;
    });
    return () => {
      cancelled = true;
      probes.forEach((img) => {
        img.onerror = null; // stop a late error from a stale probe updating state
      });
    };
    }, [list]);

  useEffect(() => {
    timer.current = setInterval(() => {
      setActive((i) => (i + 1) % list.length);
    }, ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [list]);

  function goTo(i: number) {
    setActive(i);
    // Restart the rotation so the chosen slide gets a full interval.
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setActive((prev) => (prev + 1) % list.length);
    }, ROTATE_MS);
  }

  /** Photograph for slide `i`, or bundled artwork when it could not be loaded. */
  function sourceFor(i: number) {
    const slide = list[i];
    if (!failed[slide.image]) return slide;
    return fallbackSlides[i % fallbackSlides.length];
  }

  const activeSlide = sourceFor(active);

  return (
    <>
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Last-resort backdrop, in case even the bundled artwork is unavailable */}
        <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy/90 to-sidebar" />
        {list.map((slide, i) => (
          <div
            key={slide.image}
            className={`hero-slide ${i === active ? 'active' : ''}`}
            style={{ backgroundImage: `url(${sourceFor(i).image})` }}
          />
        ))}
        {/* Legibility overlay for text and controls */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy/80 via-navy/45 to-transparent" />
        {/* Soft fade into the page background at the bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-bg/90 to-transparent" />
      </div>

      {/* Slide indicators — decorative backgrounds stay aria-hidden, dots are interactive */}
      <nav aria-label="Hero slides" className="absolute bottom-6 left-4 z-10 flex gap-2 sm:left-8">
        {list.map((slide, i) => (
          <button
            key={slide.image}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show slide ${i + 1}: ${sourceFor(i).title}`}
            aria-current={i === active}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? 'w-7 bg-primary-light' : 'w-3 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </nav>

      {/* Attribution for the photo currently on screen (CC BY-SA requires credit) */}
      {activeSlide.credit && (
        <p className="absolute bottom-7 right-4 z-10 hidden text-[11px] text-white/60 sm:right-8 sm:block">
          {activeSlide.credit}
        </p>
      )}
    </>
  );
}