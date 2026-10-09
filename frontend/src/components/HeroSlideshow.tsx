import { useEffect, useRef, useState } from 'react';

export interface HeroSlide {
  image: string;
  title: string;
}

/** Configurable slide data — add slides here, no markup changes needed. */
export const heroSlides: HeroSlide[] = [
  { image: '/images/slide-campus.svg', title: 'Federal University Dutse campus' },
  { image: '/images/slide-care.svg', title: 'Quality care for the university community' },
  { image: '/images/slide-students.svg', title: 'Serving students, staff and the community' },
  { image: '/images/slide-health.svg', title: 'Modern clinic services on campus' },
];

const ROTATE_MS = 6000;

/** Automatic, crossfading, full-bleed background slideshow with clickable
 *  progress dots. Timers are cleaned up; CSS honours prefers-reduced-motion. */
export function HeroSlideshow({ slides = heroSlides }: { slides?: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [slides.length]);

  function goTo(i: number) {
    setActive(i);
    // Restart the rotation so the chosen slide gets a full interval.
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, ROTATE_MS);
  }

  return (
    <>
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {slides.map((slide, i) => (
          <div
            key={slide.image}
            className={`hero-slide ${i === active ? 'active' : ''}`}
            style={{ backgroundImage: `url(${slide.image})` }}
          />
        ))}
        {/* Legibility overlay for text and controls */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy/80 via-navy/45 to-transparent" />
        {/* Soft fade into the page background at the bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-bg/90 to-transparent" />
      </div>

      {/* Slide indicators — decorative backgrounds stay aria-hidden, dots are interactive */}
      <nav aria-label="Hero slides" className="absolute bottom-6 left-4 z-10 flex gap-2 sm:left-8">
        {slides.map((slide, i) => (
          <button
            key={slide.image}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show slide ${i + 1}: ${slide.title}`}
            aria-current={i === active}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? 'w-7 bg-primary-light' : 'w-3 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </nav>
    </>
  );
}
