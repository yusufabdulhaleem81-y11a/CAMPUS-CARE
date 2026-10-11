import { useEffect, useMemo, useRef, useState } from 'react';

export interface HeroSlide {
  image: string;
  title: string;
  locationLabel: string;
  credit?: string;
}

/** Real FUD campus photographs present in `frontend/public/images/`.
 *  Filenames are taken from the working directory — keep in sync when adding/removing photos.
 *  Spaces in jfif names are kept verbatim; CSS url() is quoted so they resolve correctly. */
export const heroSlides: HeroSlide[] = [
  {
    image: '/images/046-fud-gate.jpg',
    title: 'The main gate of Federal University Dutse',
    locationLabel: 'FUD Main Gate – Gwanki Campus',
    credit: 'Federal University Dutse',
  },
  {
    image: '/images/image.png',
    title: 'Federal University Dutse campus view',
    locationLabel: 'FUD Campus – Dutse, Jigawa State',
  },
  {
    image: '/images/images.jpg',
    title: 'Federal University Dutse campus',
    locationLabel: 'FUD Campus – Dutse',
  },
  {
    image: '/images/images.jfif',
    title: 'Federal University Dutse academic area',
    locationLabel: 'Academic Block – FUD Campus',
  },
  {
    image: '/images/images (1).jfif',
    title: 'Federal University Dutse facilities',
    locationLabel: 'FUD Facilities – Gwanki Campus',
  },
  {
    image: '/images/images (2).jfif',
    title: 'Federal University Dutse lecture area',
    locationLabel: 'Lecture Complex – FUD',
  },
  {
    image: '/images/images (3).jfif',
    title: 'Federal University Dutse student area',
    locationLabel: 'Student Area – FUD Campus',
  },
  {
    image: '/images/images (4).jfif',
    title: 'Federal University Dutse grounds',
    locationLabel: 'University Grounds – FUD',
  },
];

const ROTATE_MS = 5500;

export function HeroSlideshow({ slides = heroSlides }: { slides?: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<string, true>>({});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const list = useMemo(() => (slides.length > 0 ? slides : heroSlides), [slides]);

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
      probes.forEach((img) => { img.onerror = null; });
    };
  }, [list]);

  useEffect(() => {
    timer.current = setInterval(() => setActive((i) => (i + 1) % list.length), ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [list]);

  function restartInterval() {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setActive((prev) => (prev + 1) % list.length), ROTATE_MS);
  }

  function goTo(i: number) {
    setActive(i);
    restartInterval();
  }

  function prev() {
    setActive((i) => (i - 1 + list.length) % list.length);
    restartInterval();
  }

  function next() {
    setActive((i) => (i + 1) % list.length);
    restartInterval();
  }

  const activeSlide = list[active];

  return (
    <>
      {/* Background layers */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[#0a1a33]" />
        {list.map((slide, i) => {
          if (failed[slide.image]) return null;
          return (
            <div
              key={slide.image}
              className={`hero-slide ${i === active ? 'active' : ''}`}
              style={{ backgroundImage: `url("${slide.image}")` }}
            />
          );
        })}
        {/* Balanced dark gradient: strongest on left behind text, fading to the right */}
        <div className="hero-overlay" />
        {/* Extra top scrim so white header text stays legible over bright skies */}
        <div className="hero-top-scrim" />
      </div>

      {/* Left / Right arrows */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous slide"
        className="hero-arrow hero-arrow-left"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next slide"
        className="hero-arrow hero-arrow-right"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dots */}
      <nav aria-label="Hero slides" className="hero-dots">
        {list.map((slide, i) => (
          <button
            key={slide.image}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show slide ${i + 1}: ${slide.title}`}
            aria-current={i === active}
            className={`hero-dot ${i === active ? 'hero-dot-active' : ''}`}
          />
        ))}
      </nav>

      {/* Location caption – lower left */}
      <div className="hero-location">
        <span className="hero-location-dot" aria-hidden="true" />
        <span>{activeSlide.locationLabel}</span>
      </div>

      {/* Campus badge – lower right */}
      <div className="hero-badge">
        <div className="hero-badge-title">Federal University Dutse</div>
        <div className="hero-badge-motto">Knowledge, Excellence and Service</div>
      </div>

      {/* Curved white bottom edge + thin green accent */}
      <div className="hero-curve-wrap" aria-hidden="true">
        <div className="hero-curve-line" />
        <div className="hero-curve" />
      </div>
    </>
  );
}
