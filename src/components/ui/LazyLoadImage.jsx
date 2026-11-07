import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

/** Lazy image with fixed dimensions so the page does not jump. Pass width/height or a wrapper with an aspect ratio. */
export default function OptimizedImage({ src, alt, ...props }) {
  return <LazyLoadImage {...props} alt={alt} src={src} effect="blur" threshold={300} />;
}
