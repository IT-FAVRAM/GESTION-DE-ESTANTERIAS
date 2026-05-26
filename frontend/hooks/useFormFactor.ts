import { useState, useEffect } from 'react';

export type FormFactor = 'mobile' | 'tablet' | 'desktop';

const getFormFactor = (): FormFactor => {
  const width = window.innerWidth;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (width < 768) return 'mobile';
  if (hasTouch && width >= 768 && width < 1200) return 'tablet';
  return 'desktop';
};

export const useFormFactor = (): FormFactor => {
  const [formFactor, setFormFactor] = useState<FormFactor>(getFormFactor);

  useEffect(() => {
    const onResize = () => setFormFactor(getFormFactor());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return formFactor;
};


