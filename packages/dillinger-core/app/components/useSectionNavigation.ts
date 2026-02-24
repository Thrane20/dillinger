import { useCallback, useEffect, type MutableRefObject } from 'react';
import type { FormSection } from './game-form-types';

interface UseSectionNavigationParams {
  sections: FormSection[];
  sectionRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  setActiveSection: (sectionId: string) => void;
}

export function useSectionNavigation({
  sections,
  sectionRefs,
  setActiveSection,
}: UseSectionNavigationParams) {
  const scrollToSection = useCallback((sectionId: string) => {
    const section = sections.find((entry) => entry.id === sectionId);
    if (section?.disabled) return;

    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  }, [sections, sectionRefs, setActiveSection]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sections.forEach((section) => {
      if (section.disabled) {
        return;
      }

      const element = sectionRefs.current[section.id];
      if (element) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setActiveSection(section.id);
              }
            });
          },
          { threshold: 0.3, rootMargin: '-100px 0px -60% 0px' },
        );
        observer.observe(element);
        observers.push(observer);
      }
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [sections, sectionRefs, setActiveSection]);

  return { scrollToSection };
}
